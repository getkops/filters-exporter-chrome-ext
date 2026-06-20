"use strict";
(() => {
  // src/diagnostics.ts
  var DIAG_MSG_TYPE = "__FILTER_EXPORTER_DIAG__";
  var SECRET_PATTERNS = [
    /bearer\s+[A-Za-z0-9._\-]+/gi,
    /\b(?:authorization|token|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|cookie|session)\b\s*[:=]\s*[^\s,&;]+/gi,
    /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g,
    // JWT-ish
    /\b[A-Fa-f0-9]{32,}\b/g
    // long hex (session ids / hashes)
  ];
  function redactSecrets(text) {
    let out = text;
    for (const re of SECRET_PATTERNS) out = out.replace(re, "[redacted]");
    return out;
  }
  var KEY_PII_PATTERNS = [
    [/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]"],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid]"],
    [/\b\d{7,}\b/g, "[num]"]
  ];
  function redactKey(key) {
    let out = redactSecrets(key);
    for (const [re, repl] of KEY_PII_PATTERNS) out = out.replace(re, repl);
    return out.length > 64 ? `${out.slice(0, 64)}\u2026` : out;
  }
  function sanitizeUrl(url) {
    if (typeof url !== "string" || url === "") return "";
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return redactSecrets(url.split(/[?#]/)[0]);
    }
  }
  function urlParamKeys(url) {
    if (typeof url !== "string" || url === "") return "";
    try {
      return [...new URL(url).searchParams.keys()].join(",");
    } catch {
      const query = url.split("?")[1];
      if (!query) return "";
      return query.split("&").map((pair) => pair.split("=")[0]).filter(Boolean).join(",");
    }
  }
  var MAX_SHAPE_DEPTH = 5;
  var MAX_SHAPE_KEYS = 40;
  function shapeOf(value, depth = 0) {
    if (value === null) return "null";
    const t = typeof value;
    if (t !== "object") return t;
    if (Array.isArray(value)) {
      if (value.length === 0) return ["empty"];
      if (depth >= MAX_SHAPE_DEPTH) return [`array(${value.length})`];
      return [shapeOf(value[0], depth + 1)];
    }
    if (depth >= MAX_SHAPE_DEPTH) return "object";
    const obj = value;
    const keys = Object.keys(obj);
    const out = {};
    let n = 0;
    for (const key of keys) {
      if (n >= MAX_SHAPE_KEYS) {
        out["\u2026"] = `+${keys.length - n} more`;
        break;
      }
      out[redactKey(key)] = shapeOf(obj[key], depth + 1);
      n += 1;
    }
    return out;
  }

  // src/paginate.ts
  var MAX_PAGES = 500;
  async function fetchPage(adapter, url, fetchImpl, init, diag) {
    const safe = sanitizeUrl(url);
    let response;
    try {
      response = await fetchImpl(url, init);
    } catch (err) {
      diag?.({
        stage: "fetch_error",
        source: adapter.source,
        message: `fetch threw for ${safe}: ${err?.message ?? String(err)}`
      });
      return null;
    }
    if (!response.ok) {
      diag?.({
        stage: "http_error",
        source: adapter.source,
        httpStatus: response.status,
        message: `HTTP ${response.status} for ${safe}`
      });
      return null;
    }
    let json;
    try {
      json = await response.json();
    } catch {
      diag?.({ stage: "fetch_error", source: adapter.source, message: `invalid JSON from ${safe}` });
      return null;
    }
    const parsed = adapter.parse(json);
    if (!parsed) {
      diag?.({ stage: "parse_fail", source: adapter.source, message: `unexpected response shape from ${safe}` });
    }
    return parsed;
  }
  function nextStop(total, collected, pageItems, grew, pageHasNext) {
    if (pageItems === 0) return "empty_page";
    if (!grew) return "no_growth";
    if (total !== null) return collected < total ? null : "total_reached";
    return pageHasNext ? null : "source_done";
  }
  async function paginateAll(adapter, url, fetchImpl, init, seed, diag) {
    const items = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (batch) => {
      let grew = false;
      for (const item of batch) {
        const id = adapter.idOf(item);
        if (id !== null) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        items.push(item);
        grew = true;
      }
      return grew;
    };
    const first = seed ?? await fetchPage(adapter, adapter.firstPageUrl(url), fetchImpl, init, diag);
    if (!first) {
      diag?.({
        stage: "pagination_aborted",
        source: adapter.source,
        message: "could not obtain the first page"
      });
      return null;
    }
    const firstRaw = first.raw;
    const total = first.total;
    const pageSizes = [first.items.length];
    add(first.items);
    let reason = nextStop(total, items.length, first.items.length, true, first.hasNext);
    let pageNumber = 2;
    while (reason === null && pageNumber <= MAX_PAGES) {
      const page = await fetchPage(
        adapter,
        adapter.nextPageUrl(url, items, pageNumber),
        fetchImpl,
        init,
        diag
      );
      if (!page) {
        diag?.({
          stage: "pagination_aborted",
          source: adapter.source,
          pageNumber,
          count: items.length,
          message: `aborted at page ${pageNumber}`,
          detail: { total, reason: "http_error", pages: pageSizes.join(",") }
        });
        return null;
      }
      pageSizes.push(page.items.length);
      const grew = add(page.items);
      reason = nextStop(total, items.length, page.items.length, grew, page.hasNext);
      pageNumber += 1;
    }
    if (reason === null) reason = "page_cap";
    const complete = total === null || items.length >= total;
    diag?.({
      stage: "pagination_done",
      source: adapter.source,
      count: items.length,
      pageNumber: pageNumber - 1,
      level: complete ? "info" : "warn",
      message: complete ? void 0 : `incomplete: ${items.length}/${total}`,
      detail: { total, reason, pages: pageSizes.join(","), complete }
    });
    return adapter.rebuild(firstRaw, items);
  }
  var SOUK_ORIGIN = "https://api.souk.to";
  function safeUrl(url, base) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  }
  function soukPageUrl(originalUrl, page) {
    const u = safeUrl(originalUrl, SOUK_ORIGIN) ?? new URL(SOUK_ORIGIN);
    u.searchParams.set("page", String(page));
    return u.toString();
  }
  function vtoolsPageUrl(originalUrl, cursor) {
    const base = originalUrl.split("?")[0];
    const limitMatch = originalUrl.match(/[?&]limit=(\d+)/);
    const limit = limitMatch ? limitMatch[1] : "20";
    let url = `${base}?limit=${limit}&order=created_at,filter_id`;
    if (cursor && cursor.created_at != null) {
      url += `&created_at[lt]=${cursor.created_at}`;
      if (cursor.filter_id) url += `&filter_id[lt]=${cursor.filter_id}`;
    }
    return url;
  }
  var SOUK_ENDPOINT = "api.souk.to/api/v1/matching_alert/web";
  var soukAdapter = {
    source: "souk",
    endpoint: SOUK_ENDPOINT,
    runKey(url) {
      const u = safeUrl(url, SOUK_ORIGIN);
      const status = u?.searchParams.get("status") ?? "all";
      const search = u?.searchParams.get("search") ?? "";
      return `souk:${status}:${search}`;
    },
    isFirstPageRequest(url) {
      const page = safeUrl(url, SOUK_ORIGIN)?.searchParams.get("page");
      return !page || page === "1";
    },
    firstPageUrl(url) {
      return soukPageUrl(url, 1);
    },
    nextPageUrl(url, _accumulated, pageNumber) {
      return soukPageUrl(url, pageNumber);
    },
    parse(json) {
      if (!json || typeof json !== "object") return null;
      const r = json;
      if (r.type !== "success" || !r.body) return null;
      const alerts = Array.isArray(r.body.alerts) ? r.body.alerts : [];
      return { raw: r, items: alerts, total: null, hasNext: r.body.pagination?.has_next_page === true };
    },
    idOf(alert) {
      return alert && typeof alert.id === "string" && alert.id !== "" ? alert.id : null;
    },
    count(resp) {
      return resp.body?.alerts?.length ?? 0;
    },
    expectedTotal() {
      return null;
    },
    rebuild(firstRaw, items) {
      return {
        ...firstRaw,
        body: {
          ...firstRaw.body,
          alerts: items,
          pagination: {
            current_page: 1,
            total_pages: 1,
            total_count: items.length,
            page_size: items.length,
            has_next_page: false
          }
        }
      };
    }
  };
  var VTOOLSV2_ENDPOINT = "www.v-tools.com/api/vinted/filters/list";
  var vtoolsV2Adapter = {
    source: "vtoolsv2",
    endpoint: VTOOLSV2_ENDPOINT,
    // Keyset pagination has no per-query params worth keying on; the endpoint is
    // a single logical list.
    runKey() {
      return "vtoolsv2";
    },
    // The first request carries no keyset cursor; a scroll request does.
    isFirstPageRequest(url) {
      return !/created_at\[lt\]=/.test(url);
    },
    firstPageUrl(url) {
      return vtoolsPageUrl(url, null);
    },
    nextPageUrl(url, accumulated) {
      const last = accumulated[accumulated.length - 1];
      const cursor = last && last.created_at != null ? { created_at: last.created_at, filter_id: last.filter_id } : null;
      return vtoolsPageUrl(url, cursor);
    },
    parse(json) {
      if (!json || typeof json !== "object") return null;
      const r = json;
      if (r.success !== true || !Array.isArray(r.data?.list)) return null;
      const list = r.data.list;
      const pagination = r.data.pagination;
      const total = typeof pagination?.total_entries === "number" ? pagination.total_entries : null;
      const perPage = typeof pagination?.per_page === "number" ? pagination.per_page : null;
      const hasNext = total === null && perPage !== null ? list.length >= perPage : false;
      return { raw: r, items: list, total, hasNext };
    },
    idOf(filter) {
      return filter && typeof filter.filter_id === "string" && filter.filter_id !== "" ? filter.filter_id : null;
    },
    count(resp) {
      return resp.data?.list?.length ?? 0;
    },
    expectedTotal(resp) {
      const total = resp.data?.pagination?.total_entries;
      return typeof total === "number" ? total : null;
    },
    rebuild(firstRaw, items) {
      const reportedTotal = firstRaw.data?.pagination?.total_entries;
      return {
        ...firstRaw,
        data: {
          ...firstRaw.data,
          list: items,
          pagination: {
            per_page: items.length,
            total_pages: 1,
            total_entries: typeof reportedTotal === "number" ? reportedTotal : items.length
          }
        }
      };
    }
  };
  var ADAPTERS = [vtoolsV2Adapter, soukAdapter];
  function matchAdapter(url) {
    if (!url || typeof url !== "string") return null;
    for (const adapter of ADAPTERS) {
      if (url.includes(adapter.endpoint)) return adapter;
    }
    return null;
  }

  // src/inject.ts
  (function() {
    "use strict";
    const LOG_PREFIX = "[Kops Filter Exporter]";
    const MSG_TYPE = "__FILTER_EXPORTER_INTERCEPTED__";
    const originalFetch = window.fetch.bind(window);
    function postInterceptedData(source, data) {
      try {
        window.postMessage({ type: MSG_TYPE, source, data }, "*");
      } catch (err) {
        console.error(LOG_PREFIX, "postMessage failed:", err);
      }
    }
    function headersToPlainObject(headers) {
      const obj = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    function extractFetchConfig(args) {
      try {
        const config = {};
        const first = args[0];
        if (first instanceof Request) {
          config.credentials = first.credentials || void 0;
          if (first.headers) config.headers = headersToPlainObject(first.headers);
          return config;
        }
        const init = args[1];
        if (init && typeof init === "object") {
          const reqInit = init;
          config.credentials = reqInit.credentials || void 0;
          if (reqInit.headers) {
            config.headers = reqInit.headers instanceof Headers ? headersToPlainObject(reqInit.headers) : { ...reqInit.headers };
          }
          return config;
        }
        return null;
      } catch (err) {
        console.warn(LOG_PREFIX, "Failed to extract fetch config:", err);
        return null;
      }
    }
    function toReplayInit(config) {
      const init = { method: "GET" };
      if (config?.credentials) init.credentials = config.credentials;
      if (config?.headers) init.headers = config.headers;
      return init;
    }
    const activeRuns = /* @__PURE__ */ new Set();
    const completedRuns = /* @__PURE__ */ new Set();
    const diag = (input) => {
      try {
        const log = input.level === "error" || input.level === "warn" ? console.warn : console.log;
        log(LOG_PREFIX, input.stage, input.message ?? "", input.detail ?? "");
      } catch {
      }
      try {
        window.postMessage({ type: DIAG_MSG_TYPE, event: { ...input, ctx: "inject" } }, "*");
      } catch {
      }
    };
    async function processAndPost(adapter, url, interceptedJson, requestConfig) {
      const parsed = adapter.parse(interceptedJson);
      if (!parsed) {
        diag({
          stage: "parse_fail",
          source: adapter.source,
          message: "intercepted body was not a usable success payload",
          detail: { shape: JSON.stringify(shapeOf(interceptedJson)) }
        });
        return;
      }
      const runKey = adapter.runKey(url);
      if (completedRuns.has(runKey)) {
        console.log(LOG_PREFIX, `${adapter.source}: already captured this load \u2014 skipping (reload to refresh)`);
        return;
      }
      if (activeRuns.has(runKey)) return;
      activeRuns.add(runKey);
      diag({
        stage: "intercept",
        source: adapter.source,
        count: parsed.items.length,
        detail: parsed.items.length === 0 ? {
          total: parsed.total ?? null,
          params: urlParamKeys(url),
          shape: JSON.stringify(shapeOf(interceptedJson))
        } : void 0
      });
      try {
        const seed = adapter.isFirstPageRequest(url) ? parsed : void 0;
        const result = await paginateAll(
          adapter,
          url,
          originalFetch,
          toReplayInit(requestConfig),
          seed,
          diag
        );
        if (result !== null) {
          const count = adapter.count(result);
          const total = adapter.expectedTotal(result);
          const complete = total === null || count >= total;
          if (count > 0 && complete) completedRuns.add(runKey);
          console.log(
            LOG_PREFIX,
            `Captured ${count}/${total ?? "?"} ${adapter.source} filters${count > 0 && complete ? "" : " (will retry)"}`
          );
          postInterceptedData(adapter.source, result);
        } else {
          console.warn(LOG_PREFIX, `${adapter.source}: incomplete capture \u2014 kept previous data`);
        }
      } catch (err) {
        console.warn(LOG_PREFIX, "Pagination run failed:", err?.message ?? err);
      } finally {
        activeRuns.delete(runKey);
      }
    }
    function urlOf(request) {
      try {
        if (typeof request === "string") return request;
        if (request instanceof Request) return request.url;
        return String(request?.toString?.() ?? "");
      } catch {
        return "";
      }
    }
    window.fetch = async function(...args) {
      const url = urlOf(args[0]);
      const adapter = url ? matchAdapter(url) : null;
      if (!adapter) return originalFetch(...args);
      const requestConfig = extractFetchConfig(args);
      const response = await originalFetch(...args);
      try {
        const clone = response.clone();
        clone.json().then((json) => processAndPost(adapter, url, json, requestConfig)).catch(() => {
        });
      } catch (cloneErr) {
        console.warn(LOG_PREFIX, "Failed to clone response:", cloneErr);
      }
      return response;
    };
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      try {
        this.__filterExporterUrl = typeof url === "string" ? url : String(url);
        this.__filterExporterHeaders = null;
      } catch {
        this.__filterExporterUrl = "";
      }
      return originalXHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      try {
        if (!this.__filterExporterHeaders) this.__filterExporterHeaders = {};
        this.__filterExporterHeaders[name] = value;
      } catch {
      }
      return originalXHRSetHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      const url = this.__filterExporterUrl || "";
      const adapter = url ? matchAdapter(url) : null;
      if (adapter) {
        const xhrConfig = { headers: this.__filterExporterHeaders || void 0 };
        this.addEventListener("load", function() {
          try {
            if (this.status >= 200 && this.status < 300 && this.responseText) {
              const json = JSON.parse(this.responseText);
              void processAndPost(adapter, url, json, xhrConfig);
            }
          } catch {
          }
        });
      }
      return originalXHRSend.apply(this, args);
    };
    console.log(LOG_PREFIX, "Inject script loaded \u2014 monitoring API calls");
  })();
})();

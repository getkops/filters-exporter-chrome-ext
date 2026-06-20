"use strict";
(() => {
  // src/inject.ts
  (function() {
    "use strict";
    const LOG_PREFIX = "[Kops Filter Exporter]";
    const MSG_TYPE = "__FILTER_EXPORTER_INTERCEPTED__";
    const SOUK_ENDPOINT = "api.souk.to/api/v1/matching_alert/web";
    const VTOOLSV2_ENDPOINT = "www.v-tools.com/api/vinted/filters/list";
    const INTERCEPT_PATTERNS = [
      { source: "vtoolsv2", pattern: VTOOLSV2_ENDPOINT },
      { source: "souk", pattern: SOUK_ENDPOINT }
    ];
    function matchUrl(url) {
      if (!url || typeof url !== "string") return null;
      for (const entry of INTERCEPT_PATTERNS) {
        if (url.includes(entry.pattern)) return entry.source;
      }
      return null;
    }
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
          config.method = first.method || "GET";
          config.credentials = first.credentials || void 0;
          if (first.headers) config.headers = headersToPlainObject(first.headers);
          return config;
        }
        const init = args[1];
        if (init && typeof init === "object") {
          const reqInit = init;
          config.method = reqInit.method || "GET";
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
    const activePaginationRuns = /* @__PURE__ */ new Set();
    function getSoukQueryKey(url) {
      const status = url.match(/[?&]status=([^&]*)/)?.[1] || "all";
      const search = url.match(/[?&]search=([^&]*)/)?.[1] || "";
      return `${SOUK_ENDPOINT}?status=${status}&search=${search}`;
    }
    function getPageNumber(url) {
      const match = url.match(/[?&]page=(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }
    function buildSoukPageUrl(originalUrl, pageNumber) {
      const status = originalUrl.match(/[?&]status=([^&]*)/)?.[1] || "all";
      const search = originalUrl.match(/[?&]search=([^&]*)/)?.[1] || "";
      return `https://${SOUK_ENDPOINT}?page=${pageNumber}&status=${status}&search=${encodeURIComponent(decodeURIComponent(search))}`;
    }
    async function fetchSoukPage(url, pageNumber, replayConfig) {
      const pageUrl = buildSoukPageUrl(url, pageNumber);
      try {
        const response = await originalFetch(pageUrl, replayConfig);
        if (!response.ok) {
          console.warn(LOG_PREFIX, `Souk page ${pageNumber}: HTTP ${response.status}`);
          return null;
        }
        const json = await response.json();
        if (json?.type !== "success" || !json?.body) return null;
        return {
          alerts: json.body.alerts || [],
          has_next_page: json.body.pagination?.has_next_page || false
        };
      } catch (err) {
        console.warn(LOG_PREFIX, `Souk page ${pageNumber} fetch failed:`, err?.message ?? err);
        return null;
      }
    }
    async function fetchAllSoukPages(url, firstPageData, requestConfig) {
      const pagination = firstPageData?.body?.pagination;
      if (!pagination) return firstPageData;
      if (!pagination.has_next_page) return firstPageData;
      const startPage = getPageNumber(url);
      if (startPage === null) return firstPageData;
      const queryKey = getSoukQueryKey(url);
      if (activePaginationRuns.has(queryKey)) return null;
      activePaginationRuns.add(queryKey);
      try {
        const allAlerts = [...firstPageData.body?.alerts || []];
        const replayConfig = { method: "GET", ...requestConfig || {} };
        delete replayConfig.body;
        console.log(
          LOG_PREFIX,
          `Souk pagination: starting from page ${startPage}, has_next_page=true, fetching forward\u2026`
        );
        let currentPage = startPage;
        let pagesFetched = 0;
        for (; ; ) {
          currentPage++;
          const result = await fetchSoukPage(url, currentPage, replayConfig);
          if (!result) break;
          allAlerts.push(...result.alerts);
          pagesFetched++;
          if (result.alerts.length === 0) break;
          if (!result.has_next_page) break;
        }
        const seen = /* @__PURE__ */ new Set();
        const uniqueAlerts = allAlerts.filter((alert) => {
          if (!alert || !alert.id) return true;
          if (seen.has(alert.id)) return false;
          seen.add(alert.id);
          return true;
        });
        console.log(
          LOG_PREFIX,
          `Souk pagination complete: page ${startPage} intercepted + ${pagesFetched} forward, ${uniqueAlerts.length} unique alerts`
        );
        return {
          ...firstPageData,
          body: {
            ...firstPageData.body,
            alerts: uniqueAlerts,
            pagination: {
              current_page: 1,
              total_pages: 1,
              total_count: uniqueAlerts.length,
              page_size: uniqueAlerts.length,
              has_next_page: false
            }
          }
        };
      } finally {
        activePaginationRuns.delete(queryKey);
      }
    }
    const activeVToolsV2Runs = /* @__PURE__ */ new Set();
    function getVToolsV2Limit(url) {
      const match = url.match(/[?&]limit=(\d+)/);
      return match ? parseInt(match[1], 10) : 20;
    }
    function buildVToolsV2PageUrl(originalUrl, cursor, limit) {
      const base = originalUrl.split("?")[0];
      let url = `${base}?limit=${limit}&created_at[lt]=${cursor.created_at}`;
      if (cursor.filter_id) url += `&filter_id[lt]=${cursor.filter_id}`;
      url += `&order=created_at,filter_id`;
      return url;
    }
    async function fetchVToolsV2Page(originalUrl, cursor, limit, replayConfig) {
      const pageUrl = buildVToolsV2PageUrl(originalUrl, cursor, limit);
      try {
        const response = await originalFetch(pageUrl, replayConfig);
        if (!response.ok) {
          console.warn(LOG_PREFIX, `V-Tools V2 cursor=${JSON.stringify(cursor)}: HTTP ${response.status}`);
          return null;
        }
        const json = await response.json();
        if (json?.success !== true || !Array.isArray(json?.data?.list)) return null;
        return { list: json.data.list };
      } catch (err) {
        console.warn(LOG_PREFIX, `V-Tools V2 page fetch failed:`, err?.message ?? err);
        return null;
      }
    }
    async function fetchAllVToolsV2Pages(url, firstPageData, requestConfig) {
      const list = firstPageData?.data?.list;
      if (!Array.isArray(list)) return firstPageData;
      const limit = getVToolsV2Limit(url);
      if (limit <= 0) return firstPageData;
      const totalEntries = firstPageData?.data?.pagination?.total_entries ?? null;
      const moreEntriesExist = totalEntries !== null ? list.length < totalEntries : list.length >= limit;
      if (!moreEntriesExist) return firstPageData;
      if (activeVToolsV2Runs.has(VTOOLSV2_ENDPOINT)) return null;
      activeVToolsV2Runs.add(VTOOLSV2_ENDPOINT);
      try {
        const allFilters = [...list];
        const replayConfig = { method: "GET", ...requestConfig || {} };
        delete replayConfig.body;
        const seenIds = new Set(
          list.map((f) => f?.filter_id).filter((id) => Boolean(id))
        );
        console.log(
          LOG_PREFIX,
          `V-Tools V2 pagination: ${list.length} filters on first page, limit=${limit}, total=${totalEntries ?? "?"}, fetching forward\u2026`
        );
        let pagesFetched = 0;
        for (; ; ) {
          const lastItem = allFilters[allFilters.length - 1];
          if (!lastItem?.created_at) break;
          const cursor = { created_at: lastItem.created_at, filter_id: lastItem.filter_id };
          const result = await fetchVToolsV2Page(url, cursor, limit, replayConfig);
          if (!result || result.list.length === 0) break;
          allFilters.push(...result.list);
          pagesFetched++;
          for (const f of result.list) {
            if (f?.filter_id) seenIds.add(f.filter_id);
          }
          if (totalEntries !== null && seenIds.size >= totalEntries) break;
        }
        const seen = /* @__PURE__ */ new Set();
        const unique = allFilters.filter((f) => {
          if (!f?.filter_id) return true;
          if (seen.has(f.filter_id)) return false;
          seen.add(f.filter_id);
          return true;
        });
        console.log(
          LOG_PREFIX,
          `V-Tools V2 pagination complete: ${pagesFetched} extra page(s), ${unique.length}/${totalEntries ?? "?"} unique filters`
        );
        return {
          ...firstPageData,
          data: {
            ...firstPageData.data,
            list: unique,
            pagination: {
              per_page: limit,
              total_pages: 1,
              total_entries: unique.length
            }
          }
        };
      } finally {
        activeVToolsV2Runs.delete(VTOOLSV2_ENDPOINT);
      }
    }
    async function processAndPost(source, url, json, requestConfig) {
      if (!json || typeof json !== "object") return;
      let data = json;
      if (source === "souk") {
        data = await fetchAllSoukPages(url, json, requestConfig);
      } else if (source === "vtoolsv2") {
        data = await fetchAllVToolsV2Pages(url, json, requestConfig);
      }
      if (data !== null) postInterceptedData(source, data);
    }
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(...args) {
      let url = "";
      try {
        const request = args[0];
        url = typeof request === "string" ? request : request instanceof Request ? request.url : String(request?.toString?.() ?? "");
      } catch {
        return originalFetch(...args);
      }
      const source = matchUrl(url);
      if (!source) return originalFetch(...args);
      const requestConfig = extractFetchConfig(args);
      const response = await originalFetch(...args);
      try {
        const clone = response.clone();
        clone.json().then((json) => processAndPost(source, url, json, requestConfig)).catch(() => {
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
        this.__filterExporterMethod = method || "GET";
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
      const source = matchUrl(url);
      if (source) {
        const xhrConfig = {
          method: this.__filterExporterMethod || "GET",
          headers: this.__filterExporterHeaders || void 0
        };
        this.addEventListener("load", function() {
          try {
            if (this.status >= 200 && this.status < 300 && this.responseText) {
              const json = JSON.parse(this.responseText);
              void processAndPost(source, url, json, xhrConfig);
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

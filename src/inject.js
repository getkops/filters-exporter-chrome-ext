/**
 * inject.js — Injected into the PAGE context (not content script context).
 * Monkey-patches fetch() and XMLHttpRequest to intercept API responses
 * from V-Tools and Souk.to filter endpoints.
 *
 * For Souk.to: automatically fetches ALL paginated pages by replaying
 * the original request's auth context (headers, credentials).
 * Only trusts `has_next_page` from the API — all other pagination
 * metadata is unreliable.
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';
  const SOUK_ENDPOINT = 'api.souk.to/api/v1/matching_alert/web';

  const INTERCEPT_PATTERNS = [
    { source: 'vtools', pattern: 'custom.v-tools.com/v3/services/filters' },
    { source: 'souk', pattern: SOUK_ENDPOINT },
  ];

  // ─── URL Matching ──────────────────────────────────────────────────

  function matchUrl(url) {
    if (!url || typeof url !== 'string') return null;
    for (const entry of INTERCEPT_PATTERNS) {
      if (url.includes(entry.pattern)) return entry.source;
    }
    return null;
  }

  // ─── Messaging ─────────────────────────────────────────────────────

  function postInterceptedData(source, data) {
    try {
      window.postMessage({ type: MSG_TYPE, source, data }, '*');
    } catch (err) {
      console.error(LOG_PREFIX, 'postMessage failed:', err);
    }
  }

  // ─── Request Config Extraction ─────────────────────────────────────

  function headersToPlainObject(headers) {
    const obj = {};
    headers.forEach((value, key) => { obj[key] = value; });
    return obj;
  }

  function extractFetchConfig(args) {
    try {
      const config = {};
      if (args[0] instanceof Request) {
        config.method = args[0].method || 'GET';
        config.credentials = args[0].credentials || undefined;
        if (args[0].headers) config.headers = headersToPlainObject(args[0].headers);
        return config;
      }
      if (args[1] && typeof args[1] === 'object') {
        const init = args[1];
        config.method = init.method || 'GET';
        config.credentials = init.credentials || undefined;
        if (init.headers) {
          config.headers = init.headers instanceof Headers
            ? headersToPlainObject(init.headers)
            : { ...init.headers };
        }
        return config;
      }
      return null;
    } catch (err) {
      console.warn(LOG_PREFIX, 'Failed to extract fetch config:', err);
      return null;
    }
  }

  // ─── Souk.to Pagination Engine ─────────────────────────────────────

  /**
   * Guard: tracks which Souk queries are currently being paginated.
   * Keyed by canonical query params (status + search) — NOT page number.
   */
  const activePaginationRuns = new Set();

  /**
   * Extract a canonical key for a Souk URL (without page number).
   * Two requests differing only in `page=N` get the same key.
   */
  function getSoukQueryKey(url) {
    const status = url.match(/[?&]status=([^&]*)/)?.[1] || 'all';
    const search = url.match(/[?&]search=([^&]*)/)?.[1] || '';
    return `${SOUK_ENDPOINT}?status=${status}&search=${search}`;
  }

  /**
   * Extract a numeric page number from the URL's ?page=N parameter.
   * Returns null if page is missing, empty, or non-numeric.
   */
  function getPageNumber(url) {
    const match = url.match(/[?&]page=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Build a clean Souk API URL for a given page number.
   * Constructs from scratch using the known endpoint + extracted params,
   * avoiding any regex-replace issues with malformed URLs.
   */
  function buildSoukPageUrl(originalUrl, pageNumber) {
    const status = originalUrl.match(/[?&]status=([^&]*)/)?.[1] || 'all';
    const search = originalUrl.match(/[?&]search=([^&]*)/)?.[1] || '';
    return `https://${SOUK_ENDPOINT}?page=${pageNumber}&status=${status}&search=${encodeURIComponent(decodeURIComponent(search))}`;
  }

  /**
   * Fetch a single page of Souk alerts using the original request's auth context.
   * Returns { alerts: [], has_next_page: bool } or null on failure.
   */
  async function fetchSoukPage(url, pageNumber, replayConfig) {
    const pageUrl = buildSoukPageUrl(url, pageNumber);
    try {
      const response = await originalFetch(pageUrl, replayConfig);
      if (!response.ok) {
        console.warn(LOG_PREFIX, `Souk page ${pageNumber}: HTTP ${response.status}`);
        return null;
      }
      const json = await response.json();
      if (json?.type !== 'success' || !json?.body) return null;
      return {
        alerts: json.body.alerts || [],
        has_next_page: json.body.pagination?.has_next_page || false,
      };
    } catch (err) {
      console.warn(LOG_PREFIX, `Souk page ${pageNumber} fetch failed:`, err.message || err);
      return null;
    }
  }

  /**
   * Main pagination orchestrator.
   *
   * Strategy: only trust `has_next_page` from the API.
   * - Forward: fetch page+1, page+2, ... until has_next_page is false
   * - No backward fetch needed: the Souk UI always starts from page 1
   *
   * Returns the merged response object, or null if a duplicate run
   * (caller must NOT post null to the content script).
   */
  async function fetchAllSoukPages(url, firstPageData, requestConfig) {
    const pagination = firstPageData?.body?.pagination;
    if (!pagination) return firstPageData;

    // Only paginate if the API says there are more pages
    if (!pagination.has_next_page) return firstPageData;

    // Validate: must have a real numeric page number in the URL
    const startPage = getPageNumber(url);
    if (startPage === null) {
      // Malformed URL (e.g. "page=&status=all&search=+2") — skip pagination
      return firstPageData;
    }

    // Dedup guard: only one pagination run per query at a time
    const queryKey = getSoukQueryKey(url);
    if (activePaginationRuns.has(queryKey)) {
      return null; // duplicate — caller must NOT post
    }
    activePaginationRuns.add(queryKey);

    try {
      const allAlerts = [...(firstPageData.body.alerts || [])];

      // Build replay config preserving auth headers
      const replayConfig = { method: 'GET', ...(requestConfig || {}) };
      delete replayConfig.body;

      console.log(
        LOG_PREFIX,
        `Souk pagination: starting from page ${startPage}, has_next_page=true, fetching forward…`
      );

      // Forward fetch: page+1, page+2, ... until has_next_page=false
      let currentPage = startPage;
      let pagesFetched = 0;

      while (true) {
        currentPage++;
        const result = await fetchSoukPage(url, currentPage, replayConfig);

        if (!result) break; // network error or non-success — stop

        allAlerts.push(...result.alerts);
        pagesFetched++;

        if (result.alerts.length === 0) break; // empty page — stop

        if (!result.has_next_page) break; // API says no more — stop
      }

      // Deduplicate by alert ID
      const seen = new Set();
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
            has_next_page: false,
          },
        },
      };
    } finally {
      activePaginationRuns.delete(queryKey);
    }
  }

  // ─── Patch fetch() ─────────────────────────────────────────────────

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    let url = '';
    try {
      const request = args[0];
      url = typeof request === 'string'
        ? request
        : (request instanceof Request ? request.url : String(request?.url || ''));
    } catch (e) {
      return originalFetch.apply(this, args);
    }

    const source = matchUrl(url);
    if (!source) return originalFetch.apply(this, args);

    // Capture request config BEFORE the call
    const requestConfig = source === 'souk' ? extractFetchConfig(args) : null;

    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (fetchErr) {
      throw fetchErr;
    }

    // Clone and parse in background — never block the original response
    try {
      const clone = response.clone();
      clone.json().then(async (json) => {
        if (json && typeof json === 'object') {
          let data = json;
          if (source === 'souk') {
            data = await fetchAllSoukPages(url, json, requestConfig);
          }
          if (data !== null) {
            postInterceptedData(source, data);
          }
        }
      }).catch(() => {});
    } catch (cloneErr) {
      console.warn(LOG_PREFIX, 'Failed to clone response:', cloneErr);
    }

    return response;
  };

  // ─── Patch XMLHttpRequest ──────────────────────────────────────────

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this.__filterExporterUrl = typeof url === 'string' ? url : String(url);
      this.__filterExporterMethod = method || 'GET';
      this.__filterExporterHeaders = null;
    } catch (e) {
      this.__filterExporterUrl = '';
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (!this.__filterExporterHeaders) this.__filterExporterHeaders = {};
      this.__filterExporterHeaders[name] = value;
    } catch (e) {}
    return originalXHRSetHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this.__filterExporterUrl || '';
    const source = matchUrl(url);

    if (source) {
      const xhrConfig = source === 'souk'
        ? { method: this.__filterExporterMethod || 'GET', headers: this.__filterExporterHeaders || null }
        : null;

      this.addEventListener('load', async function () {
        try {
          if (this.status >= 200 && this.status < 300 && this.responseText) {
            let json = JSON.parse(this.responseText);
            if (json && typeof json === 'object') {
              let data = json;
              if (source === 'souk') {
                data = await fetchAllSoukPages(url, json, xhrConfig);
              }
              if (data !== null) {
                postInterceptedData(source, data);
              }
            }
          }
        } catch (err) {}
      });
    }

    return originalXHRSend.apply(this, args);
  };

  console.log(LOG_PREFIX, 'Inject script loaded — monitoring API calls');
})();

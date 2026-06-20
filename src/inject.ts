/**
 * inject.ts — Injected into the PAGE context (MAIN world, not the content-script
 * context). Monkey-patches fetch() and XMLHttpRequest to intercept API
 * responses from V-Tools V2 and Souk.to filter endpoints.
 *
 * For Souk.to and V-Tools V2: automatically fetches ALL paginated pages by
 * replaying the original request's auth context (headers, credentials).
 *  - Souk: only trusts `has_next_page`; all other pagination metadata is
 *    unreliable.
 *  - V-Tools V2: compound keyset cursor (created_at, filter_id) — exactly what
 *    the native app sends.
 *
 * Legacy V-Tools V1 is intentionally NOT intercepted (dropped in v2.0.0).
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';
  const SOUK_ENDPOINT = 'api.souk.to/api/v1/matching_alert/web';
  const VTOOLSV2_ENDPOINT = 'www.v-tools.com/api/vinted/filters/list';

  type InterceptSource = 'vtoolsv2' | 'souk';

  interface InterceptPattern {
    source: InterceptSource;
    pattern: string;
  }

  const INTERCEPT_PATTERNS: InterceptPattern[] = [
    { source: 'vtoolsv2', pattern: VTOOLSV2_ENDPOINT },
    { source: 'souk', pattern: SOUK_ENDPOINT },
  ];

  interface ReplayConfig {
    method?: string;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    body?: unknown;
  }

  // ─── URL matching ──────────────────────────────────────────────────

  function matchUrl(url: string): InterceptSource | null {
    if (!url || typeof url !== 'string') return null;
    for (const entry of INTERCEPT_PATTERNS) {
      if (url.includes(entry.pattern)) return entry.source;
    }
    return null;
  }

  // ─── Messaging ─────────────────────────────────────────────────────

  function postInterceptedData(source: InterceptSource, data: unknown): void {
    try {
      window.postMessage({ type: MSG_TYPE, source, data }, '*');
    } catch (err) {
      console.error(LOG_PREFIX, 'postMessage failed:', err);
    }
  }

  // ─── Request config extraction ─────────────────────────────────────

  function headersToPlainObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  function extractFetchConfig(args: unknown[]): ReplayConfig | null {
    try {
      const config: ReplayConfig = {};
      const first = args[0];
      if (first instanceof Request) {
        config.method = first.method || 'GET';
        config.credentials = first.credentials || undefined;
        if (first.headers) config.headers = headersToPlainObject(first.headers);
        return config;
      }
      const init = args[1];
      if (init && typeof init === 'object') {
        const reqInit = init as RequestInit;
        config.method = reqInit.method || 'GET';
        config.credentials = reqInit.credentials || undefined;
        if (reqInit.headers) {
          config.headers =
            reqInit.headers instanceof Headers
              ? headersToPlainObject(reqInit.headers)
              : ({ ...(reqInit.headers as Record<string, string>) });
        }
        return config;
      }
      return null;
    } catch (err) {
      console.warn(LOG_PREFIX, 'Failed to extract fetch config:', err);
      return null;
    }
  }

  // ─── Souk.to pagination engine ─────────────────────────────────────

  interface SoukResponse {
    type?: string;
    body?: {
      alerts?: SoukAlert[];
      pagination?: { has_next_page?: boolean; [k: string]: unknown };
    };
    [k: string]: unknown;
  }
  interface SoukAlert {
    id?: string;
    [k: string]: unknown;
  }

  /** Tracks Souk queries currently being paginated (keyed by status+search). */
  const activePaginationRuns = new Set<string>();

  function getSoukQueryKey(url: string): string {
    const status = url.match(/[?&]status=([^&]*)/)?.[1] || 'all';
    const search = url.match(/[?&]search=([^&]*)/)?.[1] || '';
    return `${SOUK_ENDPOINT}?status=${status}&search=${search}`;
  }

  function getPageNumber(url: string): number | null {
    const match = url.match(/[?&]page=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function buildSoukPageUrl(originalUrl: string, pageNumber: number): string {
    const status = originalUrl.match(/[?&]status=([^&]*)/)?.[1] || 'all';
    const search = originalUrl.match(/[?&]search=([^&]*)/)?.[1] || '';
    return `https://${SOUK_ENDPOINT}?page=${pageNumber}&status=${status}&search=${encodeURIComponent(decodeURIComponent(search))}`;
  }

  async function fetchSoukPage(
    url: string,
    pageNumber: number,
    replayConfig: ReplayConfig,
  ): Promise<{ alerts: SoukAlert[]; has_next_page: boolean } | null> {
    const pageUrl = buildSoukPageUrl(url, pageNumber);
    try {
      const response = await originalFetch(pageUrl, replayConfig as RequestInit);
      if (!response.ok) {
        console.warn(LOG_PREFIX, `Souk page ${pageNumber}: HTTP ${response.status}`);
        return null;
      }
      const json = (await response.json()) as SoukResponse;
      if (json?.type !== 'success' || !json?.body) return null;
      return {
        alerts: json.body.alerts || [],
        has_next_page: json.body.pagination?.has_next_page || false,
      };
    } catch (err) {
      console.warn(LOG_PREFIX, `Souk page ${pageNumber} fetch failed:`, (err as Error)?.message ?? err);
      return null;
    }
  }

  async function fetchAllSoukPages(
    url: string,
    firstPageData: SoukResponse,
    requestConfig: ReplayConfig | null,
  ): Promise<SoukResponse | null> {
    const pagination = firstPageData?.body?.pagination;
    if (!pagination) return firstPageData;
    if (!pagination.has_next_page) return firstPageData;

    const startPage = getPageNumber(url);
    if (startPage === null) return firstPageData; // malformed URL — skip pagination

    const queryKey = getSoukQueryKey(url);
    if (activePaginationRuns.has(queryKey)) return null; // duplicate — caller must NOT post
    activePaginationRuns.add(queryKey);

    try {
      const allAlerts: SoukAlert[] = [...(firstPageData.body?.alerts || [])];
      const replayConfig: ReplayConfig = { method: 'GET', ...(requestConfig || {}) };
      delete replayConfig.body;

      console.log(
        LOG_PREFIX,
        `Souk pagination: starting from page ${startPage}, has_next_page=true, fetching forward…`,
      );

      let currentPage = startPage;
      let pagesFetched = 0;

      for (;;) {
        currentPage++;
        const result = await fetchSoukPage(url, currentPage, replayConfig);
        if (!result) break;
        allAlerts.push(...result.alerts);
        pagesFetched++;
        if (result.alerts.length === 0) break;
        if (!result.has_next_page) break;
      }

      const seen = new Set<string>();
      const uniqueAlerts = allAlerts.filter((alert) => {
        if (!alert || !alert.id) return true;
        if (seen.has(alert.id)) return false;
        seen.add(alert.id);
        return true;
      });

      console.log(
        LOG_PREFIX,
        `Souk pagination complete: page ${startPage} intercepted + ${pagesFetched} forward, ${uniqueAlerts.length} unique alerts`,
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

  // ─── V-Tools V2 pagination engine ──────────────────────────────────

  interface VToolsV2Response {
    success?: boolean;
    data?: {
      list?: VToolsV2Filter[];
      pagination?: { total_entries?: number; [k: string]: unknown };
    };
    [k: string]: unknown;
  }
  interface VToolsV2Filter {
    filter_id?: string;
    created_at?: number;
    [k: string]: unknown;
  }
  interface V2Cursor {
    created_at?: number;
    filter_id?: string;
  }

  const activeVToolsV2Runs = new Set<string>();

  function getVToolsV2Limit(url: string): number {
    const match = url.match(/[?&]limit=(\d+)/);
    return match ? parseInt(match[1], 10) : 20;
  }

  function buildVToolsV2PageUrl(originalUrl: string, cursor: V2Cursor, limit: number): string {
    const base = originalUrl.split('?')[0];
    let url = `${base}?limit=${limit}&created_at[lt]=${cursor.created_at}`;
    if (cursor.filter_id) url += `&filter_id[lt]=${cursor.filter_id}`;
    url += `&order=created_at,filter_id`;
    return url;
  }

  async function fetchVToolsV2Page(
    originalUrl: string,
    cursor: V2Cursor,
    limit: number,
    replayConfig: ReplayConfig,
  ): Promise<{ list: VToolsV2Filter[] } | null> {
    const pageUrl = buildVToolsV2PageUrl(originalUrl, cursor, limit);
    try {
      const response = await originalFetch(pageUrl, replayConfig as RequestInit);
      if (!response.ok) {
        console.warn(LOG_PREFIX, `V-Tools V2 cursor=${JSON.stringify(cursor)}: HTTP ${response.status}`);
        return null;
      }
      const json = (await response.json()) as VToolsV2Response;
      if (json?.success !== true || !Array.isArray(json?.data?.list)) return null;
      return { list: json.data.list };
    } catch (err) {
      console.warn(LOG_PREFIX, `V-Tools V2 page fetch failed:`, (err as Error)?.message ?? err);
      return null;
    }
  }

  async function fetchAllVToolsV2Pages(
    url: string,
    firstPageData: VToolsV2Response,
    requestConfig: ReplayConfig | null,
  ): Promise<VToolsV2Response | null> {
    const list = firstPageData?.data?.list;
    if (!Array.isArray(list)) return firstPageData;

    const limit = getVToolsV2Limit(url);
    if (limit <= 0) return firstPageData;

    const totalEntries = firstPageData?.data?.pagination?.total_entries ?? null;
    const moreEntriesExist =
      totalEntries !== null ? list.length < totalEntries : list.length >= limit;
    if (!moreEntriesExist) return firstPageData;

    if (activeVToolsV2Runs.has(VTOOLSV2_ENDPOINT)) return null;
    activeVToolsV2Runs.add(VTOOLSV2_ENDPOINT);

    try {
      const allFilters: VToolsV2Filter[] = [...list];
      const replayConfig: ReplayConfig = { method: 'GET', ...(requestConfig || {}) };
      delete replayConfig.body;

      const seenIds = new Set<string>(
        list.map((f) => f?.filter_id).filter((id): id is string => Boolean(id)),
      );

      console.log(
        LOG_PREFIX,
        `V-Tools V2 pagination: ${list.length} filters on first page, limit=${limit}, total=${totalEntries ?? '?'}, fetching forward…`,
      );

      let pagesFetched = 0;

      for (;;) {
        const lastItem = allFilters[allFilters.length - 1];
        if (!lastItem?.created_at) break;
        const cursor: V2Cursor = { created_at: lastItem.created_at, filter_id: lastItem.filter_id };
        const result = await fetchVToolsV2Page(url, cursor, limit, replayConfig);
        if (!result || result.list.length === 0) break;
        allFilters.push(...result.list);
        pagesFetched++;
        for (const f of result.list) {
          if (f?.filter_id) seenIds.add(f.filter_id);
        }
        if (totalEntries !== null && seenIds.size >= totalEntries) break;
      }

      const seen = new Set<string>();
      const unique = allFilters.filter((f) => {
        if (!f?.filter_id) return true;
        if (seen.has(f.filter_id)) return false;
        seen.add(f.filter_id);
        return true;
      });

      console.log(
        LOG_PREFIX,
        `V-Tools V2 pagination complete: ${pagesFetched} extra page(s), ${unique.length}/${totalEntries ?? '?'} unique filters`,
      );

      return {
        ...firstPageData,
        data: {
          ...firstPageData.data,
          list: unique,
          pagination: {
            per_page: limit,
            total_pages: 1,
            total_entries: unique.length,
          },
        },
      };
    } finally {
      activeVToolsV2Runs.delete(VTOOLSV2_ENDPOINT);
    }
  }

  // ─── Shared post-processing ────────────────────────────────────────

  async function processAndPost(
    source: InterceptSource,
    url: string,
    json: unknown,
    requestConfig: ReplayConfig | null,
  ): Promise<void> {
    if (!json || typeof json !== 'object') return;
    let data: unknown = json;
    if (source === 'souk') {
      data = await fetchAllSoukPages(url, json as SoukResponse, requestConfig);
    } else if (source === 'vtoolsv2') {
      data = await fetchAllVToolsV2Pages(url, json as VToolsV2Response, requestConfig);
    }
    if (data !== null) postInterceptedData(source, data);
  }

  // ─── Patch fetch() ─────────────────────────────────────────────────

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
    let url = '';
    try {
      const request = args[0];
      url =
        typeof request === 'string'
          ? request
          : request instanceof Request
            ? request.url
            : String((request as URL | undefined)?.toString?.() ?? '');
    } catch {
      return originalFetch(...args);
    }

    const source = matchUrl(url);
    if (!source) return originalFetch(...args);

    const requestConfig = extractFetchConfig(args as unknown[]);

    const response = await originalFetch(...args);

    // Clone and parse in background — never block the original response.
    try {
      const clone = response.clone();
      clone
        .json()
        .then((json) => processAndPost(source, url, json, requestConfig))
        .catch(() => {});
    } catch (cloneErr) {
      console.warn(LOG_PREFIX, 'Failed to clone response:', cloneErr);
    }

    return response;
  } as typeof fetch;

  // ─── Patch XMLHttpRequest ──────────────────────────────────────────

  interface PatchedXHR extends XMLHttpRequest {
    __filterExporterUrl?: string;
    __filterExporterMethod?: string;
    __filterExporterHeaders?: Record<string, string> | null;
  }

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (
    this: PatchedXHR,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    try {
      this.__filterExporterUrl = typeof url === 'string' ? url : String(url);
      this.__filterExporterMethod = method || 'GET';
      this.__filterExporterHeaders = null;
    } catch {
      this.__filterExporterUrl = '';
    }
    // @ts-expect-error — variadic passthrough to the native signature.
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (
    this: PatchedXHR,
    name: string,
    value: string,
  ): void {
    try {
      if (!this.__filterExporterHeaders) this.__filterExporterHeaders = {};
      this.__filterExporterHeaders[name] = value;
    } catch {
      /* ignore */
    }
    return originalXHRSetHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (
    this: PatchedXHR,
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const url = this.__filterExporterUrl || '';
    const source = matchUrl(url);

    if (source) {
      const xhrConfig: ReplayConfig = {
        method: this.__filterExporterMethod || 'GET',
        headers: this.__filterExporterHeaders || undefined,
      };
      this.addEventListener('load', function (this: PatchedXHR) {
        try {
          if (this.status >= 200 && this.status < 300 && this.responseText) {
            const json = JSON.parse(this.responseText);
            void processAndPost(source, url, json, xhrConfig);
          }
        } catch {
          /* ignore parse errors */
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };

  console.log(LOG_PREFIX, 'Inject script loaded — monitoring API calls');
})();

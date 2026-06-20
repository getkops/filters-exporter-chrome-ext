/**
 * inject.ts — Injected into the PAGE context (MAIN world, not the content-script
 * context). Monkey-patches fetch() and XMLHttpRequest to intercept API
 * responses from V-Tools V2 and Souk.to filter endpoints.
 *
 * This file owns ONLY page-world concerns: patching the network primitives,
 * capturing the request's auth context for replay, collapsing concurrent runs,
 * and posting results to the content script. The actual "rebuild the complete
 * filter set" logic lives in ./paginate — a pure, fetch-injected, unit-tested
 * engine. Whichever page the app requested (page 1 on load, page N on scroll),
 * the engine rebuilds the COMPLETE set from the first page, so the service
 * worker's replace-in-storage is always correct, and returns `null` on any
 * partial failure so a flaky network never clobbers a captured set.
 *
 * Legacy V-Tools V1 is intentionally NOT intercepted (dropped in v2.0.0).
 */

import { matchAdapter, paginateAll, type AnyAdapter } from './paginate';
import { shapeOf, urlParamKeys, DIAG_MSG_TYPE, type DiagSink } from './diagnostics';

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';

  interface ReplayConfig {
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
  }

  // The page's real fetch, captured before patching — used by the paginator so
  // its own page fetches are never re-intercepted (no recursion).
  const originalFetch = window.fetch.bind(window);

  // ─── Messaging ─────────────────────────────────────────────────────

  function postInterceptedData(source: string, data: unknown): void {
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
        config.credentials = first.credentials || undefined;
        if (first.headers) config.headers = headersToPlainObject(first.headers);
        return config;
      }
      const init = args[1];
      if (init && typeof init === 'object') {
        const reqInit = init as RequestInit;
        config.credentials = reqInit.credentials || undefined;
        if (reqInit.headers) {
          config.headers =
            reqInit.headers instanceof Headers
              ? headersToPlainObject(reqInit.headers)
              : { ...(reqInit.headers as Record<string, string>) };
        }
        return config;
      }
      return null;
    } catch (err) {
      console.warn(LOG_PREFIX, 'Failed to extract fetch config:', err);
      return null;
    }
  }

  /** Build the replay RequestInit: always GET, auth context preserved, no body. */
  function toReplayInit(config: ReplayConfig | null): RequestInit {
    const init: RequestInit = { method: 'GET' };
    if (config?.credentials) init.credentials = config.credentials;
    if (config?.headers) init.headers = config.headers;
    return init;
  }

  // ─── Run coordination ──────────────────────────────────────────────

  /** Logical queries currently being paginated, keyed by adapter.runKey(url). */
  const activeRuns = new Set<string>();
  /**
   * Logical queries already captured in THIS page load. This script re-executes
   * on every full page reload but its state persists across SPA navigation /
   * scroll — so it naturally limits the full re-fetch to "once per reload":
   * manual paging is skipped; a reload (or the popup's Refresh, which opens a
   * fresh tab) re-runs the capture.
   */
  const completedRuns = new Set<string>();

  /**
   * Structured diagnostics sink: logs to the page console for live debugging AND
   * forwards the event to the service worker's debug ring buffer (via the content
   * script). Wrapped so diagnostics can never throw into the capture flow.
   */
  const diag: DiagSink = (input) => {
    try {
      const log = input.level === 'error' || input.level === 'warn' ? console.warn : console.log;
      log(LOG_PREFIX, input.stage, input.message ?? '', input.detail ?? '');
    } catch {
      /* ignore */
    }
    try {
      window.postMessage({ type: DIAG_MSG_TYPE, event: { ...input, ctx: 'inject' } }, '*');
    } catch {
      /* ignore */
    }
  };

  /**
   * Assemble the complete set for an intercepted response and post it. Skips
   * when (a) the body isn't a usable success payload, (b) this query was already
   * captured this page load (manual paging), (c) a run for it is already in
   * flight, or (d) pagination failed partway — never posting a partial/stale set.
   */
  async function processAndPost(
    adapter: AnyAdapter,
    url: string,
    interceptedJson: unknown,
    requestConfig: ReplayConfig | null,
  ): Promise<void> {
    // Only paginate genuine success payloads — skip errors / unexpected shapes.
    // shapeOf runs HERE (page side) so the raw body never crosses the wire —
    // only its structure (keys + types, no values) reaches the debug buffer.
    const parsed = adapter.parse(interceptedJson);
    if (!parsed) {
      diag({
        stage: 'parse_fail',
        source: adapter.source,
        message: 'intercepted body was not a usable success payload',
        detail: { shape: JSON.stringify(shapeOf(interceptedJson)) },
      });
      return;
    }

    const runKey = adapter.runKey(url);
    if (completedRuns.has(runKey)) {
      // Console only — manual paging is high-volume and would crowd the buffer.
      console.log(LOG_PREFIX, `${adapter.source}: already captured this load — skipping (reload to refresh)`);
      return;
    }
    if (activeRuns.has(runKey)) return; // a run for this query is already going
    activeRuns.add(runKey);
    // Proof the inject ran AND the endpoint matched with a valid body — the
    // anchor the support bundle uses to tell "ran but failed" from "never ran".
    // When the matched body is EMPTY (e.g. a count-probe call, or a moved data
    // key), attach its shape + the request's param KEYS so the cause is obvious.
    diag({
      stage: 'intercept',
      source: adapter.source,
      count: parsed.items.length,
      detail:
        parsed.items.length === 0
          ? {
              total: parsed.total ?? null,
              params: urlParamKeys(url),
              shape: JSON.stringify(shapeOf(interceptedJson)),
            }
          : undefined,
    });

    try {
      // Seed from the intercepted body when it is the first page of the set, so
      // we don't re-issue a request the app already made (and don't break the
      // single-page V-Tools path). Otherwise rebuild from the first page.
      const seed = adapter.isFirstPageRequest(url) ? parsed : undefined;
      const result = await paginateAll(
        adapter,
        url,
        originalFetch,
        toReplayInit(requestConfig),
        seed,
        diag,
      );
      if (result !== null) {
        const count = adapter.count(result);
        const total = adapter.expectedTotal(result);
        const complete = total === null || count >= total;
        // Only gate future requests once we have a SATISFACTORY capture. An empty
        // or short response (V-Tools' count-probe call, or a truncated list
        // during an outage) must NOT block the real list request that follows.
        if (count > 0 && complete) completedRuns.add(runKey);
        console.log(
          LOG_PREFIX,
          `Captured ${count}/${total ?? '?'} ${adapter.source} filters${count > 0 && complete ? '' : ' (will retry)'}`,
        );
        postInterceptedData(adapter.source, result);
      } else {
        console.warn(LOG_PREFIX, `${adapter.source}: incomplete capture — kept previous data`);
      }
    } catch (err) {
      console.warn(LOG_PREFIX, 'Pagination run failed:', (err as Error)?.message ?? err);
    } finally {
      activeRuns.delete(runKey);
    }
  }

  // ─── URL helper ────────────────────────────────────────────────────

  function urlOf(request: unknown): string {
    try {
      if (typeof request === 'string') return request;
      if (request instanceof Request) return request.url;
      return String((request as URL | undefined)?.toString?.() ?? '');
    } catch {
      return '';
    }
  }

  // ─── Patch fetch() ─────────────────────────────────────────────────

  window.fetch = async function (
    this: unknown,
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    const url = urlOf(args[0]);
    const adapter = url ? matchAdapter(url) : null;
    if (!adapter) return originalFetch(...args);

    const requestConfig = extractFetchConfig(args as unknown[]);
    const response = await originalFetch(...args);

    // Clone and parse in the background — never block the original response.
    try {
      const clone = response.clone();
      clone
        .json()
        .then((json) => processAndPost(adapter, url, json, requestConfig))
        .catch(() => {});
    } catch (cloneErr) {
      console.warn(LOG_PREFIX, 'Failed to clone response:', cloneErr);
    }

    return response;
  } as typeof fetch;

  // ─── Patch XMLHttpRequest ──────────────────────────────────────────

  interface PatchedXHR extends XMLHttpRequest {
    __filterExporterUrl?: string;
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
    const adapter = url ? matchAdapter(url) : null;

    if (adapter) {
      const xhrConfig: ReplayConfig = { headers: this.__filterExporterHeaders || undefined };
      this.addEventListener('load', function (this: PatchedXHR) {
        try {
          if (this.status >= 200 && this.status < 300 && this.responseText) {
            const json = JSON.parse(this.responseText);
            void processAndPost(adapter, url, json, xhrConfig);
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

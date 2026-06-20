/**
 * paginate.ts — Pure, source-agnostic pagination engine for V-Tools V2 and
 * Souk.to filter endpoints.
 *
 * This module is intentionally free of `chrome`, `window`, and any global
 * `fetch`: the fetch implementation is INJECTED, so the engine is unit-testable
 * under Node (vitest) with a mock fetch. inject.ts wires the page's real
 * (pre-patch) `fetch` into it.
 *
 * ─── What it does ───────────────────────────────────────────────────────────
 * The extension intercepts ONE page of a paginated query. To export the whole
 * account it must assemble the COMPLETE set, which means:
 *
 *   1. SEED from the intercepted body when that body is genuinely the first
 *      page/cursor (the common case — a page load starts at the top). The seed
 *      is used as-is and only pages 2…N are fetched, so we never re-issue a
 *      request the app already made. This is what keeps single-page accounts at
 *      zero extra fetches and is why V-Tools works.
 *   2. When the intercepted body is NOT the first page (e.g. a deep scroll was
 *      the very first thing we saw), rebuild from the first page instead, so the
 *      result is still complete.
 *   3. Return `null` on ANY partial failure (HTTP error, parse error, bad
 *      shape). The caller skips posting on `null`, so a flaky network never
 *      clobbers a previously-captured good set — completeness is all-or-nothing.
 *
 * Re-pagination is gated to once per page load by inject.ts (see completedRuns)
 * — manual paging within a session is NOT re-fetched.
 *
 * The two sources differ only in HOW you walk pages and HOW you know you're
 * done — Souk uses 1-based `page` numbers + a `has_next_page` flag; V-Tools V2
 * uses a compound keyset cursor (`created_at`, `filter_id`) and a
 * `total_entries` count. Those differences live in two small adapters; the loop,
 * de-duplication, termination, failure handling, and the runaway cap are shared.
 */

import { sanitizeUrl, type DiagSink } from './diagnostics';

// ─── Injected fetch ────────────────────────────────────────────────

/** The subset of `fetch` the engine needs; inject.ts passes the real one. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// ─── Wire response shapes ──────────────────────────────────────────

export interface SoukAlert {
  id?: string;
  [k: string]: unknown;
}
export interface SoukResponse {
  type?: string;
  body?: {
    alerts?: SoukAlert[];
    pagination?: { has_next_page?: boolean; [k: string]: unknown };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface VToolsV2Filter {
  filter_id?: string;
  created_at?: number;
  [k: string]: unknown;
}
export interface VToolsV2Response {
  success?: boolean;
  data?: {
    list?: VToolsV2Filter[];
    pagination?: { total_entries?: number; per_page?: number; [k: string]: unknown };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** Canonical wire-source ids (pre-normalization). */
export type WireSource = 'vtoolsv2' | 'souk';

// ─── Source adapter contract ───────────────────────────────────────

/**
 * A parsed page. `total` is the grand item count when the source reports one
 * (V-Tools `total_entries`), else `null`. `hasNext` is a per-page "more" flag
 * when the source has one (Souk `has_next_page`), else `false`. The engine
 * prefers `total` and falls back to `hasNext`.
 */
export interface ParsedPage<TResp, TItem> {
  raw: TResp;
  items: TItem[];
  total: number | null;
  hasNext: boolean;
}

/**
 * Everything that differs between Souk and V-Tools V2. The engine owns the
 * loop; the adapter owns URL construction, response parsing, identity, and the
 * final single-page rebuild.
 */
export interface SourceAdapter<TResp, TItem> {
  readonly source: WireSource;
  /** Substring matched against intercepted request URLs. */
  readonly endpoint: string;

  /**
   * Stable key grouping every page of ONE logical query, used by inject.ts to
   * collapse concurrent runs and gate re-pagination. Page/cursor params are
   * excluded so all pages of a query share a key.
   */
  runKey(url: string): string;

  /**
   * True when `url` is the FIRST page/cursor of its query — i.e. the intercepted
   * body can be trusted as the start of the set and used to seed pagination.
   */
  isFirstPageRequest(url: string): boolean;

  /** URL of the first page/cursor, used when the trigger was NOT the first. */
  firstPageUrl(url: string): string;
  /** URL of the next page, given the accumulated items and the 1-based page #. */
  nextPageUrl(url: string, accumulated: TItem[], pageNumber: number): string;

  /**
   * Validate + extract a raw response. Returns `null` when the response is not
   * a usable success payload — which the engine treats as a hard failure
   * (return `null`, do not post) rather than "empty page".
   */
  parse(json: unknown): ParsedPage<TResp, TItem> | null;

  /** Stable per-item id for de-duplication, or `null` when absent. */
  idOf(item: TItem): string | null;

  /** Item count carried by a (rebuilt) response — for logging. */
  count(resp: TResp): number;

  /** The source's reported grand total, or null — to judge completeness. */
  expectedTotal(resp: TResp): number | null;

  /** Collapse the first raw response + the full item list into one page. */
  rebuild(firstRaw: TResp, items: TItem[]): TResp;
}

// ─── Engine ────────────────────────────────────────────────────────

/**
 * Safety cap on pages fetched in one run. At a typical page size of 20 this is
 * ~10k filters — far beyond any real account — so it only ever bounds a runaway
 * loop (e.g. a source that never signals completion).
 */
export const MAX_PAGES = 500;

async function fetchPage<TResp, TItem>(
  adapter: SourceAdapter<TResp, TItem>,
  url: string,
  fetchImpl: FetchLike,
  init: RequestInit,
  diag?: DiagSink,
): Promise<ParsedPage<TResp, TItem> | null> {
  const safe = sanitizeUrl(url);
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (err) {
    diag?.({
      stage: 'fetch_error',
      source: adapter.source,
      message: `fetch threw for ${safe}: ${(err as Error)?.message ?? String(err)}`,
    });
    return null;
  }
  if (!response.ok) {
    diag?.({
      stage: 'http_error',
      source: adapter.source,
      httpStatus: response.status,
      message: `HTTP ${response.status} for ${safe}`,
    });
    return null;
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    diag?.({ stage: 'fetch_error', source: adapter.source, message: `invalid JSON from ${safe}` });
    return null;
  }
  const parsed = adapter.parse(json);
  if (!parsed) {
    diag?.({ stage: 'parse_fail', source: adapter.source, message: `unexpected response shape from ${safe}` });
  }
  return parsed;
}

/** Why a pagination run stopped — surfaced in diagnostics to explain partials. */
export type StopReason =
  | 'total_reached' // collected the source's reported total (complete)
  | 'source_done' // the source's per-page flag said no more (Souk, complete)
  | 'empty_page' // a page came back empty before the total (short)
  | 'no_growth' // a page added nothing new — overlap / cursor stall (short)
  | 'page_cap'; // hit the MAX_PAGES safety cap (short)

/**
 * Decide whether to fetch another page after absorbing one. Returns `null` to
 * keep going, or the reason the walk ended.
 *  - Stop on an empty page or one that added nothing new (overlap / convergence).
 *  - When the source reports a total (V-Tools `total_entries`), stop once we've
 *    collected it.
 *  - Otherwise defer to the per-page flag (Souk `has_next_page`).
 */
function nextStop(
  total: number | null,
  collected: number,
  pageItems: number,
  grew: boolean,
  pageHasNext: boolean,
): StopReason | null {
  if (pageItems === 0) return 'empty_page';
  if (!grew) return 'no_growth';
  if (total !== null) return collected < total ? null : 'total_reached';
  return pageHasNext ? null : 'source_done';
}

/**
 * Assemble the COMPLETE result set for a query, de-duplicating by item id.
 *
 * `seed` is the intercepted body when it is the first page of the set; pages
 * 2…N are then fetched from it. Without a seed the engine fetches the first page
 * itself. Returns the collapsed single-page response, or `null` if ANY page
 * failed — signalling the caller to leave existing storage untouched.
 */
export async function paginateAll<TResp, TItem>(
  adapter: SourceAdapter<TResp, TItem>,
  url: string,
  fetchImpl: FetchLike,
  init: RequestInit,
  seed?: ParsedPage<TResp, TItem>,
  diag?: DiagSink,
): Promise<TResp | null> {
  const items: TItem[] = [];
  const seen = new Set<string>();

  /** Append a batch, skipping ids already seen. Returns true if anything new. */
  const add = (batch: TItem[]): boolean => {
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

  // First page: the intercepted body (seed) when it is the start of the set,
  // otherwise fetched fresh.
  const first = seed ?? (await fetchPage(adapter, adapter.firstPageUrl(url), fetchImpl, init, diag));
  if (!first) {
    diag?.({
      stage: 'pagination_aborted',
      source: adapter.source,
      message: 'could not obtain the first page',
    });
    return null;
  }
  const firstRaw = first.raw;
  const total = first.total;
  const pageSizes: number[] = [first.items.length];
  add(first.items);
  let reason = nextStop(total, items.length, first.items.length, true, first.hasNext);

  // Forward pages 2…N.
  let pageNumber = 2;
  while (reason === null && pageNumber <= MAX_PAGES) {
    const page = await fetchPage(
      adapter,
      adapter.nextPageUrl(url, items, pageNumber),
      fetchImpl,
      init,
      diag,
    );
    if (!page) {
      diag?.({
        stage: 'pagination_aborted',
        source: adapter.source,
        pageNumber,
        count: items.length,
        message: `aborted at page ${pageNumber}`,
        detail: { total, reason: 'http_error', pages: pageSizes.join(',') },
      });
      return null; // hard failure — never clobber a good set
    }
    pageSizes.push(page.items.length);
    const grew = add(page.items);
    reason = nextStop(total, items.length, page.items.length, grew, page.hasNext);
    pageNumber += 1;
  }
  if (reason === null) reason = 'page_cap'; // exited via the safety cap

  // `complete` = the source confirmed we have everything. A SHORT walk (the
  // source promised more than it served) still returns its items — a new user
  // should see a partial — but is flagged so the worker won't let it clobber a
  // larger stored set (see background.ts).
  const complete = total === null || items.length >= total;
  diag?.({
    stage: 'pagination_done',
    source: adapter.source,
    count: items.length,
    pageNumber: pageNumber - 1,
    level: complete ? 'info' : 'warn',
    message: complete ? undefined : `incomplete: ${items.length}/${total}`,
    detail: { total, reason, pages: pageSizes.join(','), complete },
  });
  return adapter.rebuild(firstRaw, items);
}

// ─── URL helpers ───────────────────────────────────────────────────

const SOUK_ORIGIN = 'https://api.souk.to';

function safeUrl(url: string, base: string): URL | null {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
}

/**
 * Souk page URL: preserve EVERY original query param (status, search, and any
 * auth/token we don't model) and override only `page`. Using the URL API rather
 * than string surgery guarantees no required param is dropped.
 */
function soukPageUrl(originalUrl: string, page: number): string {
  const u = safeUrl(originalUrl, SOUK_ORIGIN) ?? new URL(SOUK_ORIGIN);
  u.searchParams.set('page', String(page));
  return u.toString();
}

interface V2Cursor {
  created_at?: number;
  filter_id?: string;
}

/**
 * V-Tools V2 keyset URL, built by string concat (not URLSearchParams) so the
 * `created_at[lt]` / `filter_id[lt]` brackets stay unencoded — exactly the form
 * the native app sends. `cursor === null` yields the newest (first) page.
 */
function vtoolsPageUrl(originalUrl: string, cursor: V2Cursor | null): string {
  const base = originalUrl.split('?')[0];
  const limitMatch = originalUrl.match(/[?&]limit=(\d+)/);
  const limit = limitMatch ? limitMatch[1] : '20';
  let url = `${base}?limit=${limit}&order=created_at,filter_id`;
  if (cursor && cursor.created_at != null) {
    url += `&created_at[lt]=${cursor.created_at}`;
    if (cursor.filter_id) url += `&filter_id[lt]=${cursor.filter_id}`;
  }
  return url;
}

// ─── Souk adapter ──────────────────────────────────────────────────

export const SOUK_ENDPOINT = 'api.souk.to/api/v1/matching_alert/web';

export const soukAdapter: SourceAdapter<SoukResponse, SoukAlert> = {
  source: 'souk',
  endpoint: SOUK_ENDPOINT,

  runKey(url) {
    const u = safeUrl(url, SOUK_ORIGIN);
    const status = u?.searchParams.get('status') ?? 'all';
    const search = u?.searchParams.get('search') ?? '';
    return `souk:${status}:${search}`;
  },

  isFirstPageRequest(url) {
    const page = safeUrl(url, SOUK_ORIGIN)?.searchParams.get('page');
    return !page || page === '1';
  },

  firstPageUrl(url) {
    return soukPageUrl(url, 1);
  },
  nextPageUrl(url, _accumulated, pageNumber) {
    return soukPageUrl(url, pageNumber);
  },

  parse(json) {
    if (!json || typeof json !== 'object') return null;
    const r = json as SoukResponse;
    if (r.type !== 'success' || !r.body) return null;
    const alerts = Array.isArray(r.body.alerts) ? r.body.alerts : [];
    // Souk exposes no reliable total; only `has_next_page` is trustworthy.
    return { raw: r, items: alerts, total: null, hasNext: r.body.pagination?.has_next_page === true };
  },

  idOf(alert) {
    return alert && typeof alert.id === 'string' && alert.id !== '' ? alert.id : null;
  },

  count(resp) {
    return resp.body?.alerts?.length ?? 0;
  },

  expectedTotal() {
    return null; // Souk reports no reliable total
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
          has_next_page: false,
        },
      },
    };
  },
};

// ─── V-Tools V2 adapter ────────────────────────────────────────────

export const VTOOLSV2_ENDPOINT = 'www.v-tools.com/api/vinted/filters/list';

export const vtoolsV2Adapter: SourceAdapter<VToolsV2Response, VToolsV2Filter> = {
  source: 'vtoolsv2',
  endpoint: VTOOLSV2_ENDPOINT,

  // Keyset pagination has no per-query params worth keying on; the endpoint is
  // a single logical list.
  runKey() {
    return 'vtoolsv2';
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
    const cursor: V2Cursor | null =
      last && last.created_at != null
        ? { created_at: last.created_at, filter_id: last.filter_id }
        : null;
    return vtoolsPageUrl(url, cursor);
  },

  parse(json) {
    if (!json || typeof json !== 'object') return null;
    const r = json as VToolsV2Response;
    if (r.success !== true || !Array.isArray(r.data?.list)) return null;
    const list = r.data!.list!;
    const pagination = r.data!.pagination;
    const total = typeof pagination?.total_entries === 'number' ? pagination.total_entries : null;
    const perPage = typeof pagination?.per_page === 'number' ? pagination.per_page : null;
    // Primary signal is `total`; when absent, a full page implies more exist
    // (mirrors the legacy `list.length >= limit` heuristic).
    const hasNext = total === null && perPage !== null ? list.length >= perPage : false;
    return { raw: r, items: list, total, hasNext };
  },

  idOf(filter) {
    return filter && typeof filter.filter_id === 'string' && filter.filter_id !== ''
      ? filter.filter_id
      : null;
  },

  count(resp) {
    return resp.data?.list?.length ?? 0;
  },

  expectedTotal(resp) {
    const total = resp.data?.pagination?.total_entries;
    return typeof total === 'number' ? total : null;
  },

  rebuild(firstRaw, items) {
    // Preserve the SOURCE's reported total (not items.length) so the worker can
    // detect a short capture and avoid clobbering a larger stored set.
    const reportedTotal = firstRaw.data?.pagination?.total_entries;
    return {
      ...firstRaw,
      data: {
        ...firstRaw.data,
        list: items,
        pagination: {
          per_page: items.length,
          total_pages: 1,
          total_entries: typeof reportedTotal === 'number' ? reportedTotal : items.length,
        },
      },
    };
  },
};

// ─── Registry ──────────────────────────────────────────────────────

/**
 * Heterogeneous registry. Each adapter is concretely typed; the array element
 * type is necessarily widened (different TResp/TItem per adapter). The engine
 * `paginateAll` stays fully generic — only this lookup table is widened.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAdapter = SourceAdapter<any, any>;

export const ADAPTERS: readonly AnyAdapter[] = [vtoolsV2Adapter, soukAdapter];

/** Match an intercepted request URL to its adapter, or `null`. */
export function matchAdapter(url: string): AnyAdapter | null {
  if (!url || typeof url !== 'string') return null;
  for (const adapter of ADAPTERS) {
    if (url.includes(adapter.endpoint)) return adapter;
  }
  return null;
}

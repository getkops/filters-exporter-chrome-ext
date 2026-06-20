import { describe, it, expect } from 'vitest';
import {
  paginateAll,
  matchAdapter,
  soukAdapter,
  vtoolsV2Adapter,
  MAX_PAGES,
  type FetchLike,
  type SoukAlert,
  type SoukResponse,
  type VToolsV2Filter,
  type VToolsV2Response,
} from './paginate';
import type { DiagInput } from './diagnostics';

// ─────────────────────────────────────────────────────────────────────────────
// Regression suite for the pagination engine. The bug it locks shut: an
// interception of page N (e.g. when the user scrolls) used to paginate forward
// from page N and drop pages 1…N-1, and the service worker then REPLACED storage
// with that incomplete set. The engine now ALWAYS rebuilds the complete set from
// the first page, and returns `null` on any partial failure so a flaky network
// never clobbers a captured set.
//
// `fetch` is injected, so these run as fast pure unit tests with canned pages.
// ─────────────────────────────────────────────────────────────────────────────

const GET: RequestInit = { method: 'GET' };

/** A mock fetch that routes by URL and records every requested URL in order. */
function mockFetch(route: (url: string) => Response): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    return route(url);
  };
  return { fetch, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Souk fixtures ─────────────────────────────────────────────────

const SOUK_URL = 'https://api.souk.to/api/v1/matching_alert/web';

function soukAlert(id: string): SoukAlert {
  return { id, name: `Alert ${id}` };
}
function soukPage(ids: string[], hasNext: boolean): SoukResponse {
  return {
    type: 'success',
    body: { alerts: ids.map(soukAlert), pagination: { has_next_page: hasNext } },
  };
}
function soukPageParam(url: string): string {
  return new URL(url).searchParams.get('page') ?? '1';
}
function soukIds(resp: SoukResponse | null): string[] {
  return (resp?.body?.alerts ?? []).map((a) => String(a.id));
}

// ─── V-Tools V2 fixtures ───────────────────────────────────────────

const VTOOLS_URL = 'https://www.v-tools.com/api/vinted/filters/list?limit=2';

function v2Filter(id: string, createdAt: number): VToolsV2Filter {
  return { filter_id: id, created_at: createdAt, name: id };
}
// `total` defaults to this page's length (a single-page account); pass the grand
// total for multi-page walks. V-Tools always reports total_entries + per_page.
function v2Page(filters: VToolsV2Filter[], total = filters.length): VToolsV2Response {
  return { success: true, data: { list: filters, pagination: { total_entries: total, per_page: 2 } } };
}
function v2Cursor(url: string): number | null {
  const m = url.match(/created_at\[lt\]=(\d+)/);
  return m ? Number(m[1]) : null;
}
function v2Ids(resp: VToolsV2Response | null): string[] {
  return (resp?.data?.list ?? []).map((f) => String(f.filter_id));
}

// ─────────────────────────────────────────────────────────────────────────────

describe('matchAdapter', () => {
  it('matches Souk and V-Tools endpoints, ignores others', () => {
    expect(matchAdapter(`${SOUK_URL}?page=1`)?.source).toBe('souk');
    expect(matchAdapter(VTOOLS_URL)?.source).toBe('vtoolsv2');
    expect(matchAdapter('https://example.com/whatever')).toBeNull();
    expect(matchAdapter('')).toBeNull();
  });
});

describe('Souk pagination', () => {
  const threePages = (url: string): Response => {
    const pages: Record<string, SoukResponse> = {
      '1': soukPage(['a1', 'a2'], true),
      '2': soukPage(['a3', 'a4'], true),
      '3': soukPage(['a5'], false),
    };
    return jsonResponse(pages[soukPageParam(url)] ?? soukPage([], false));
  };

  it('rebuilds the COMPLETE set from page 1 even when triggered by page 2 (the bug)', async () => {
    const { fetch, calls } = mockFetch(threePages);
    // The app requested page 2 (a scroll). The old engine would drop a1/a2.
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=2&status=all&search=`, fetch, GET);

    expect(soukIds(result)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    // It started from page 1, not the triggering page 2.
    expect(soukPageParam(calls[0])).toBe('1');
    // The rebuilt response is collapsed to a single terminal page.
    expect(result?.body?.pagination?.has_next_page).toBe(false);
  });

  it('rebuilds the complete set when triggered by the LAST page', async () => {
    const { fetch, calls } = mockFetch(threePages);
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=3`, fetch, GET);
    expect(soukIds(result)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(soukPageParam(calls[0])).toBe('1');
  });

  it('handles a single-page query with one fetch', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse(soukPage(['x1', 'x2'], false)));
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=1`, fetch, GET);
    expect(soukIds(result)).toEqual(['x1', 'x2']);
    expect(calls).toHaveLength(1);
  });

  it('seeds from the intercepted first page and does NOT refetch it', async () => {
    const { fetch, calls } = mockFetch(threePages);
    const seed = soukAdapter.parse(soukPage(['a1', 'a2'], true))!; // the intercepted page 1
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=1`, fetch, GET, seed);

    expect(soukIds(result)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(soukPageParam(calls[0])).toBe('2'); // page 1 came from the seed
  });

  it('returns null on partial failure so storage is never clobbered', async () => {
    const { fetch } = mockFetch((url) =>
      soukPageParam(url) === '2' ? jsonResponse({}, 500) : jsonResponse(soukPage(['a1'], true)),
    );
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=1`, fetch, GET);
    expect(result).toBeNull();
  });

  it('returns null when the first page is not a success payload', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ type: 'error', body: null }));
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=1`, fetch, GET);
    expect(result).toBeNull();
  });

  it('de-duplicates by alert id and stops when a page adds nothing new', async () => {
    // Page 2 repeats page 1's ids (server quirk) while still claiming has_next.
    const { fetch, calls } = mockFetch((url) =>
      jsonResponse(soukPageParam(url) === '1' ? soukPage(['a1', 'a2'], true) : soukPage(['a2'], true)),
    );
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=1`, fetch, GET);
    expect(soukIds(result)).toEqual(['a1', 'a2']);
    expect(calls).toHaveLength(2); // probed page 2 once, saw no growth, stopped
  });

  it('preserves every original query param (auth token, status, search) and only overrides page', async () => {
    const { fetch, calls } = mockFetch(() => jsonResponse(soukPage(['a1'], false)));
    await paginateAll(
      soukAdapter,
      `${SOUK_URL}?page=5&status=sold&search=nike&token=SECRET`,
      fetch,
      GET,
    );
    const u = new URL(calls[0]);
    expect(u.searchParams.get('page')).toBe('1'); // rebuilt from the start
    expect(u.searchParams.get('token')).toBe('SECRET'); // auth not dropped
    expect(u.searchParams.get('status')).toBe('sold');
    expect(u.searchParams.get('search')).toBe('nike');
  });
});

describe('V-Tools V2 pagination', () => {
  // Newest-first keyset walk, grand total = 3: page 1 (no cursor) → [f3@300,
  // f2@200], cursor <200 → [f1@100]. The total is reached at f1, so the empty
  // cursor <100 page is never fetched.
  const keysetPages = (url: string): Response => {
    const lt = v2Cursor(url);
    if (lt === null) return jsonResponse(v2Page([v2Filter('f3', 300), v2Filter('f2', 200)], 3));
    if (lt === 200) return jsonResponse(v2Page([v2Filter('f1', 100)], 3));
    return jsonResponse(v2Page([], 3));
  };

  it('walks the keyset until total_entries is reached, emitting unencoded cursor brackets', async () => {
    const { fetch, calls } = mockFetch(keysetPages);
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET);

    expect(v2Ids(result)).toEqual(['f3', 'f2', 'f1']);
    expect(calls[0]).not.toMatch(/created_at\[lt\]/); // first page has no cursor
    expect(calls[1]).toContain('created_at[lt]=200'); // cursor = last item of page 1
    expect(calls[1]).toContain('filter_id[lt]=f2');
    expect(calls).toHaveLength(2); // total reached at f1; empty page never fetched
    expect(result?.data?.pagination?.total_entries).toBe(3);
  });

  it('seeds a single-page account with ZERO forward fetches (the V-Tools regression)', async () => {
    // The mock throws if called: a single-page account must paginate purely from
    // the seed, because total_entries is already satisfied.
    const { fetch, calls } = mockFetch(() => {
      throw new Error('must not fetch for a single-page account');
    });
    const seed = vtoolsV2Adapter.parse(v2Page([v2Filter('f1', 100), v2Filter('f2', 200)], 2))!;
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET, seed);

    expect(v2Ids(result)).toEqual(['f1', 'f2']);
    expect(calls).toHaveLength(0);
  });

  it('seeds page 1 and fetches only the remaining cursor pages', async () => {
    const { fetch, calls } = mockFetch((url) =>
      v2Cursor(url) === 200 ? jsonResponse(v2Page([v2Filter('f1', 100)], 3)) : jsonResponse(v2Page([], 3)),
    );
    const seed = vtoolsV2Adapter.parse(v2Page([v2Filter('f3', 300), v2Filter('f2', 200)], 3))!;
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET, seed);

    expect(v2Ids(result)).toEqual(['f3', 'f2', 'f1']);
    expect(calls).toHaveLength(1); // page 1 came from the seed
    expect(calls[0]).toContain('created_at[lt]=200');
  });

  it('ignores an inbound scroll cursor and rebuilds from the newest page when not seeded', async () => {
    const { fetch, calls } = mockFetch(keysetPages);
    // A scroll fetch carrying a deep cursor — without a seed the engine must NOT
    // trust it and rebuilds from the newest page.
    const scrollUrl = `${VTOOLS_URL}&created_at[lt]=150&filter_id[lt]=fX&order=created_at,filter_id`;
    const result = await paginateAll(vtoolsV2Adapter, scrollUrl, fetch, GET);

    expect(v2Ids(result)).toEqual(['f3', 'f2', 'f1']);
    expect(v2Cursor(calls[0])).toBeNull(); // started from the newest page, not the cursor
  });

  it('returns null on partial failure', async () => {
    const { fetch } = mockFetch((url) =>
      v2Cursor(url) === 200 ? jsonResponse({}, 503) : keysetPages(url),
    );
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET);
    expect(result).toBeNull();
  });

  it('returns null when success !== true', async () => {
    const { fetch } = mockFetch(() => jsonResponse({ success: false, data: { list: [] } }));
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET);
    expect(result).toBeNull();
  });

  it('returns the partial set but flags it incomplete with total/reason/pages (the Camille case)', async () => {
    const events: DiagInput[] = [];
    // total_entries says 10, but the cursor page comes back empty → short walk.
    const { fetch } = mockFetch((url) =>
      v2Cursor(url) === 200
        ? jsonResponse(v2Page([], 10))
        : jsonResponse(v2Page([v2Filter('f3', 300), v2Filter('f2', 200)], 10)),
    );
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET, undefined, (e) => {
      events.push(e);
    });
    // A new user still sees the partial…
    expect(v2Ids(result)).toEqual(['f3', 'f2']);
    // …and the SOURCE total is preserved so the worker can detect the shortfall.
    expect(result?.data?.pagination?.total_entries).toBe(10);
    const done = events.find((e) => e.stage === 'pagination_done');
    expect(done?.detail).toMatchObject({ total: 10, reason: 'empty_page', complete: false, pages: '2,0' });
  });

  it('flags a full walk complete with reason total_reached', async () => {
    const events: DiagInput[] = [];
    const { fetch } = mockFetch((url) =>
      v2Cursor(url) === 200
        ? jsonResponse(v2Page([v2Filter('f1', 100)], 3))
        : jsonResponse(v2Page([v2Filter('f3', 300), v2Filter('f2', 200)], 3)),
    );
    const result = await paginateAll(vtoolsV2Adapter, VTOOLS_URL, fetch, GET, undefined, (e) => {
      events.push(e);
    });
    expect(v2Ids(result)).toEqual(['f3', 'f2', 'f1']);
    const done = events.find((e) => e.stage === 'pagination_done');
    expect(done?.detail).toMatchObject({ total: 3, reason: 'total_reached', complete: true });
  });
});

describe('isFirstPageRequest (drives the seed decision)', () => {
  it('Souk: true for page 1 or no page param, false for deeper pages', () => {
    expect(soukAdapter.isFirstPageRequest(`${SOUK_URL}?page=1&status=all`)).toBe(true);
    expect(soukAdapter.isFirstPageRequest(`${SOUK_URL}?status=all`)).toBe(true);
    expect(soukAdapter.isFirstPageRequest(`${SOUK_URL}?page=2`)).toBe(false);
  });

  it('V-Tools: true without a keyset cursor, false with one', () => {
    expect(vtoolsV2Adapter.isFirstPageRequest(VTOOLS_URL)).toBe(true);
    expect(vtoolsV2Adapter.isFirstPageRequest(`${VTOOLS_URL}&created_at[lt]=150`)).toBe(false);
  });
});

describe('adapter.expectedTotal (gates the satisfactory-capture check)', () => {
  it('Souk reports no total', () => {
    expect(soukAdapter.expectedTotal(soukPage(['a1'], false))).toBeNull();
  });

  it('V-Tools surfaces total_entries, null when absent', () => {
    expect(vtoolsV2Adapter.expectedTotal(v2Page([v2Filter('f1', 1)], 29))).toBe(29);
    expect(vtoolsV2Adapter.expectedTotal({ success: true, data: { list: [] } })).toBeNull();
  });
});

describe('runaway protection', () => {
  it('stops at MAX_PAGES when a source always claims more', async () => {
    let n = 0;
    const { fetch, calls } = mockFetch(() => {
      // Every page is non-empty, all-new ids, and claims has_next → never converges.
      const id = `r${n++}`;
      return jsonResponse(soukPage([id], true));
    });
    const result = await paginateAll(soukAdapter, `${SOUK_URL}?page=1`, fetch, GET);
    expect(result).not.toBeNull();
    expect(calls).toHaveLength(MAX_PAGES);
    expect(result?.body?.alerts).toHaveLength(MAX_PAGES);
  });
});

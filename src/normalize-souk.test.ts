import { describe, it, expect } from 'vitest';
import { normalizeSoukFilter, normalizeSoukResponse } from './normalize';
import type { ExportedFilter } from './generated/filter-export-schema.generated';

// ─────────────────────────────────────────────────────────────────────────────
// Exhaustive Souk.to normalizer units (ADR-040). Realistic full-response shapes
// live in parsers.test.ts (fixtures); this file drives every keyword/facet/price/
// lifecycle/envelope branch in normalizeSoukFilter + normalizeSoukResponse with
// minimal inline inputs. Keyword terms are synthetic (alpha/bravo/...).
// ─────────────────────────────────────────────────────────────────────────────

function groupsOf(f: ExportedFilter): string[][] {
  return (f.keyword_rules?.groups ?? []).map((g) => g.keywords);
}

/** A named Souk alert (enabled) with the given overrides. */
function alert(overrides: Record<string, unknown>): Record<string, unknown> {
  return { id: 'x', name: 'Alert', is_deactivated: false, ...overrides };
}

/** Normalize a named alert, asserting it wasn't skipped. */
function one(overrides: Record<string, unknown>): ExportedFilter {
  const f = normalizeSoukFilter(alert(overrides));
  if (!f) throw new Error('expected a normalized filter, got null');
  return f;
}

describe('Souk keyword mapping (keywords_version 2)', () => {
  it('maps keyword_groups_v2 1:1 to AND-groups and negative_keywords_v2 to blacklist', () => {
    const f = one({
      keyword_groups_v2: [['alpha', 'bravo'], ['charlie']],
      negative_keywords_v2: ['echo'],
    });
    expect(groupsOf(f)).toEqual([['alpha', 'bravo'], ['charlie']]);
    expect(f.blacklist_keywords).toEqual(['echo']);
  });

  it('coerces non-string keyword values to strings', () => {
    const f = one({ keyword_groups_v2: [[42, 'alpha']] });
    expect(groupsOf(f)).toEqual([['42', 'alpha']]);
  });

  it('preserves an empty inner group verbatim (Kops sanitizes it server-side)', () => {
    const f = one({ keyword_groups_v2: [['alpha'], []] });
    expect(groupsOf(f)).toEqual([['alpha'], []]);
  });

  it('drops empty-string negatives', () => {
    const f = one({ keyword_groups_v2: [['alpha']], negative_keywords_v2: ['', 'echo'] });
    expect(f.blacklist_keywords).toEqual(['echo']);
  });

  it('keeps a negatives-only alert (no includes → null rules + blacklist)', () => {
    const f = one({ negative_keywords_v2: ['echo', 'foxtrot'] });
    expect(f.keyword_rules).toBeNull();
    expect(f.blacklist_keywords).toEqual(['echo', 'foxtrot']);
  });

  it('prefers keyword_groups_v2 over a stale search_text on the same alert', () => {
    const f = one({
      keyword_groups_v2: [['real']],
      negative_keywords_v2: ['no'],
      search_text: 'should be ignored',
    });
    expect(groupsOf(f)).toEqual([['real']]);
    expect(f.blacklist_keywords).toEqual(['no']);
  });
});

describe('Souk legacy search_text fallback (keywords_version 1)', () => {
  it('splits each word into its own group and routes -word into the blacklist', () => {
    const f = one({ search_text: 'alpha bravo -charlie -delta' });
    expect(groupsOf(f)).toEqual([['alpha'], ['bravo']]);
    expect(f.blacklist_keywords).toEqual(['charlie', 'delta']);
  });

  it('handles an all-negative search_text (null rules + full blacklist)', () => {
    const f = one({ search_text: '-charlie -delta' });
    expect(f.keyword_rules).toBeNull();
    expect(f.blacklist_keywords).toEqual(['charlie', 'delta']);
  });

  it('treats a lone "-" as an include token (the len>1 guard)', () => {
    const f = one({ search_text: '- keep' });
    expect(groupsOf(f)).toEqual([['-'], ['keep']]);
    expect(f.blacklist_keywords).toEqual([]);
  });

  it('collapses repeated and surrounding whitespace', () => {
    const f = one({ search_text: '  alpha   bravo  ' });
    expect(groupsOf(f)).toEqual([['alpha'], ['bravo']]);
  });

  it('merges search_text negatives after any negative_keywords_v2', () => {
    const f = one({ search_text: 'alpha -bravo', negative_keywords_v2: ['zulu'] });
    expect(groupsOf(f)).toEqual([['alpha']]);
    expect(f.blacklist_keywords).toEqual(['zulu', 'bravo']);
  });

  it('returns null rules for a whitespace-only search_text', () => {
    const f = one({ search_text: '   ' });
    expect(f.keyword_rules).toBeNull();
    expect(f.blacklist_keywords).toEqual([]);
  });
});

describe('Souk no-keyword alert', () => {
  it('emits null rules and an empty blacklist when nothing is present', () => {
    const f = one({});
    expect(f.keyword_rules).toBeNull();
    expect(f.blacklist_keywords).toEqual([]);
  });
});

describe('Souk facets', () => {
  it('maps every facet by id + title and never sets region/rating', () => {
    const f = one({
      countries: [{ id: 16, title: 'France' }, { id: 2, title: 'Germany' }],
      catalogs: [{ id: 3661, title: 'Mobile phones' }],
      brands: [{ id: 1001, title: 'Sample Brand' }],
      colors: [{ id: 1, title: 'Black' }],
      materials: [{ id: 44, title: 'Cotton' }, { id: 45, title: 'Polyester' }],
      status: [{ id: 3, title: 'Good' }],
      video_game_platforms: [{ id: 9, title: 'Platform' }],
      models: [{ id: 4042, title: 'iPhone 11 Pro' }],
    });
    expect(f.country_ids).toEqual([16, 2]);
    expect(f.catalog_ids).toEqual([3661]);
    expect(f.brand_ids).toEqual([1001]);
    expect(f.brand_names).toEqual(['Sample Brand']);
    expect(f.color_ids).toEqual([1]);
    expect(f.color_names).toEqual(['Black']);
    expect(f.material_ids).toEqual([44, 45]);
    expect(f.material_names).toEqual(['Cotton', 'Polyester']);
    expect(f.status_ids).toEqual([3]);
    expect(f.video_game_platform_ids).toEqual([9]);
    // Souk scopes by country, never region; it exposes no video-game ratings.
    expect(f.region_isos).toEqual([]);
    expect(f.video_game_rating_ids).toEqual([]);
    // Phone: Souk exposes models (id + title); it has no storage / SIM / battery facet.
    expect(f.model_ids).toEqual([4042]);
    expect(f.model_names).toEqual(['iPhone 11 Pro']);
    expect(f.storage_names).toEqual([]);
    expect(f.sim_locks).toEqual([]);
    expect(f.battery_health_buckets).toEqual([]);
  });

  it('drops a facet entry with a non-numeric/missing id (keeps brand_ids ahead of names)', () => {
    // A brand with a title but no id → its id is dropped; Kops backfills names by id.
    const f = one({ brands: [{ id: 5, title: 'Sample Brand' }, { id: 6 }] });
    expect(f.brand_ids).toEqual([5, 6]);
    expect(f.brand_names).toEqual(['Sample Brand']); // id:6 had no title → name dropped
  });
});

describe('Souk price', () => {
  it('prefers the *_eur fields over raw', () => {
    const f = one({ price_from_eur: 5, price_to_eur: 50, price_from: 999, price_to: 999 });
    expect(f.price_min).toBe(5);
    expect(f.price_max).toBe(50);
  });

  it('falls back to raw price when *_eur is absent', () => {
    const f = one({ price_from: 5, price_to: 50 });
    expect(f.price_min).toBe(5);
    expect(f.price_max).toBe(50);
  });

  it('omits zero bounds entirely', () => {
    const f = one({ price_from_eur: 0, price_to_eur: 0 });
    expect(f.price_min).toBeUndefined();
    expect(f.price_max).toBeUndefined();
  });

  it('keeps only the set bound when the other is zero', () => {
    const f = one({ price_from_eur: 0, price_to_eur: 20 });
    expect(f.price_min).toBeUndefined();
    expect(f.price_max).toBe(20);
  });
});

describe('Souk lifecycle', () => {
  it('is_deactivated true → disabled', () => {
    expect(one({ is_deactivated: true }).enabled).toBe(false);
  });

  it('is_deactivated false → enabled', () => {
    expect(one({ is_deactivated: false }).enabled).toBe(true);
  });

  it('is_deactivated missing → enabled (anything !== true)', () => {
    const f = normalizeSoukFilter({ id: 'x', name: 'Alert' })!;
    expect(f.enabled).toBe(true);
  });

  it('autocop is always false for Souk', () => {
    expect(one({ keyword_groups_v2: [['alpha']] }).autocop).toBe(false);
  });
});

describe('Souk response envelope', () => {
  it('reports a non-success type but still parses the alerts', () => {
    const { filters, errors } = normalizeSoukResponse({
      type: 'error',
      body: { alerts: [{ id: 'a', name: 'A' }] },
    });
    expect(filters).toHaveLength(1);
    expect(errors.some((e) => e.includes('error'))).toBe(true);
  });

  it('is fatal when body.alerts is not an array', () => {
    const { filters, errors } = normalizeSoukResponse({ type: 'success', body: {} });
    expect(filters).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('is fatal when the response is not an object', () => {
    expect(normalizeSoukResponse(null).filters).toEqual([]);
    expect(normalizeSoukResponse('nope').errors[0]).toMatch(/not an object/);
  });

  it('skips unnamed alerts, reporting their index, and keeps the valid ones', () => {
    const { filters, errors } = normalizeSoukResponse({
      type: 'success',
      body: { alerts: [{ id: 'a', name: 'Keeper' }, { id: 'b', name: '   ' }] },
    });
    expect(filters.map((f) => f.name)).toEqual(['Keeper']);
    expect(errors.some((e) => e.includes('index 1'))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeVToolsV2Filter, normalizeVToolsV2Response, VTOOLSV2_REGIONS } from './normalize';
import type { ExportedFilter } from './generated/filter-export-schema.generated';

// ─────────────────────────────────────────────────────────────────────────────
// Exhaustive V-Tools V2 normalizer units (ADR-040). The component model is the
// crux of the refactor: each include component is its OWN AND-group (no merge),
// which the old CSV/V1 path could not express. Realistic full-response shapes
// live in parsers.test.ts (fixtures). Keyword terms are synthetic.
// ─────────────────────────────────────────────────────────────────────────────

function groupsOf(f: ExportedFilter): string[][] {
  return (f.keyword_rules?.groups ?? []).map((g) => g.keywords);
}

/** A V-Tools V2 component. */
function comp(operator: string, type: string, value: unknown): Record<string, unknown> {
  return { operator, type, value };
}

/** A named, enabled V-Tools filter with the given component list / overrides. */
function vt(overrides: Record<string, unknown>): Record<string, unknown> {
  return { name: 'Filter', enabled: true, components: [], ...overrides };
}

function one(overrides: Record<string, unknown>): ExportedFilter {
  const f = normalizeVToolsV2Filter(vt(overrides));
  if (!f) throw new Error('expected a normalized filter, got null');
  return f;
}

/** Sugar: a filter built from just its components. */
function withComponents(...components: unknown[]): ExportedFilter {
  return one({ components });
}

describe('V-Tools V2 keyword operators', () => {
  it('contains → one AND-group', () => {
    expect(groupsOf(withComponents(comp('contains', 'keyword', ['alpha'])))).toEqual([['alpha']]);
  });

  it('strict_contains with one value → a single AND-group', () => {
    expect(groupsOf(withComponents(comp('strict_contains', 'keyword', ['alpha'])))).toEqual([['alpha']]);
  });

  it('strict_contains with multiple values → one AND-group PER value (the fix)', () => {
    // "strict" = every word must appear: (alpha AND bravo AND charlie),
    // NOT a single OR-group (alpha OR bravo OR charlie).
    expect(
      groupsOf(withComponents(comp('strict_contains', 'keyword', ['alpha', 'bravo', 'charlie']))),
    ).toEqual([['alpha'], ['bravo'], ['charlie']]);
  });

  it('contains with multiple values → a single OR-group', () => {
    expect(groupsOf(withComponents(comp('contains', 'keyword', ['alpha', 'bravo'])))).toEqual([
      ['alpha', 'bravo'],
    ]);
  });

  it('mixes contains (OR-group) with strict_contains (AND-split), all AND-combined', () => {
    const f = withComponents(
      comp('contains', 'keyword', ['alpha', 'bravo']),
      comp('strict_contains', 'keyword', ['charlie', 'delta']),
    );
    // (alpha OR bravo) AND (charlie) AND (delta)
    expect(groupsOf(f)).toEqual([['alpha', 'bravo'], ['charlie'], ['delta']]);
  });

  it('multiple separate include components → multiple groups, NEVER merged', () => {
    const f = withComponents(
      comp('contains', 'keyword', ['alpha']),
      comp('contains', 'keyword', ['bravo']),
      comp('strict_contains', 'keyword', ['charlie']),
    );
    expect(groupsOf(f)).toEqual([['alpha'], ['bravo'], ['charlie']]);
  });

  it('ncontains and strict_ncontains both flatten into blacklist_keywords', () => {
    const f = withComponents(
      comp('ncontains', 'keyword', ['echo']),
      comp('strict_ncontains', 'keyword', ['foxtrot']),
    );
    expect(f.keyword_rules).toBeNull();
    expect(f.blacklist_keywords).toEqual(['echo', 'foxtrot']);
  });

  it('drops a keyword component with an unknown or missing operator', () => {
    const f = withComponents(
      comp('equals', 'keyword', ['ignored']),
      { type: 'keyword', value: ['alsoIgnored'] }, // no operator
    );
    expect(f.keyword_rules).toBeNull();
    expect(f.blacklist_keywords).toEqual([]);
  });

  it('preserves an empty include component as an empty group (Kops sanitizes it)', () => {
    expect(groupsOf(withComponents(comp('contains', 'keyword', [])))).toEqual([[]]);
  });

  it('coerces non-string keyword values to strings', () => {
    expect(groupsOf(withComponents(comp('contains', 'keyword', [42, 'alpha'])))).toEqual([
      ['42', 'alpha'],
    ]);
  });

  it('preserves include order and blacklist order across interleaved operators', () => {
    const f = withComponents(
      comp('contains', 'keyword', ['alpha']),
      comp('ncontains', 'keyword', ['echo']),
      comp('strict_contains', 'keyword', ['bravo']),
      comp('strict_ncontains', 'keyword', ['foxtrot']),
    );
    expect(groupsOf(f)).toEqual([['alpha'], ['bravo']]);
    expect(f.blacklist_keywords).toEqual(['echo', 'foxtrot']);
  });
});

describe('V-Tools V2 facets', () => {
  it('maps id (value.value) + name (value.title) for every facet type', () => {
    const f = withComponents(
      comp('contains', 'catalog', [{ title: 'Shoes', value: 1231 }]),
      comp('contains', 'brand', [{ title: 'Brand A', value: 12 }, { title: 'Brand B', value: 7 }]),
      comp('contains', 'color', [{ title: 'Grey', value: 3 }]),
      comp('contains', 'status', [{ title: 'New', value: 1 }]),
      comp('contains', 'material', [{ title: 'Cotton', value: 44 }]),
      comp('contains', 'country', [{ value: 16 }]),
    );
    expect(f.catalog_ids).toEqual([1231]);
    expect(f.brand_ids).toEqual([12, 7]);
    expect(f.brand_names).toEqual(['Brand A', 'Brand B']);
    expect(f.color_ids).toEqual([3]);
    expect(f.color_names).toEqual(['Grey']);
    expect(f.status_ids).toEqual([1]);
    expect(f.material_ids).toEqual([44]);
    expect(f.material_names).toEqual(['Cotton']);
    expect(f.country_ids).toEqual([16]);
  });

  it('maps video-game platform + rating ids', () => {
    const f = withComponents(
      comp('contains', 'video_game_platform', [{ title: 'P', value: 1261 }]),
      comp('contains', 'video_game_rating', [{ title: 'E', value: 170 }]),
    );
    expect(f.video_game_platform_ids).toEqual([1261]);
    expect(f.video_game_rating_ids).toEqual([170]);
  });

  it('uses the FIRST occurrence when a facet type repeats', () => {
    const f = withComponents(
      comp('contains', 'brand', [{ title: 'First', value: 1 }]),
      comp('contains', 'brand', [{ title: 'Second', value: 2 }]),
    );
    expect(f.brand_ids).toEqual([1]);
    expect(f.brand_names).toEqual(['First']);
  });

  it('keeps an id whose title is missing (name dropped; Kops backfills by id)', () => {
    const f = withComponents(comp('contains', 'brand', [{ value: 5 }, { title: 'Named', value: 6 }]));
    expect(f.brand_ids).toEqual([5, 6]);
    expect(f.brand_names).toEqual(['Named']);
  });
});

describe('V-Tools V2 phone dimensions (catalog 3661)', () => {
  it('extracts model_ids from brand_collection + storage/sim from title; battery stays empty', () => {
    const f = withComponents(
      comp('contains', 'catalog', [{ title: 'Téléphones portables', value: 3661 }]),
      comp('contains', 'brand_collection', [{ title: '', value: 4041 }, { title: '', value: 4042 }]),
      comp('contains', 'internal_memory_capacity', [{ title: '128 Go', value: 1305 }, { title: '256 Go', value: 1306 }]),
      comp('contains', 'sim_lock', [{ title: 'Non', value: 1312 }, { title: 'Oui', value: 1313 }]),
    );
    expect(f.model_ids).toEqual([4041, 4042]);
    // V-Tools sends empty model titles → model_names stays [] (Kops resolves by id).
    expect(f.model_names).toEqual([]);
    expect(f.storage_names).toEqual(['128 Go', '256 Go']);
    expect(f.sim_locks).toEqual(['Non', 'Oui']);
    expect(f.battery_health_buckets).toEqual([]);
  });

  it('leaves every phone dimension empty when no phone components are present', () => {
    const f = withComponents(comp('contains', 'keyword', ['alpha']));
    expect(f.model_ids).toEqual([]);
    expect(f.model_names).toEqual([]);
    expect(f.storage_names).toEqual([]);
    expect(f.sim_locks).toEqual([]);
    expect(f.battery_health_buckets).toEqual([]);
  });
});

describe('V-Tools V2 regions', () => {
  it('resolves known region IDs to ISO codes', () => {
    const f = withComponents(comp('contains', 'region', ['reg_IezcaEzJsV7i80r1tt4EK']));
    expect(f.region_isos).toEqual(['FR']);
  });

  it('falls back to the raw ID for unknown/future regions', () => {
    const f = withComponents(comp('contains', 'region', ['reg_unknown_future']));
    expect(f.region_isos).toEqual(['reg_unknown_future']);
  });

  it('maps multiple regions, mixing known + unknown', () => {
    const f = withComponents(
      comp('contains', 'region', ['reg_IezcaEzJsV7i80r1tt4EK', 'reg_SxvmyclwnGwJU22Yi0L4l', 'reg_x']),
    );
    expect(f.region_isos).toEqual(['FR', 'DE', 'reg_x']);
    expect(VTOOLSV2_REGIONS['reg_SxvmyclwnGwJU22Yi0L4l']).toBe('DE');
  });

  it('resolves the HU/RO/SK regions added from the V-Tools regions list', () => {
    expect(VTOOLSV2_REGIONS['reg_oDzN69ri9CETdPqD7JnnK']).toBe('HU');
    expect(VTOOLSV2_REGIONS['reg_uBe5PkXuoVz8e2xLc44oT']).toBe('RO');
    expect(VTOOLSV2_REGIONS['reg_uxkr8QRsZIC932Svc9MeG']).toBe('SK');
    const f = withComponents(
      comp('contains', 'region', ['reg_uxkr8QRsZIC932Svc9MeG', 'reg_oDzN69ri9CETdPqD7JnnK', 'reg_uBe5PkXuoVz8e2xLc44oT']),
    );
    expect(f.region_isos).toEqual(['SK', 'HU', 'RO']);
  });
});

describe('V-Tools V2 price', () => {
  it('maps between value.min / value.max', () => {
    const f = withComponents(comp('between', 'price', { min: 12, max: 100 }));
    expect(f.price_min).toBe(12);
    expect(f.price_max).toBe(100);
  });

  it('omits a 0/0 (unbounded) price', () => {
    const f = withComponents(comp('between', 'price', { min: 0, max: 0 }));
    expect(f.price_min).toBeUndefined();
    expect(f.price_max).toBeUndefined();
  });

  it('omits price entirely when there is no price component', () => {
    const f = withComponents(comp('contains', 'keyword', ['alpha']));
    expect(f.price_min).toBeUndefined();
    expect(f.price_max).toBeUndefined();
  });

  it('keeps only the set bound (min present, max 0)', () => {
    const f = withComponents(comp('between', 'price', { min: 12, max: 0 }));
    expect(f.price_min).toBe(12);
    expect(f.price_max).toBeUndefined();
  });
});

describe('V-Tools V2 lifecycle', () => {
  it('enabled maps from === true', () => {
    expect(one({ enabled: true }).enabled).toBe(true);
    expect(one({ enabled: false }).enabled).toBe(false);
    expect(normalizeVToolsV2Filter({ name: 'x' })!.enabled).toBe(false);
  });

  it('boosted maps to autocop', () => {
    expect(one({ boosted: true }).autocop).toBe(true);
    expect(one({ boosted: false }).autocop).toBe(false);
    expect(normalizeVToolsV2Filter({ name: 'x' })!.autocop).toBe(false);
  });
});

describe('V-Tools V2 resilience', () => {
  it('produces an empty filter (null rules) when there are no components', () => {
    const f = one({ components: [] });
    expect(f.keyword_rules).toBeNull();
    expect(f.brand_ids).toEqual([]);
  });

  it('skips null / non-object / typeless components', () => {
    const f = withComponents(
      null,
      'not-an-object',
      { operator: 'contains', type: '', value: ['skipped'] },
      comp('contains', 'keyword', ['alpha']),
    );
    expect(groupsOf(f)).toEqual([['alpha']]);
  });

  it('returns null for a blank or missing name', () => {
    expect(normalizeVToolsV2Filter({ name: '  ', enabled: true })).toBeNull();
    expect(normalizeVToolsV2Filter({ enabled: true })).toBeNull();
  });
});

describe('V-Tools V2 ISBNs', () => {
  it('reads ISBNs from a top-level field', () => {
    const f = normalizeVToolsV2Filter({ name: 'books', enabled: true, isbns: ['9781234567897'] })!;
    expect(f.isbn_list).toEqual(['9781234567897']);
  });

  it('reads ISBNs from an isbn component', () => {
    const f = withComponents(comp('contains', 'isbn', ['9781234567897']));
    expect(f.isbn_list).toEqual(['9781234567897']);
  });
});

describe('V-Tools V2 response envelope', () => {
  it('reports a non-success flag but still parses the list', () => {
    const { filters, errors } = normalizeVToolsV2Response({
      success: false,
      data: { list: [{ name: 'A', enabled: true }] },
    });
    expect(filters).toHaveLength(1);
    expect(errors.some((e) => e.includes('success'))).toBe(true);
  });

  it('is fatal when data.list is not an array', () => {
    const { filters, errors } = normalizeVToolsV2Response({ success: true, data: {} });
    expect(filters).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('is fatal when the response is not an object', () => {
    expect(normalizeVToolsV2Response(null).filters).toEqual([]);
    expect(normalizeVToolsV2Response(42).errors[0]).toMatch(/not an object/);
  });
});

describe('normalizeVToolsV2Response — expectedTotal (drives the anti-regression guard)', () => {
  const filter = { name: 'A', enabled: true, components: [] };

  it('surfaces the reported total_entries', () => {
    const resp = { success: true, data: { list: [filter], pagination: { total_entries: 444, per_page: 20 } } };
    expect(normalizeVToolsV2Response(resp).expectedTotal).toBe(444);
  });

  it('is null when pagination/total is absent', () => {
    const resp = { success: true, data: { list: [filter] } };
    expect(normalizeVToolsV2Response(resp).expectedTotal).toBeNull();
  });
});

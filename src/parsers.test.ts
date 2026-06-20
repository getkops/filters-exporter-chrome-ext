import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeSoukResponse, normalizeVToolsV2Response } from './normalize';
import {
  validateFilterExport,
  FILTER_EXPORT_SCHEMA_VERSION,
  type ExportedFilter,
  type FilterExportSource,
} from './generated/filter-export-schema.generated';

// ─────────────────────────────────────────────────────────────────────────────
// Realistic, fixture-driven end-to-end suite (ADR-040): full V-Tools/Souk API
// responses → normalized ExportedFilter[] → a schema-valid envelope.
//
// Exhaustive per-branch edge cases live in the focused unit files so each
// behavior has ONE canonical home:
//   • normalize-souk.test.ts   — every Souk keyword/facet/price/lifecycle branch
//   • normalize-vtools.test.ts — every V-Tools V2 component/operator branch
//   • schema.test.ts           — the vendored SSOT validator's accept/reject rules
//
// Fixtures are FULLY SYNTHETIC + anonymized (see scripts/anonymize-export.mjs);
// real captures stay gitignored as example_*.json.
// ─────────────────────────────────────────────────────────────────────────────

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(repoRoot, 'fixtures', name), 'utf8'));
}

/** Flatten a filter's keyword groups into a string[][] for assertions. */
function groupsOf(filter: ExportedFilter): string[][] {
  return (filter.keyword_rules?.groups ?? []).map((g) => g.keywords);
}

/** Wrap normalized filters into an envelope and run the SSOT validator. */
function expectValidEnvelope(filters: ExportedFilter[], source: FilterExportSource): void {
  const envelope = {
    schema_version: FILTER_EXPORT_SCHEMA_VERSION,
    source,
    exported_at: new Date().toISOString(),
    filters,
  };
  expect(() => validateFilterExport(envelope)).not.toThrow();
}

describe('Souk normalizer (keyword groups + facets)', () => {
  const fixture = loadFixture('souk-keyword-groups.json');
  const { filters, errors } = normalizeSoukResponse(fixture);

  it('parses without fatal errors and produces filters', () => {
    expect(errors).toEqual([]);
    expect(filters.length).toBe(2);
  });

  it('maps keyword_groups_v2 into AND-groups + negatives', () => {
    const a = filters.find((f) => f.name === 'Example phone alert')!;
    expect(a).toBeDefined();
    expect(groupsOf(a)).toEqual([
      ['alpha', 'bravo'],
      ['charlie', 'delta'],
    ]);
    expect(a.blacklist_keywords).toEqual(['echo']);
  });

  it('maps facets + price + scopes by country (never region)', () => {
    const a = filters.find((f) => f.name === 'Example phone alert')!;
    expect(a.catalog_ids).toEqual([3661]);
    expect(a.brand_ids).toEqual([1001]);
    expect(a.brand_names).toEqual(['Sample Brand']);
    expect(a.status_ids).toEqual([3]);
    expect(a.color_ids).toEqual([1]);
    expect(a.price_min).toBe(2);
    expect(a.price_max).toBe(20);
    expect(a.country_ids.length).toBeGreaterThan(0);
    expect(a.region_isos).toEqual([]);
  });

  it('emits null keyword_rules and omits price when an alert has neither', () => {
    const a = filters.find((f) => f.name === 'Example no-keyword alert')!;
    expect(a.keyword_rules).toBeNull();
    expect(a.blacklist_keywords).toEqual([]);
    expect(a.price_min).toBeUndefined();
    expect(a.price_max).toBeUndefined();
  });

  it('produces a valid export envelope', () => {
    expectValidEnvelope(filters, 'souk');
  });
});

describe('Souk legacy search_text fallback (fixture)', () => {
  const { filters } = normalizeSoukResponse(loadFixture('souk-legacy-search-text.json'));

  it('splits search_text into per-word groups and strips "-" into blacklist', () => {
    expect(filters).toHaveLength(1);
    expect(groupsOf(filters[0])).toEqual([['alpha'], ['bravo']]);
    expect(filters[0].blacklist_keywords).toEqual(['charlie', 'delta']);
  });
});

describe('V-Tools V2 normalizer (facets)', () => {
  const fixture = loadFixture('vtools-facets.json');
  const { filters, errors } = normalizeVToolsV2Response(fixture);

  it('parses without fatal errors and produces filters', () => {
    expect(errors).toEqual([]);
    expect(filters.length).toBe(3);
  });

  it('maps facet components + autocop on the rich filter', () => {
    const rich = filters.find((f) => f.name === 'Example rich filter')!;
    expect(rich.brand_names).toEqual(['Sample Brand A', 'Sample Brand B']);
    expect(rich.brand_ids).toEqual([12, 7]);
    expect(rich.color_ids).toEqual([3, 12]);
    expect(rich.status_ids).toEqual([1, 2]);
    expect(rich.price_min).toBe(12);
    expect(rich.price_max).toBe(100);
    expect(rich.autocop).toBe(true);
    expect(groupsOf(rich).flat()).toContain('alpha');
  });

  it('maps video-game platform + rating ids', () => {
    const games = filters.find((f) => f.name === 'Example games filter')!;
    expect(games.video_game_platform_ids).toEqual([1261, 1262]);
    expect(games.video_game_rating_ids).toEqual([171, 170]);
  });

  it('omits price when min/max are 0', () => {
    const zero = filters.find((f) => f.name === 'Example zero-price filter')!;
    expect(zero.price_min).toBeUndefined();
    expect(zero.price_max).toBeUndefined();
    expect(zero.enabled).toBe(false);
  });

  it('produces a valid export envelope', () => {
    expectValidEnvelope(filters, 'vtools');
  });
});

describe('V-Tools V2 normalizer (keyword operators + regions)', () => {
  const { filters } = normalizeVToolsV2Response(loadFixture('vtools-keyword-operators.json'));
  const f = filters[0];

  it('maps contains→one OR-group and strict_contains→one AND-group per word (no merge)', () => {
    // contains["alpha"] → [alpha]; contains["bravo","charlie"] → OR-group;
    // strict_contains["delta","golf"] → two AND-groups (delta AND golf).
    expect(groupsOf(f)).toEqual([['alpha'], ['bravo', 'charlie'], ['delta'], ['golf']]);
  });

  it('flattens ncontains + strict_ncontains into blacklist_keywords', () => {
    expect(f.blacklist_keywords).toEqual(['echo', 'foxtrot']);
  });

  it('resolves region IDs to ISO codes, raw-id fallback for unknowns', () => {
    expect(f.region_isos).toEqual(['FR', 'reg_unknown_future']);
  });

  it('produces a valid export envelope', () => {
    expectValidEnvelope(filters, 'vtools');
  });
});

import { describe, it, expect } from 'vitest';
import {
  validateFilterExport,
  exportedFilterSchema,
  filterExportEnvelopeSchema,
  FILTER_EXPORT_SCHEMA_VERSION,
} from './generated/filter-export-schema.generated';

// ─────────────────────────────────────────────────────────────────────────────
// Contract tests for the vendored SSOT (ADR-040). This is the schema the
// extension stamps onto every export and the Kops importer validates against —
// a drift-check gate keeps this file byte-identical to its schema source. These
// tests pin the validator's accept/reject behavior so a bad hand-edit or a
// drifted regeneration fails loudly instead of shipping a malformed envelope.
// ─────────────────────────────────────────────────────────────────────────────

/** A fully-populated, schema-valid ExportedFilter; override per case. */
function validFilter(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Filter',
    enabled: true,
    autocop: false,
    catalog_ids: [],
    brand_ids: [],
    brand_names: [],
    size_ids: [],
    size_names: [],
    status_ids: [],
    color_ids: [],
    color_names: [],
    material_ids: [],
    material_names: [],
    country_ids: [],
    region_isos: [],
    video_game_platform_ids: [],
    video_game_rating_ids: [],
    isbn_list: [],
    keyword_rules: null,
    blacklist_keywords: [],
    ...overrides,
  };
}

function validEnvelope(filters: unknown[] = [validFilter()]): Record<string, unknown> {
  return {
    schema_version: FILTER_EXPORT_SCHEMA_VERSION,
    source: 'vtools',
    exported_at: '2020-01-01T00:00:00Z',
    filters,
  };
}

describe('FILTER_EXPORT_SCHEMA_VERSION', () => {
  it('is the v1 anchor the extension stamps and Kops accepts', () => {
    expect(FILTER_EXPORT_SCHEMA_VERSION).toBe(1);
  });
});

describe('validateFilterExport', () => {
  it('accepts a valid envelope and returns the parsed value', () => {
    const env = validEnvelope();
    const parsed = validateFilterExport(env);
    expect(parsed.schema_version).toBe(FILTER_EXPORT_SCHEMA_VERSION);
    expect(parsed.filters).toHaveLength(1);
  });

  it('rejects a mismatched schema_version with an actionable message', () => {
    expect(() => validateFilterExport({ ...validEnvelope(), schema_version: 999 })).toThrow(
      /schema_version 999/,
    );
  });

  it('rejects an unknown source enum', () => {
    expect(() => validateFilterExport({ ...validEnvelope(), source: 'ebay' })).toThrow();
  });

  it('rejects a non-object payload', () => {
    expect(() => validateFilterExport(null)).toThrow();
    expect(() => validateFilterExport('a string')).toThrow();
  });

  it('rejects an envelope whose filter is missing a required array field', () => {
    const { brand_ids: _omit, ...withoutBrandIds } = validFilter();
    expect(() => validateFilterExport(validEnvelope([withoutBrandIds]))).toThrow();
  });

  it('accepts an empty filters array (the SCHEMA allows it; the server enforces non-empty)', () => {
    // The Zod contract is structural; "at least one filter" is a server policy
    // (ParseExportFilters returns 400), not a schema rule. Locking this keeps the
    // two layers' responsibilities distinct.
    expect(() => validateFilterExport(validEnvelope([]))).not.toThrow();
  });
});

describe('exportedFilterSchema', () => {
  it('accepts full CNF keyword rules', () => {
    const f = validFilter({
      keyword_rules: { groups: [{ keywords: ['alpha', 'bravo'] }, { keywords: ['charlie'] }] },
      blacklist_keywords: ['echo'],
    });
    expect(() => exportedFilterSchema.parse(f)).not.toThrow();
  });

  it('treats keyword_rules as nullable', () => {
    expect(() => exportedFilterSchema.parse(validFilter({ keyword_rules: null }))).not.toThrow();
  });

  it('treats price_min / price_max as optional but typed', () => {
    expect(() => exportedFilterSchema.parse(validFilter())).not.toThrow();
    expect(() => exportedFilterSchema.parse(validFilter({ price_min: 5, price_max: 50 }))).not.toThrow();
    expect(() => exportedFilterSchema.parse(validFilter({ price_min: 'cheap' }))).toThrow();
  });

  it('rejects a non-string keyword inside a group', () => {
    const f = validFilter({ keyword_rules: { groups: [{ keywords: [123] }] } });
    expect(() => exportedFilterSchema.parse(f)).toThrow();
  });
});

describe('filterExportEnvelopeSchema', () => {
  it('requires schema_version, source, exported_at, and filters', () => {
    expect(() => filterExportEnvelopeSchema.parse(validEnvelope())).not.toThrow();
    const { exported_at: _omit, ...withoutTimestamp } = validEnvelope();
    expect(() => filterExportEnvelopeSchema.parse(withoutTimestamp)).toThrow();
  });
});

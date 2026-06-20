/**
 * normalize.ts — Pure normalizers for V-Tools V2 and Souk.to filter responses.
 *
 * This module intentionally imports ONLY types/values from the vendored
 * filter-export schema (which depends solely on `zod`). It MUST NOT import
 * `chrome` or any extension-runtime API, so it is unit-testable under Node
 * (vitest) and reusable from the service worker (background.ts).
 *
 * The canonical export contract is `ExportedFilter` (ADR-040). Every array
 * field is always populated (`[]` when empty) because the Zod schema requires
 * arrays, not `undefined`. Optional numeric fields (`price_min`/`price_max`)
 * are omitted entirely when 0/absent.
 */

import type {
  ExportedFilter,
  KeywordRules,
} from './generated/filter-export-schema.generated';

// ─── Shared helpers ────────────────────────────────────────────────

/** Return the input if it is an array, otherwise an empty array. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** A non-empty, trimmed string or null. */
function trimmedName(value: unknown): string | null {
  if (typeof value !== 'string') {
    if (value == null) return null;
    const s = String(value).trim();
    return s === '' ? null : s;
  }
  const s = value.trim();
  return s === '' ? null : s;
}

/**
 * Coerce a value into a finite number, or null. Accepts numbers and numeric
 * strings; everything else (null, '', NaN, objects) becomes null.
 */
function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Extract numeric IDs from an array of objects keyed by `key` (default 'id').
 * Non-numeric/missing entries are dropped.
 */
function numberIds(arr: unknown, key = 'id'): number[] {
  return asArray<Record<string, unknown>>(arr)
    .map((item) => (item == null ? null : toNumberOrNull(item[key])))
    .filter((n): n is number => n !== null);
}

/**
 * Extract string labels from an array of objects keyed by `key`.
 * Null/missing entries are dropped; everything else is stringified.
 */
function stringLabels(arr: unknown, key: string): string[] {
  return asArray<Record<string, unknown>>(arr)
    .map((item) => (item == null ? null : item[key]))
    .filter((v): v is unknown => v != null)
    .map((v) => String(v));
}

/**
 * Extract ISBNs as a string[]. Tolerates a plain string/number array, or an
 * array of objects keyed by a probable field, or a single scalar.
 */
function toIsbnList(value: unknown): string[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  const KEYS = ['isbn', 'value', 'data', 'code', 'id'];
  return arr
    .map((item): string => {
      if (item == null) return '';
      if (typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        for (const k of KEYS) {
          if (rec[k] != null) return String(rec[k]);
        }
        return '';
      }
      return String(item);
    })
    .filter((s) => s !== '');
}

/**
 * Base `ExportedFilter` with every required array field defaulted to `[]`,
 * keyword rules to `null`, and booleans to `false`. Normalizers spread their
 * extracted facets over this so no field is ever left `undefined`.
 */
function emptyExportedFilter(name: string): ExportedFilter {
  return {
    name,
    enabled: false,
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
  };
}

/** Apply price_min/price_max only when present and non-zero. */
function applyPrice(
  filter: ExportedFilter,
  min: unknown,
  max: unknown,
): void {
  const pmin = toNumberOrNull(min);
  const pmax = toNumberOrNull(max);
  if (pmin !== null && pmin !== 0) filter.price_min = pmin;
  if (pmax !== null && pmax !== 0) filter.price_max = pmax;
}

// ─── V-Tools V2 region table ───────────────────────────────────────

/**
 * V-Tools V2 region ID → ISO code lookup.
 * V2 region titles from the API are i18n tokens ($(i18n){region_fr_title}),
 * so they are unusable; we resolve the stable region IDs to ISO codes here.
 * Unknown/future region IDs fall back to the raw ID (see normalizeVToolsV2Filter).
 */
export const VTOOLSV2_REGIONS: Record<string, string> = {
  reg_2KgHAL52ejLKnRcx5bABk: 'AT',
  reg_5iGDVjVMgtP1qCATKPMgE: 'SE',
  reg_7k2XtAN7ITVXwMau3L4OV: 'LU',
  reg_CUjUNaAra57G7kxCETXQi: 'ES',
  reg_IezcaEzJsV7i80r1tt4EK: 'FR',
  reg_NrN16I4lnsMYYq9lgTuX0: 'SI',
  reg_O4xzVWJ2hKAYZ8EbhBemm: 'DK',
  reg_PYMWsFJcmafUijOHP7u3T: 'PL',
  reg_SxvmyclwnGwJU22Yi0L4l: 'DE',
  reg_VkmQJGec1MxkLR1qnsVFp: 'NL',
  reg_YrXXUOW4Vwt8o3QySUamB: 'IT',
  reg_ZuyCwDKdcAZLWuDlX2AZ9: 'HR',
  reg_bamDITFPiTc0db2mp0I3O: 'FI',
  reg_hLdpqsKilRnoTyAD7kgGd: 'LT',
  reg_hbsUPfIMrl3aAdg5rcT78: 'IE',
  reg_j9aILAwgWKpOljtCRE5QO: 'CZ',
  reg_kNBKTCh4isES5pHEziYCu: 'BE',
  reg_klRNv4mJo4yIpzBVU8dHH: 'GB',
  reg_mijK7mEf0YR5zRPLgckFz: 'GR',
  reg_oA7keE3ctUtgQgwFbmaqu: 'PT',
};

// ─── Result type ───────────────────────────────────────────────────

export interface NormalizeResult {
  filters: ExportedFilter[];
  errors: string[];
}

// ─── Souk.to normalizer ────────────────────────────────────────────

/**
 * Normalize a single Souk.to `alert` (from `body.alerts`) into an
 * `ExportedFilter`, or null if the alert has no usable name.
 *
 * Keyword mapping:
 *  - `keyword_rules.groups` = `keyword_groups_v2` with each inner array becoming
 *    one AND-group `{ keywords: [...] }`.
 *  - `blacklist_keywords` = `negative_keywords_v2` ?? [].
 *  - Legacy fallback: if `keyword_groups_v2` is absent/empty but `search_text`
 *    is a non-empty string, split on whitespace; each word becomes its own
 *    group, except words starting with `-` (len>1) which go to the blacklist
 *    with the leading `-` stripped.
 */
export function normalizeSoukFilter(alert: unknown): ExportedFilter | null {
  if (!alert || typeof alert !== 'object') return null;
  const a = alert as Record<string, unknown>;

  const name = trimmedName(a.name);
  if (name === null) return null;

  const filter = emptyExportedFilter(name);

  // Status / lifecycle
  filter.enabled = a.is_deactivated !== true;
  filter.autocop = false;

  // Facets (Souk uses `title` for labels, `id` for IDs)
  filter.country_ids = numberIds(a.countries);
  filter.catalog_ids = numberIds(a.catalogs);
  filter.brand_ids = numberIds(a.brands);
  filter.brand_names = stringLabels(a.brands, 'title');
  filter.size_ids = numberIds(a.sizes);
  filter.size_names = stringLabels(a.sizes, 'title');
  filter.color_ids = numberIds(a.colors);
  filter.color_names = stringLabels(a.colors, 'title');
  filter.material_ids = numberIds(a.materials);
  filter.material_names = stringLabels(a.materials, 'title');
  filter.status_ids = numberIds(a.status);
  filter.video_game_platform_ids = numberIds(a.video_game_platforms);
  filter.isbn_list = toIsbnList(a.isbns);
  // Souk scopes by country_ids, not regions; no video-game ratings exposed.
  filter.region_isos = [];
  filter.video_game_rating_ids = [];

  // Price: prefer EUR-normalized fields, fall back to raw.
  applyPrice(
    filter,
    a.price_from_eur ?? a.price_from,
    a.price_to_eur ?? a.price_to,
  );

  // Keyword rules.
  const groupsV2 = asArray<unknown>(a.keyword_groups_v2);
  const negatives = asArray<unknown>(a.negative_keywords_v2)
    .map((k) => String(k))
    .filter((k) => k !== '');

  if (groupsV2.length > 0) {
    const groups = groupsV2.map((inner) => ({
      keywords: asArray<unknown>(inner).map((k) => String(k)),
    }));
    filter.keyword_rules = { groups };
    filter.blacklist_keywords = negatives;
  } else if (typeof a.search_text === 'string' && a.search_text.trim() !== '') {
    // Legacy fallback: split search_text into per-word groups + blacklist.
    const includeGroups: KeywordRules['groups'] = [];
    const blacklist = [...negatives];
    for (const word of a.search_text.trim().split(/\s+/)) {
      if (word.startsWith('-') && word.length > 1) {
        blacklist.push(word.slice(1));
      } else if (word !== '') {
        includeGroups.push({ keywords: [word] });
      }
    }
    filter.keyword_rules = includeGroups.length > 0 ? { groups: includeGroups } : null;
    filter.blacklist_keywords = blacklist;
  } else {
    filter.keyword_rules = null;
    filter.blacklist_keywords = negatives;
  }

  return filter;
}

/** Normalize a full Souk.to API response (`{ type, body: { alerts } }`). */
export function normalizeSoukResponse(response: unknown): NormalizeResult {
  const errors: string[] = [];
  if (!response || typeof response !== 'object') {
    return { filters: [], errors: ['Souk.to response is not an object'] };
  }
  const r = response as Record<string, unknown>;
  if (r.type !== 'success') {
    errors.push(`Souk.to API returned type: ${String(r.type ?? 'undefined')}`);
  }
  const body = r.body as Record<string, unknown> | undefined;
  const alerts = body?.alerts;
  if (!Array.isArray(alerts)) {
    errors.push('Souk.to response.body.alerts is not an array');
    return { filters: [], errors };
  }

  const filters: ExportedFilter[] = [];
  alerts.forEach((raw, index) => {
    const normalized = normalizeSoukFilter(raw);
    if (normalized) filters.push(normalized);
    else errors.push(`Souk.to alert at index ${index} skipped (invalid or unnamed)`);
  });
  return { filters, errors };
}

// ─── V-Tools V2 normalizer ─────────────────────────────────────────

const KW_INCLUDE_OPS = new Set(['contains', 'strict_contains']);
const KW_EXCLUDE_OPS = new Set(['ncontains', 'strict_ncontains']);

interface V2Component {
  operator?: unknown;
  type?: unknown;
  value?: unknown;
}

/**
 * Normalize a single V-Tools V2 `filter` (from `data.list`) into an
 * `ExportedFilter`, or null if unnamed.
 *
 * V2 uses a polymorphic `components[]` array of `{ operator, type, value }`.
 *
 * Keyword mapping (the bug fix):
 *  - Each include keyword component (operator `contains`/`strict_contains`)
 *    becomes ONE AND-group `{ keywords: component.value }`. Components are NOT
 *    merged — two `contains` components yield two separate groups.
 *  - `blacklist_keywords` = flat concat of every exclude keyword component's
 *    value (operator `ncontains`/`strict_ncontains`).
 *
 * Non-keyword facet components: first occurrence per `type` wins.
 */
export function normalizeVToolsV2Filter(filter: unknown): ExportedFilter | null {
  if (!filter || typeof filter !== 'object') return null;
  const f = filter as Record<string, unknown>;

  const name = trimmedName(f.name);
  if (name === null) return null;

  const out = emptyExportedFilter(name);
  out.enabled = f.enabled === true;
  out.autocop = f.boosted === true;

  const components = asArray<V2Component>(f.components);

  // First-occurrence lookup for non-keyword facet components.
  const firstByType = new Map<string, V2Component>();
  // Ordered keyword include groups + flat exclude list.
  const includeGroups: KeywordRules['groups'] = [];
  const blacklist: string[] = [];

  for (const c of components) {
    if (!c || typeof c !== 'object') continue;
    const type = typeof c.type === 'string' ? c.type : '';
    if (type === '') continue;

    if (type === 'keyword') {
      const op = typeof c.operator === 'string' ? c.operator : '';
      const values = asArray<unknown>(c.value).map((v) => String(v));
      if (KW_INCLUDE_OPS.has(op)) {
        // One group per include component — do NOT merge.
        includeGroups.push({ keywords: values });
      } else if (KW_EXCLUDE_OPS.has(op)) {
        blacklist.push(...values);
      }
      continue;
    }

    if (!firstByType.has(type)) firstByType.set(type, c);
  }

  out.keyword_rules = includeGroups.length > 0 ? { groups: includeGroups } : null;
  out.blacklist_keywords = blacklist;

  const valueOf = (type: string): unknown => firstByType.get(type)?.value;

  // Facets — V2 uses `{ title, value }` objects; `value` is the numeric ID.
  out.catalog_ids = numberIds(valueOf('catalog'), 'value');

  out.brand_ids = numberIds(valueOf('brand'), 'value');
  out.brand_names = stringLabels(valueOf('brand'), 'title');

  out.size_ids = numberIds(valueOf('size'), 'value');
  out.size_names = stringLabels(valueOf('size'), 'title');

  out.color_ids = numberIds(valueOf('color'), 'value');
  out.color_names = stringLabels(valueOf('color'), 'title');

  out.material_ids = numberIds(valueOf('material'), 'value');
  out.material_names = stringLabels(valueOf('material'), 'title');

  out.status_ids = numberIds(valueOf('status'), 'value');
  out.country_ids = numberIds(valueOf('country'), 'value');

  out.video_game_platform_ids = numberIds(valueOf('video_game_platform'), 'value');
  out.video_game_rating_ids = numberIds(valueOf('video_game_rating'), 'value');

  // Regions: plain string IDs resolved to ISO codes (fallback: raw ID).
  out.region_isos = asArray<unknown>(valueOf('region'))
    .map((id) => String(id))
    .map((id) => VTOOLSV2_REGIONS[id] ?? id);

  // Price: `value.min` / `value.max`.
  const priceVal = valueOf('price') as Record<string, unknown> | undefined;
  applyPrice(out, priceVal?.min, priceVal?.max);

  // ISBNs: probe likely component types, then top-level fields.
  const isbnComp = valueOf('isbn') ?? valueOf('isbns') ?? valueOf('book');
  out.isbn_list = toIsbnList(isbnComp ?? f.isbns ?? f.isbn);

  return out;
}

/** Normalize a full V-Tools V2 API response (`{ success, data: { list } }`). */
export function normalizeVToolsV2Response(response: unknown): NormalizeResult {
  const errors: string[] = [];
  if (!response || typeof response !== 'object') {
    return { filters: [], errors: ['V-Tools V2 response is not an object'] };
  }
  const r = response as Record<string, unknown>;
  if (r.success !== true) {
    errors.push(`V-Tools V2 API returned success: ${String(r.success ?? 'undefined')}`);
  }
  const data = r.data as Record<string, unknown> | undefined;
  const list = data?.list;
  if (!Array.isArray(list)) {
    errors.push('V-Tools V2 response.data.list is not an array');
    return { filters: [], errors };
  }

  const filters: ExportedFilter[] = [];
  list.forEach((raw, index) => {
    const normalized = normalizeVToolsV2Filter(raw);
    if (normalized) filters.push(normalized);
    else errors.push(`V-Tools V2 filter at index ${index} skipped (invalid or unnamed)`);
  });
  return { filters, errors };
}

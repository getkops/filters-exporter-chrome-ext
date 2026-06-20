#!/usr/bin/env node
/**
 * validate-export.ts — Integrity linter for Kops filter exports.
 *
 * Drop real V-Tools / Souk exports into `tmp/exports/` (gitignored) and run:
 *
 *   pnpm validate:exports                 # scan tmp/exports/*.json (verbose)
 *   pnpm validate:exports path/to/file.json [more.json ...]
 *   pnpm validate:exports tmp/exports --brief    # hide per-finding context
 *   pnpm validate:exports tmp/exports --json     # machine-readable report
 *   pnpm validate:exports tmp/exports --strict   # warnings also fail (exit 1)
 *
 * It accepts BOTH shapes the user can have on disk and routes each file through
 * the EXACT production pipeline (no reimplementation — it imports the real
 * `normalize.ts` + the real vendored zod schema, so what it validates is byte-
 * for-byte what the extension produces):
 *
 *   - Typed export envelope  ({ schema_version, source, exported_at, filters })
 *       → validated directly against `filterExportEnvelopeSchema`.
 *   - Raw Souk capture       ({ type, body: { alerts } })
 *       → run through `normalizeSoukResponse`, then schema-validated.
 *   - Raw V-Tools V2 capture ({ success, data: { list } })
 *       → run through `normalizeVToolsV2Response`, then schema-validated.
 *   - Legacy V-Tools V1      ({ data: [ { oid, search_text, ... } ] })
 *       → reported as unsupported (current pipeline is V2-only).
 *
 * On top of schema validation it runs a battery of integrity heuristics tiered
 * by signal strength (errors → warnings → notes) to surface "weird patterns":
 * unresolved regions, price_min > price_max, id/name array mismatches, mangled
 * encoding, empty husk filters, malformed ISBNs, and more.
 *
 * Runs under Node ≥23.6 / 24 native TypeScript (type-stripping) — no build step.
 * Requires deps installed (`pnpm install`) because the schema imports `zod`.
 *
 * Exit code: 0 if no errors (and, under --strict, no warnings); 1 otherwise.
 */

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, relative, extname, basename } from 'node:path';
import {
  filterExportEnvelopeSchema,
  FILTER_EXPORT_SCHEMA_VERSION,
  type ExportedFilter,
  type FilterExportSource,
} from '../src/generated/filter-export-schema.generated.ts';
import {
  normalizeSoukResponse,
  normalizeVToolsV2Response,
} from '../src/normalize.ts';

const DEFAULT_DIR = 'tmp/exports';

// ─── Severity + findings ───────────────────────────────────────────

type Severity = 'error' | 'warn' | 'info';

interface Finding {
  severity: Severity;
  code: string;
  message: string;
  /** 0-based index of the offending filter, when filter-scoped. */
  filterIndex?: number;
  filterName?: string;
  /** Extra context lines printed (indented) under the finding unless --brief. */
  detail?: string[];
}

type Shape =
  | 'envelope'
  | 'souk-raw'
  | 'vtools-v2-raw'
  | 'vtools-v1-legacy'
  | 'unknown';

interface FileReport {
  path: string;
  shape: Shape;
  source: FilterExportSource | null;
  /** True when the file produced a usable, schema-valid ExportedFilter[]. */
  ok: boolean;
  filters: ExportedFilter[];
  findings: Finding[];
  stats: Stats | null;
}

interface Stats {
  filters: number;
  enabled: number;
  withKeywords: number;
  withBlacklist: number;
  withPrice: number;
  withBrands: number;
  withFacets: number;
  emptyHusk: number;
}

// ─── CLI args ──────────────────────────────────────────────────────

interface Args {
  paths: string[];
  json: boolean;
  strict: boolean;
  brief: boolean;
}

function parseArgs(argv: string[]): Args {
  const paths: string[] = [];
  let json = false;
  let strict = false;
  let brief = false;
  for (const arg of argv) {
    if (arg === '--json') json = true;
    else if (arg === '--strict') strict = true;
    else if (arg === '--brief') brief = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(2);
    } else paths.push(arg);
  }
  return { paths, json, strict, brief };
}

function printHelp(): void {
  console.log(
    [
      'Usage: pnpm validate:exports [paths...] [--brief] [--json] [--strict]',
      '',
      `  paths     Files or directories to scan (default: ${DEFAULT_DIR}).`,
      '  --brief   Hide the per-finding context detail (verbose is the default).',
      '  --json    Emit a machine-readable JSON report instead of text.',
      '  --strict  Treat warnings as failures (exit 1).',
    ].join('\n'),
  );
}

// ─── File discovery ────────────────────────────────────────────────

/** Resolve CLI paths (files or dirs) to a flat, sorted list of *.json files. */
function discoverFiles(paths: string[]): string[] {
  const targets = paths.length > 0 ? paths : [DEFAULT_DIR];
  const files: string[] = [];
  for (const target of targets) {
    const abs = resolve(target);
    if (!existsSync(abs)) {
      // A missing default dir is not an error — we create it and guide the user.
      if (paths.length === 0) continue;
      console.error(`Path not found: ${target}`);
      continue;
    }
    if (statSync(abs).isDirectory()) {
      for (const entry of readdirSync(abs)) {
        if (extname(entry).toLowerCase() === '.json') files.push(join(abs, entry));
      }
    } else if (extname(abs).toLowerCase() === '.json') {
      files.push(abs);
    } else {
      console.error(`Skipping non-JSON file: ${target}`);
    }
  }
  return [...new Set(files)].sort();
}

// ─── Shape detection ───────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function detectShape(raw: unknown): Shape {
  if (!isObj(raw)) return 'unknown';
  // Envelope first (it is the primary thing the user has on disk).
  if ('schema_version' in raw && Array.isArray(raw.filters)) return 'envelope';
  if (isObj(raw.body) && Array.isArray(raw.body.alerts)) return 'souk-raw';
  if (isObj(raw.data) && Array.isArray(raw.data.list)) return 'vtools-v2-raw';
  // Legacy V-Tools V1: `data` is a bare array of filters with oid/search_text.
  if (Array.isArray(raw.data)) return 'vtools-v1-legacy';
  return 'unknown';
}

// ─── Schema helpers ────────────────────────────────────────────────

/** Format a zod issue list compactly: `filters[3].price_min: Expected number…`. */
function formatZodIssues(
  issues: { path: (string | number)[]; message: string }[],
  max = 12,
): Finding[] {
  const findings: Finding[] = issues.slice(0, max).map((issue) => ({
    severity: 'error' as const,
    code: 'schema',
    message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  }));
  if (issues.length > max) {
    findings.push({
      severity: 'error',
      code: 'schema',
      message: `…and ${issues.length - max} more schema issue(s)`,
    });
  }
  return findings;
}

// ─── Integrity heuristics ──────────────────────────────────────────
//
// Tiered by signal. `error` = structural/contract break, `warn` = probable data
// quality bug worth investigating, `info` = low-signal FYI. Every check is
// calibrated so a clean, real export produces ZERO findings.

/** Render a string with control/replacement chars shown as visible tokens. */
function codepoints(s: string): string {
  return [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x20 || cp === 0xfffd ? `<U+${cp.toString(16).toUpperCase().padStart(4, '0')}>` : ch;
    })
    .join('');
}

/** Deterministic JSON with recursively-sorted keys, for content fingerprinting. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

const ISO2 = /^[A-Z]{2}$/;
const ISBN10 = /^\d{9}[\dX]$/i; // ISBN-10: 9 digits + check digit (may be 'X')
const ISBN13 = /^\d{13}$/;
// Definitive encoding corruption only: U+FFFD replacement char, or a C0 control
// char other than tab/newline/CR. Deliberately conservative — no mojibake
// digraph matching, which would false-positive on legitimate accented text.
const MANGLED = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

/** True when the filter captures literally nothing (an extraction husk). */
function isEmptyHusk(f: ExportedFilter): boolean {
  const arrays: unknown[][] = [
    f.catalog_ids, f.brand_ids, f.brand_names, f.size_ids, f.size_names,
    f.status_ids, f.color_ids, f.color_names, f.material_ids, f.material_names,
    f.country_ids, f.region_isos, f.video_game_platform_ids,
    f.video_game_rating_ids, f.isbn_list, f.blacklist_keywords,
  ];
  const noArrays = arrays.every((a) => a.length === 0);
  const noKeywords = f.keyword_rules === null || f.keyword_rules.groups.length === 0;
  const noPrice = f.price_min == null && f.price_max == null;
  return noArrays && noKeywords && noPrice;
}

/** Flag bad IDs (non-positive-integer) and duplicates within one id array. */
function checkIdArray(
  ids: number[],
  field: string,
  push: (f: Omit<Finding, 'filterIndex' | 'filterName'>) => void,
): void {
  const seen = new Set<number>();
  let dupes = 0;
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) {
      push({ severity: 'warn', code: 'bad-id', message: `${field} contains a non-positive/non-integer id: ${id}`, detail: [`${field}: [${ids.join(', ')}]`] });
    }
    if (seen.has(id)) dupes++;
    seen.add(id);
  }
  if (dupes > 0) {
    push({ severity: 'info', code: 'dup-id', message: `${field} has ${dupes} duplicate id(s)` });
  }
}

/** id-array ↔ name-array length parity (both come from the same facet objects). */
function checkParity(
  ids: number[],
  names: string[],
  facet: string,
  push: (f: Omit<Finding, 'filterIndex' | 'filterName'>) => void,
): void {
  const pairing = [
    `${facet}_ids:   [${ids.join(', ')}]`,
    `${facet}_names: [${names.map((n) => JSON.stringify(n)).join(', ')}]`,
  ];
  if (ids.length !== names.length) {
    push({
      severity: 'warn',
      code: 'id-name-mismatch',
      message: `${facet}_ids/${facet}_names length mismatch (${ids.length} ids vs ${names.length} names) — a facet object was missing an id or title`,
      detail: pairing,
    });
  }
  names.forEach((n, i) => {
    if (n.trim() === '') {
      push({ severity: 'warn', code: 'empty-name', message: `${facet}_names[${i}] is empty/whitespace (paired with ${facet}_id ${ids[i] ?? '?'}) — source facet had a blank title`, detail: pairing });
    } else if (MANGLED.test(n)) {
      push({ severity: 'warn', code: 'mangled-text', message: `${facet}_names[${i}] contains a replacement/control char (encoding corruption): ${JSON.stringify(n)}`, detail: [`decoded: ${codepoints(n)}`, ...pairing] });
    }
  });
}

/** Run every per-filter heuristic, returning findings stamped with index/name. */
function checkFilter(
  f: ExportedFilter,
  index: number,
  source: FilterExportSource | null,
): Finding[] {
  const out: Finding[] = [];
  const push = (p: Omit<Finding, 'filterIndex' | 'filterName'>): void => {
    out.push({ ...p, filterIndex: index, filterName: f.name });
  };

  // Name
  if (f.name.trim() === '') {
    push({ severity: 'warn', code: 'empty-filter-name', message: 'filter has an empty/whitespace name' });
  } else if (MANGLED.test(f.name)) {
    push({ severity: 'warn', code: 'mangled-text', message: `filter name has a replacement/control char (encoding corruption): ${JSON.stringify(f.name)}`, detail: [`decoded: ${codepoints(f.name)}`] });
  }

  // Empty husk — nothing was extracted.
  if (isEmptyHusk(f)) {
    push({ severity: 'warn', code: 'empty-husk', message: 'filter captures nothing (no facets, keywords, blacklist, or price) — likely an extraction miss' });
  }

  // id ↔ name parity (the four facets that carry both)
  checkParity(f.brand_ids, f.brand_names, 'brand', push);
  checkParity(f.size_ids, f.size_names, 'size', push);
  checkParity(f.color_ids, f.color_names, 'color', push);
  checkParity(f.material_ids, f.material_names, 'material', push);

  // id sanity
  checkIdArray(f.catalog_ids, 'catalog_ids', push);
  checkIdArray(f.brand_ids, 'brand_ids', push);
  checkIdArray(f.size_ids, 'size_ids', push);
  checkIdArray(f.color_ids, 'color_ids', push);
  checkIdArray(f.material_ids, 'material_ids', push);
  checkIdArray(f.status_ids, 'status_ids', push);
  checkIdArray(f.country_ids, 'country_ids', push);
  checkIdArray(f.video_game_platform_ids, 'video_game_platform_ids', push);
  checkIdArray(f.video_game_rating_ids, 'video_game_rating_ids', push);

  // Price sanity
  if (f.price_min != null && f.price_min < 0) {
    push({ severity: 'warn', code: 'bad-price', message: `price_min is negative: ${f.price_min}` });
  }
  if (f.price_max != null && f.price_max < 0) {
    push({ severity: 'warn', code: 'bad-price', message: `price_max is negative: ${f.price_max}` });
  }
  if (f.price_min != null && f.price_max != null && f.price_min > f.price_max) {
    push({ severity: 'warn', code: 'price-inverted', message: `price_min (${f.price_min}) > price_max (${f.price_max})` });
  }

  // Regions — unresolved IDs fall back to the raw `reg_...` string (V-Tools only).
  // One consolidated finding per filter, with the full ordered list as context:
  // region order matches the V-Tools filter UI, so positions pinpoint each country.
  const unresolvedRegions = f.region_isos
    .map((r, i) => ({ r, i }))
    .filter((x) => !ISO2.test(x.r));
  if (unresolvedRegions.length > 0) {
    const resolved = f.region_isos.filter((r) => ISO2.test(r));
    const full = f.region_isos.map((r, i) => (ISO2.test(r) ? `[${i}] ${r}` : `[${i}] <<${r}>>`)).join('  ');
    push({
      severity: 'warn',
      code: 'unresolved-region',
      message: `${unresolvedRegions.length} of ${f.region_isos.length} region(s) unmapped: ${unresolvedRegions.map((x) => x.r).join(', ')}`,
      detail: [
        `full region order (<<…>> = unmapped): ${full}`,
        `resolved here: ${resolved.length ? resolved.join(', ') : '(none)'} — the unmapped ones are positions ${unresolvedRegions.map((x) => x.i).join(', ')} in the V-Tools UI region list`,
        `fix: add each id to VTOOLSV2_REGIONS in src/normalize.ts (see the "Action required" section below)`,
      ],
    });
  }

  // ISBNs — format only (allow ISBN-10 trailing 'X'); ignore hyphen/space grouping.
  f.isbn_list.forEach((raw, i) => {
    const compact = raw.replace(/[\s-]/g, '');
    if (compact === '') {
      push({ severity: 'warn', code: 'bad-isbn', message: `isbn_list[${i}] is empty` });
    } else if (!ISBN10.test(compact) && !ISBN13.test(compact)) {
      push({ severity: 'warn', code: 'bad-isbn', message: `isbn_list[${i}] is not a valid ISBN-10/13: ${JSON.stringify(raw)}` });
    }
  });

  // Keyword rules
  if (f.keyword_rules) {
    f.keyword_rules.groups.forEach((g, gi) => {
      if (g.keywords.length === 0) {
        push({ severity: 'warn', code: 'empty-keyword-group', message: `keyword group #${gi + 1} is empty` });
      }
      g.keywords.forEach((kw) => {
        if (kw.trim() === '') {
          push({ severity: 'warn', code: 'empty-keyword', message: `keyword group #${gi + 1} contains an empty keyword` });
        } else if (kw.trimStart().startsWith('-')) {
          // Leading '-' only (mid-word hyphens like "t-shirt" are legitimate).
          push({ severity: 'info', code: 'negative-in-include', message: `include keyword starts with '-' (a blacklist term leaked into includes?): ${JSON.stringify(kw)}` });
        } else if (MANGLED.test(kw)) {
          push({ severity: 'warn', code: 'mangled-text', message: `keyword has a replacement/control char (encoding corruption): ${JSON.stringify(kw)}`, detail: [`decoded: ${codepoints(kw)}`] });
        }
      });
    });
  }
  f.blacklist_keywords.forEach((kw, i) => {
    if (kw.trim() === '') {
      push({ severity: 'warn', code: 'empty-keyword', message: `blacklist_keywords[${i}] is empty` });
    } else if (MANGLED.test(kw)) {
      push({ severity: 'warn', code: 'mangled-text', message: `blacklist_keywords[${i}] has a replacement/control char (encoding corruption): ${JSON.stringify(kw)}`, detail: [`decoded: ${codepoints(kw)}`] });
    }
  });

  // Cross-source sanity — the normalizer hardcodes these to [] for Souk, so a
  // non-empty value means hand-edited or future-version data.
  if (source === 'souk') {
    if (f.region_isos.length > 0) {
      push({ severity: 'info', code: 'source-anomaly', message: 'Souk filter has region_isos (Souk scopes by country, not region)' });
    }
    if (f.video_game_rating_ids.length > 0) {
      push({ severity: 'info', code: 'source-anomaly', message: 'Souk filter has video_game_rating_ids (not exposed by Souk)' });
    }
  }

  return out;
}

// ─── Envelope-level + cross-filter checks ──────────────────────────

function checkEnvelopeMeta(raw: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  if (raw.schema_version !== FILTER_EXPORT_SCHEMA_VERSION) {
    out.push({
      severity: 'error',
      code: 'schema-version',
      message: `schema_version is ${JSON.stringify(raw.schema_version)} (expected ${FILTER_EXPORT_SCHEMA_VERSION}) — re-export from the latest extension`,
    });
  }
  if (typeof raw.exported_at !== 'string' || Number.isNaN(Date.parse(raw.exported_at))) {
    out.push({
      severity: 'warn',
      code: 'bad-exported-at',
      message: `exported_at is not a parseable date: ${JSON.stringify(raw.exported_at)}`,
    });
  }
  return out;
}

function checkCrossFilter(filters: ExportedFilter[]): Finding[] {
  const out: Finding[] = [];
  if (filters.length === 0) {
    out.push({ severity: 'warn', code: 'no-filters', message: 'export contains zero filters — nothing was captured' });
    return out;
  }
  // Cluster by content fingerprint (every field EXCEPT name) to expose accidental
  // copies — the classic "Sneakers (copy) (copy)" explosion — as one signal each.
  const byContent = new Map<string, number[]>();
  filters.forEach((f, i) => {
    const key = stableStringify({ ...f, name: '' });
    if (!byContent.has(key)) byContent.set(key, []);
    byContent.get(key)!.push(i);
  });
  for (const idxs of byContent.values()) {
    if (idxs.length > 1) {
      const sameName = idxs.every((i) => filters[i].name === filters[idxs[0]].name);
      out.push({
        severity: 'info',
        code: 'identical-criteria',
        message: `${idxs.length} filters have identical criteria${sameName ? ' AND the same name (exact duplicate rows)' : ' (differ only by name — likely accidental copies)'}`,
        detail: idxs.map((i) => `#${i} "${truncate(filters[i].name, 50)}"`),
      });
    }
  }

  // Same display name but DIFFERENT criteria — ambiguous, worth a heads-up.
  const byName = new Map<string, number[]>();
  filters.forEach((f, i) => {
    const key = f.name.trim().toLowerCase();
    if (key === '') return;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(i);
  });
  for (const idxs of byName.values()) {
    if (idxs.length > 1) {
      const contents = new Set(idxs.map((i) => stableStringify({ ...filters[i], name: '' })));
      if (contents.size > 1) {
        out.push({
          severity: 'info',
          code: 'dup-name-diff',
          message: `${idxs.length} filters share the name "${truncate(filters[idxs[0]].name, 50)}" but have DIFFERENT criteria (indices ${idxs.join(', ')})`,
        });
      }
    }
  }
  return out;
}

// ─── Stats ─────────────────────────────────────────────────────────

function computeStats(filters: ExportedFilter[]): Stats {
  const has = (a: unknown[]) => a.length > 0;
  return {
    filters: filters.length,
    enabled: filters.filter((f) => f.enabled).length,
    withKeywords: filters.filter((f) => f.keyword_rules && f.keyword_rules.groups.length > 0).length,
    withBlacklist: filters.filter((f) => has(f.blacklist_keywords)).length,
    withPrice: filters.filter((f) => f.price_min != null || f.price_max != null).length,
    withBrands: filters.filter((f) => has(f.brand_ids)).length,
    withFacets: filters.filter((f) => has(f.catalog_ids) || has(f.brand_ids) || has(f.size_ids) || has(f.color_ids) || has(f.material_ids) || has(f.status_ids) || has(f.country_ids)).length,
    emptyHusk: filters.filter(isEmptyHusk).length,
  };
}

// ─── Per-file processing ───────────────────────────────────────────

function processFile(path: string): FileReport {
  const rel = relative(process.cwd(), path) || path;
  const base: FileReport = { path: rel, shape: 'unknown', source: null, ok: false, filters: [], findings: [], stats: null };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    base.findings.push({ severity: 'error', code: 'invalid-json', message: `not valid JSON: ${(err as Error).message}` });
    return base;
  }

  const shape = detectShape(raw);
  base.shape = shape;

  // Resolve to a schema-validated ExportedFilter[] + source, per shape.
  let filters: ExportedFilter[] | null = null;
  let source: FilterExportSource | null = null;

  if (shape === 'envelope') {
    const obj = raw as Record<string, unknown>;
    base.findings.push(...checkEnvelopeMeta(obj));
    const parsed = filterExportEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      base.findings.push(...formatZodIssues(parsed.error.issues));
      return base; // shape untrusted — skip heuristics
    }
    filters = parsed.data.filters;
    source = parsed.data.source;
  } else if (shape === 'souk-raw' || shape === 'vtools-v2-raw') {
    source = shape === 'souk-raw' ? 'souk' : 'vtools';
    const result = shape === 'souk-raw' ? normalizeSoukResponse(raw) : normalizeVToolsV2Response(raw);
    // Normalizer "errors" are skipped/invalid alerts — surface as warnings.
    for (const msg of result.errors) {
      base.findings.push({ severity: 'warn', code: 'normalize', message: msg });
    }
    // Close the loop: confirm the normalizer output really satisfies the schema.
    const envelope = { schema_version: FILTER_EXPORT_SCHEMA_VERSION, source, exported_at: new Date().toISOString(), filters: result.filters };
    const parsed = filterExportEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      base.findings.push({ severity: 'error', code: 'schema', message: 'normalizer output failed schema validation (this is a normalizer bug):' });
      base.findings.push(...formatZodIssues(parsed.error.issues));
    }
    filters = result.filters;
  } else if (shape === 'vtools-v1-legacy') {
    base.findings.push({ severity: 'error', code: 'unsupported-v1', message: 'looks like legacy V-Tools V1 (`data: [...]` with oid/search_text). The current pipeline only supports V-Tools V2 (`data.list` with components). Re-export from the latest extension.' });
    return base;
  } else {
    base.findings.push({ severity: 'error', code: 'unknown-shape', message: 'unrecognized shape — expected an export envelope, Souk `body.alerts`, or V-Tools V2 `data.list`.' });
    return base;
  }

  base.source = source;
  base.filters = filters;
  base.stats = computeStats(filters);
  base.findings.push(...checkCrossFilter(filters));
  filters.forEach((f, i) => base.findings.push(...checkFilter(f, i, source)));
  base.ok = !base.findings.some((x) => x.severity === 'error');
  return base;
}

// ─── Reporting ─────────────────────────────────────────────────────

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string): string => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  dim: (s: string) => paint('2', s),
  bold: (s: string) => paint('1', s),
  red: (s: string) => paint('31', s),
  yellow: (s: string) => paint('33', s),
  blue: (s: string) => paint('34', s),
  green: (s: string) => paint('32', s),
  cyan: (s: string) => paint('36', s),
};

const SEV_ICON: Record<Severity, string> = { error: '✗', warn: '⚠', info: 'ℹ' };
const sevPaint: Record<Severity, (s: string) => string> = { error: c.red, warn: c.yellow, info: c.blue };

const SHAPE_LABEL: Record<Shape, string> = {
  envelope: 'export envelope',
  'souk-raw': 'raw Souk capture → normalized',
  'vtools-v2-raw': 'raw V-Tools V2 capture → normalized',
  'vtools-v1-legacy': 'legacy V-Tools V1 (unsupported)',
  unknown: 'unrecognized',
};

function findingLine(f: Finding): string {
  const loc = f.filterIndex != null ? c.dim(`[#${f.filterIndex} ${truncate(f.filterName ?? '', 28)}] `) : '';
  return `    ${sevPaint[f.severity](SEV_ICON[f.severity])} ${loc}${f.message} ${c.dim(`(${f.code})`)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Aggregated, de-duplicated patch list for the one finding that needs a code
 * change: V-Tools region IDs the normalizer can't resolve. Repeating the same
 * `reg_…` per filter is noise; this collapses them into a single to-do.
 */
function printActionItems(reports: FileReport[]): void {
  const regions = new Map<string, { count: number; filters: Set<string> }>();
  for (const r of reports) {
    for (const f of r.filters) {
      for (const iso of f.region_isos) {
        if (ISO2.test(iso)) continue;
        if (!regions.has(iso)) regions.set(iso, { count: 0, filters: new Set() });
        const hit = regions.get(iso)!;
        hit.count++;
        hit.filters.add(f.name);
      }
    }
  }
  if (regions.size === 0) return;

  console.log('');
  console.log(c.bold(c.yellow(`▶ Action required — ${regions.size} unmapped V-Tools region id(s)`)));
  console.log(c.dim('  Add each to the VTOOLSV2_REGIONS table in src/normalize.ts as `<id>: \'<ISO>\'`:'));
  console.log('');
  for (const [id, hit] of regions) {
    const names = [...hit.filters].slice(0, 3).map((n) => `"${truncate(n, 30)}"`).join(', ');
    const more = hit.filters.size > 3 ? ` +${hit.filters.size - 3} more` : '';
    console.log(`    ${c.yellow(id)}: '??',  ${c.dim(`// ${hit.count}× across ${hit.filters.size} filter(s): ${names}${more}`)}`);
  }
  console.log('');
  console.log(c.dim('  To map each id → ISO country code: open an affected filter in the V-Tools'));
  console.log(c.dim('  dashboard and read its regions in order (the [n] positions above line up), or'));
  console.log(c.dim("  re-capture the raw response and inspect the 'region' component's titles."));
}

function printTextReport(reports: FileReport[], strict: boolean, brief: boolean): void {
  for (const r of reports) {
    const errs = r.findings.filter((f) => f.severity === 'error').length;
    const warns = r.findings.filter((f) => f.severity === 'warn').length;
    const infos = r.findings.filter((f) => f.severity === 'info').length;
    const status = errs > 0 ? c.red('✗') : warns > 0 ? c.yellow('⚠') : c.green('✓');

    console.log('');
    console.log(`${status} ${c.bold(r.path)}  ${c.dim('·')}  ${c.cyan(SHAPE_LABEL[r.shape])}${r.source ? c.dim(` · source: ${r.source}`) : ''}`);

    if (r.stats) {
      const s = r.stats;
      console.log(
        c.dim(`    ${s.filters} filters · ${s.enabled} enabled · ${s.withKeywords} w/keywords · ${s.withPrice} w/price · ${s.withBrands} w/brands · ${s.withFacets} w/facets${s.emptyHusk ? ` · ${s.emptyHusk} empty` : ''}`),
      );
    }

    if (r.findings.length === 0) {
      console.log(`    ${c.green('no issues')}`);
      continue;
    }

    // errors → warns → infos, each optionally followed by its context detail.
    for (const sev of ['error', 'warn', 'info'] as Severity[]) {
      for (const f of r.findings.filter((x) => x.severity === sev)) {
        console.log(findingLine(f));
        if (!brief && f.detail) {
          for (const d of f.detail) console.log(c.dim(`         ${d}`));
        }
      }
    }
    console.log(c.dim(`    └ ${errs} error(s) · ${warns} warning(s) · ${infos} note(s)`));
  }

  printActionItems(reports);

  // ── Summary ──
  const totals = reports.reduce(
    (acc, r) => {
      acc.filters += r.stats?.filters ?? 0;
      acc.errors += r.findings.filter((f) => f.severity === 'error').length;
      acc.warns += r.findings.filter((f) => f.severity === 'warn').length;
      acc.infos += r.findings.filter((f) => f.severity === 'info').length;
      if (r.findings.some((f) => f.severity === 'error')) acc.badFiles++;
      return acc;
    },
    { filters: 0, errors: 0, warns: 0, infos: 0, badFiles: 0 },
  );

  console.log('');
  console.log(c.bold('─'.repeat(60)));
  console.log(
    `${c.bold('Summary')}  ${reports.length} file(s) · ${totals.filters} filters · ` +
      `${c.red(`${totals.errors} error(s)`)} · ${c.yellow(`${totals.warns} warning(s)`)} · ${c.blue(`${totals.infos} note(s)`)}`,
  );

  const fail = totals.errors > 0 || (strict && totals.warns > 0);
  if (fail) {
    const reason = totals.errors > 0 ? `${totals.badFiles} file(s) with errors` : `${totals.warns} warning(s) under --strict`;
    console.log(c.red(`✗ FAIL — ${reason}`));
  } else if (totals.warns > 0) {
    console.log(c.yellow(`⚠ PASS with ${totals.warns} warning(s) to review`));
  } else {
    console.log(c.green('✓ PASS — all exports clean'));
  }
}

// ─── Main ──────────────────────────────────────────────────────────

function main(): void {
  const { paths, json, strict, brief } = parseArgs(process.argv.slice(2));

  // Ensure the default drop folder exists so the first run is friendly.
  if (paths.length === 0 && !existsSync(resolve(DEFAULT_DIR))) {
    mkdirSync(resolve(DEFAULT_DIR), { recursive: true });
  }

  const files = discoverFiles(paths).filter((f) => basename(f) !== 'README.txt');

  if (files.length === 0) {
    if (json) {
      console.log(JSON.stringify({ files: [], summary: { files: 0, message: 'no JSON files found' } }, null, 2));
      process.exit(0);
    }
    console.log('');
    console.log(c.yellow(`No JSON files found in ${paths.length ? paths.join(', ') : DEFAULT_DIR}/`));
    console.log(c.dim(`Drop your extension exports (or raw Souk/V-Tools captures) into ${DEFAULT_DIR}/ and re-run \`pnpm validate:exports\`.`));
    process.exit(0);
  }

  const reports = files.map(processFile);

  if (json) {
    const summary = reports.reduce(
      (acc, r) => {
        acc.errors += r.findings.filter((f) => f.severity === 'error').length;
        acc.warnings += r.findings.filter((f) => f.severity === 'warn').length;
        acc.notes += r.findings.filter((f) => f.severity === 'info').length;
        return acc;
      },
      { files: reports.length, errors: 0, warnings: 0, notes: 0 },
    );
    console.log(JSON.stringify({ files: reports.map((r) => ({ ...r, filters: undefined })), summary }, null, 2));
    const fail = summary.errors > 0 || (strict && summary.warnings > 0);
    process.exit(fail ? 1 : 0);
  }

  printTextReport(reports, strict, brief);
  const totalErrors = reports.reduce((n, r) => n + r.findings.filter((f) => f.severity === 'error').length, 0);
  const totalWarns = reports.reduce((n, r) => n + r.findings.filter((f) => f.severity === 'warn').length, 0);
  process.exit(totalErrors > 0 || (strict && totalWarns > 0) ? 1 : 0);
}

main();

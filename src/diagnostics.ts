/**
 * diagnostics.ts — Pure diagnostics core for the debug-session export.
 *
 * No `chrome`, no `window`: unit-testable and importable from every context
 * (inject MAIN world, content script, service worker, popup). esbuild inlines it
 * into each bundle.
 *
 * ─── Security model: allowlist + defense-in-depth ───────────────────────────
 *  - URLs are reduced to origin+path (`sanitizeUrl`) — this drops auth tokens
 *    AND the user's search terms, which a token-only blocklist would miss.
 *  - `redactSecrets` strips token-like substrings from any free text, and is
 *    re-applied at buffer-write time (`toEvent`) as a backstop even if a caller
 *    forgets.
 *  - `shapeOf` emits keys+types only — never values — with key names redacted
 *    (some APIs key maps by PII) and depth/breadth capped.
 *  - Raw response bodies and request headers NEVER enter an event.
 *
 * The debug bundle keeps an AUTHORITATIVE backbone (storage state + summary,
 * read directly in the service worker) separate from BEST-EFFORT events (which
 * cross page → content → worker). An empty event log therefore reads
 * unambiguously as "nothing was observed", not "the tool is broken".
 */

// ─── Event model ───────────────────────────────────────────────────

export type DiagSource = 'souk' | 'vtoolsv2' | null;
export type DiagCtx = 'inject' | 'content' | 'background' | 'popup';
export type DiagLevel = 'info' | 'warn' | 'error';

export type DiagStage =
  | 'intercept' // a matching request was observed with a valid body
  | 'parse_fail' // intercepted body was not a usable success payload
  | 'http_error' // a (re)fetch returned non-2xx
  | 'fetch_error' // a (re)fetch threw, or its body was not JSON
  | 'pagination_aborted' // a run stopped partway (previous data kept)
  | 'pagination_done' // a complete set was assembled
  | 'normalize' // the worker normalized a payload (count + errors)
  | 'store_ok'
  | 'store_fail'
  | 'capture_empty' // parsed/normalized to zero filters
  | 'export' // a debug bundle was exported
  | 'note';

export interface DiagInput {
  stage: DiagStage;
  ctx?: DiagCtx;
  source?: DiagSource;
  level?: DiagLevel;
  message?: string;
  httpStatus?: number;
  pageNumber?: number;
  count?: number;
  detail?: Record<string, string | number | boolean | null>;
}

export interface DiagEvent extends DiagInput {
  ts: string;
  ctx: DiagCtx;
  level: DiagLevel;
}

/** Structured log sink; each context wires it to console + (optionally) the SW. */
export type DiagSink = (input: DiagInput) => void;

// ─── Cross-context message identifiers (shared, single source) ─────

/** window.postMessage type for diag events emitted from the MAIN world. */
export const DIAG_MSG_TYPE = '__FILTER_EXPORTER_DIAG__';
/** runtime message action carrying a diag event (content → service worker). */
export const DIAG_ACTION = 'DIAG_EVENT';
/** runtime message action requesting a debug bundle (popup → service worker). */
export const EXPORT_DEBUG_ACTION = 'EXPORT_DEBUG';

// ─── Redaction ─────────────────────────────────────────────────────

const SECRET_PATTERNS: RegExp[] = [
  /bearer\s+[A-Za-z0-9._\-]+/gi,
  /\b(?:authorization|token|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|cookie|session)\b\s*[:=]\s*[^\s,&;]+/gi,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g, // JWT-ish
  /\b[A-Fa-f0-9]{32,}\b/g, // long hex (session ids / hashes)
];

/** Replace token-like substrings with `[redacted]`. Idempotent. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  return out;
}

const KEY_PII_PATTERNS: [RegExp, string][] = [
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]'],
  [/\b\d{7,}\b/g, '[num]'],
];

/**
 * Redact an OBJECT KEY for `shapeOf`. Some APIs key maps by PII (emails, phone
 * numbers, ids), so keys — not just values — can leak. Applies the secret
 * patterns, scrubs PII-shaped keys, and caps length.
 */
export function redactKey(key: string): string {
  let out = redactSecrets(key);
  for (const [re, repl] of KEY_PII_PATTERNS) out = out.replace(re, repl);
  return out.length > 64 ? `${out.slice(0, 64)}…` : out;
}

// ─── URL sanitization ──────────────────────────────────────────────

/** Reduce a URL to origin+path; drop the query string and hash entirely. */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string' || url === '') return '';
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return redactSecrets(url.split(/[?#]/)[0]);
  }
}

/**
 * The query-param KEYS of a URL (names only, never values), comma-joined. Lets a
 * support bundle distinguish request shapes — e.g. a count-probe `limit` call
 * from a real `order`/cursor list call — without leaking search terms or tokens.
 */
export function urlParamKeys(url: string): string {
  if (typeof url !== 'string' || url === '') return '';
  try {
    return [...new URL(url).searchParams.keys()].join(',');
  } catch {
    const query = url.split('?')[1];
    if (!query) return '';
    return query
      .split('&')
      .map((pair) => pair.split('=')[0])
      .filter(Boolean)
      .join(',');
  }
}

// ─── Shape extraction (keys + types, never values) ─────────────────

const MAX_SHAPE_DEPTH = 5;
const MAX_SHAPE_KEYS = 40;

export type Shape = string | { [k: string]: Shape } | Shape[];

/**
 * Describe the STRUCTURE of a value — keys → type names, arrays → a single
 * representative element shape — without ever copying a value. Key names are
 * redacted; depth and breadth are capped. Used to explain a parse failure
 * ("the response had no `body.alerts`") without shipping the response.
 */
export function shapeOf(value: unknown, depth = 0): Shape {
  if (value === null) return 'null';
  const t = typeof value;
  if (t !== 'object') return t;
  if (Array.isArray(value)) {
    if (value.length === 0) return ['empty'];
    if (depth >= MAX_SHAPE_DEPTH) return [`array(${value.length})`];
    return [shapeOf(value[0], depth + 1)];
  }
  if (depth >= MAX_SHAPE_DEPTH) return 'object';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const out: Record<string, Shape> = {};
  let n = 0;
  for (const key of keys) {
    if (n >= MAX_SHAPE_KEYS) {
      out['…'] = `+${keys.length - n} more`;
      break;
    }
    out[redactKey(key)] = shapeOf(obj[key], depth + 1);
    n += 1;
  }
  return out;
}

// ─── Ring buffer ───────────────────────────────────────────────────

export const DIAG_BUFFER_CAP = 300;

/** Append an event, keeping only the most recent `cap`. Returns a NEW array. */
export function pushEvent(
  buffer: DiagEvent[],
  event: DiagEvent,
  cap = DIAG_BUFFER_CAP,
): DiagEvent[] {
  const next = buffer.length >= cap ? buffer.slice(buffer.length - cap + 1) : buffer.slice();
  next.push(event);
  return next;
}

function defaultLevel(stage: DiagStage): DiagLevel {
  switch (stage) {
    case 'http_error':
    case 'fetch_error':
    case 'pagination_aborted':
    case 'store_fail':
    case 'parse_fail':
      return 'error';
    case 'capture_empty':
      return 'warn';
    default:
      return 'info';
  }
}

/**
 * Normalize a `DiagInput` into a stored `DiagEvent`: stamp `ts`, default
 * `ctx`/`level`, and re-apply redaction to free text as a backstop. `now` is
 * injectable for deterministic tests.
 */
export function toEvent(input: DiagInput, ctx: DiagCtx, now = new Date().toISOString()): DiagEvent {
  const event: DiagEvent = {
    ...input,
    ts: now,
    ctx: input.ctx ?? ctx,
    level: input.level ?? defaultLevel(input.stage),
  };
  if (event.message) event.message = redactSecrets(event.message);
  if (event.detail) {
    const safe: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(event.detail)) {
      safe[redactSecrets(k)] = typeof v === 'string' ? redactSecrets(v) : v;
    }
    event.detail = safe;
  }
  return event;
}

// ─── Debug bundle ──────────────────────────────────────────────────

export interface DebugStorageState {
  filterCount: number;
  lastSource: string | null;
  lastUpdate: string | null;
  lastErrors: string[] | null;
}

export interface DebugBundleInput {
  exportId: string;
  generatedAt: string;
  extensionVersion: string;
  environment: { userAgent: string; language: string };
  storage: DebugStorageState;
  events: DiagEvent[];
  /** Present only when the user explicitly opts in to include their data. */
  filters?: unknown[];
}

export interface DebugBundle {
  schema: 'kops-filter-exporter-debug';
  bundle_version: 1;
  export_id: string;
  generated_at: string;
  extension: { version: string };
  environment: { userAgent: string; language: string };
  /** Authoritative, derived in the worker — safe even when `events` is empty. */
  summary: {
    eventCount: number;
    interceptCount: number;
    errorCount: number;
    lastInterceptAt: string | null;
    lastCaptureAt: string | null;
    storedFilterCount: number;
    lastSource: string | null;
  };
  /** Authoritative storage snapshot. */
  storage: DebugStorageState;
  /** Best-effort (page → content → worker). Empty = nothing was observed. */
  events: DiagEvent[];
  filters?: unknown[];
  notes: string[];
}

/** Assemble the debug bundle, computing the authoritative summary from events. */
export function assembleDebugBundle(input: DebugBundleInput): DebugBundle {
  const { events } = input;
  let interceptCount = 0;
  let errorCount = 0;
  let lastInterceptAt: string | null = null;
  for (const e of events) {
    if (e.stage === 'intercept') {
      interceptCount += 1;
      lastInterceptAt = e.ts;
    }
    if (e.level === 'error') errorCount += 1;
  }

  const bundle: DebugBundle = {
    schema: 'kops-filter-exporter-debug',
    bundle_version: 1,
    export_id: input.exportId,
    generated_at: input.generatedAt,
    extension: { version: input.extensionVersion },
    environment: input.environment,
    summary: {
      eventCount: events.length,
      interceptCount,
      errorCount,
      lastInterceptAt,
      lastCaptureAt: input.storage.lastUpdate,
      storedFilterCount: input.storage.filterCount,
      lastSource: input.storage.lastSource,
    },
    storage: {
      ...input.storage,
      lastErrors: input.storage.lastErrors?.map(redactSecrets) ?? null,
    },
    events,
    notes: [
      'summary{} and storage{} are authoritative — read directly in the service worker.',
      'events[] is best-effort (page → content script → service worker). An EMPTY list means no diagnostics were observed — most likely the inject script never ran or the endpoint never matched.',
      'An "intercept" or "parse_fail" event proves the inject script ran and matched the endpoint; "parse_fail" carries the response shape (keys+types, no values).',
      'URLs are reduced to origin+path; tokens and search terms are stripped. Filter contents are excluded unless the user explicitly opted in.',
    ],
  };
  if (input.filters) bundle.filters = input.filters;
  return bundle;
}

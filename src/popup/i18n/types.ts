/**
 * i18n/types.ts — the message catalog contract.
 *
 * Every locale module (`en`, `fr`) must satisfy `Messages`, so the compiler
 * rejects a missing or mistyped key — parity is enforced at build time, not by
 * hoping the catalogs stay in sync. Parameterized / pluralized copy is a typed
 * function (`(n) => string`) rather than a `{param}` placeholder, so callers get
 * autocomplete and type-checked arguments instead of stringly-typed keys.
 */
export type Locale = 'en' | 'fr';

export interface Messages {
  // ── Header ──────────────────────────────────────────────
  tagline: string;
  howItWorks: string;
  close: string;

  // ── Status chip ─────────────────────────────────────────
  statusWaiting: string;
  sourceVtools: string;
  sourceSouk: string;
  sourceGeneric: string;
  captured: (n: number) => string;

  // ── Toolbar ─────────────────────────────────────────────
  searchPlaceholder: string;
  filtersShown: (n: number) => string;
  selectedOf: (selected: number, total: number) => string;
  selectAll: string;

  // ── Table ───────────────────────────────────────────────
  colName: string;
  colBrands: string;
  colPrice: string;
  colStatus: string;
  statusActive: string;
  statusOff: string;
  unnamed: string;
  noResults: string;

  // ── Action bar ──────────────────────────────────────────
  exportN: (n: number) => string;
  exportSelectedN: (n: number) => string;
  refresh: string;
  more: string;

  // ── Menus (refresh / overflow) ──────────────────────────
  refreshVtools: string;
  refreshSouk: string;
  clear: string;
  debugExport: string;
  debugInclude: string;
  debugIncludeHint: string;
  lastCapture: (time: string) => string;

  // ── Empty state / onboarding ────────────────────────────
  emptyTitle: string;
  step1: string;
  step2: string;
  step3: string;
  openVtools: string;
  openSouk: string;

  // ── Loading ─────────────────────────────────────────────
  loading: string;

  // ── Errors (localized failure paths) ────────────────────
  errConnect: string;
  errParse: (n: number) => string;
  errExport: string;
  errNoFilters: string;
  errClear: string;
  errDownload: string;
  errOpenPage: string;
  errDebug: string;

  // ── Toasts (success) ────────────────────────────────────
  toastExported: (n: number) => string;
  toastCleared: string;
  toastDebugSavedCopied: string;
  toastDebugSaved: string;
  refreshOpening: (source: string) => string;
}

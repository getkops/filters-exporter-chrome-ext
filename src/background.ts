/**
 * background.ts — Service worker for the Kops Filter Exporter extension.
 *
 * Receives intercepted API data from the content script, normalizes it into
 * the typed `ExportedFilter[]` contract (ADR-040), persists it to
 * chrome.storage.local, and serves a versioned JSON envelope to the popup.
 *
 * Pure parsing/normalization lives in `./normalize` (no `chrome` import) so it
 * can be unit-tested; this file owns everything chrome-runtime-specific.
 */

import {
  FILTER_EXPORT_SCHEMA_VERSION,
  validateFilterExport,
  type ExportedFilter,
  type FilterExportEnvelope,
  type FilterExportSource,
} from './generated/filter-export-schema.generated';
import {
  normalizeSoukResponse,
  normalizeVToolsV2Response,
  type NormalizeResult,
} from './normalize';
import {
  toEvent,
  pushEvent,
  assembleDebugBundle,
  DIAG_ACTION,
  EXPORT_DEBUG_ACTION,
  type DiagInput,
  type DiagEvent,
} from './diagnostics';

const LOG_PREFIX = '[Kops Filter Exporter]';

/** Wire source as seen on the network, before mapping to the canonical source. */
type WireSource = 'vtoolsv2' | 'souk';

const STORAGE_KEYS = ['filters', 'lastSource', 'lastUpdate', 'lastErrors'] as const;

interface StoredState {
  filters: ExportedFilter[];
  lastSource: FilterExportSource | null;
  lastUpdate: string | null;
  lastErrors: string[] | null;
}

// ─── Storage helpers ───────────────────────────────────────────────

function saveToStorage(data: Partial<StoredState>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function readState(): Promise<StoredState> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS as unknown as string[], (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve({
        filters: Array.isArray(result.filters) ? (result.filters as ExportedFilter[]) : [],
        lastSource: (result.lastSource as FilterExportSource | undefined) ?? null,
        lastUpdate: (result.lastUpdate as string | undefined) ?? null,
        lastErrors: (result.lastErrors as string[] | undefined) ?? null,
      });
    });
  });
}

function removeFromStorage(keys: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys as string[], () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

// ─── Debug diagnostics ring buffer ─────────────────────────────────
//
// A persisted ring buffer of structured diagnostic events, exported on demand
// for support. Robustness against the service worker's two hazards:
//  - Ephemerality: the SW is killed when idle, so the buffer is hydrated from
//    storage once per wake before the first append.
//  - Bursts + races: a failed capture emits several events near-simultaneously.
//    A SINGLE in-memory owner is mutated synchronously (so no read-modify-write
//    can clobber), and the persist is coalesced (one write in flight; if more
//    events land mid-write, one more write fires after) — events are never lost.

const DEBUG_LOG_KEY = 'debugLog';

let debugBuffer: DiagEvent[] = [];
let hydration: Promise<void> | null = null;
let writing = false;
let writeDirty = false;

function hydrateDebugBuffer(): Promise<void> {
  if (!hydration) {
    hydration = new Promise<void>((resolve) => {
      chrome.storage.local.get(DEBUG_LOG_KEY, (result) => {
        void chrome.runtime.lastError;
        const stored = result?.[DEBUG_LOG_KEY];
        if (Array.isArray(stored)) debugBuffer = stored as DiagEvent[];
        resolve();
      });
    });
  }
  return hydration;
}

function persistDebugBuffer(): void {
  if (writing) {
    writeDirty = true;
    return;
  }
  writing = true;
  chrome.storage.local.set({ [DEBUG_LOG_KEY]: debugBuffer }, () => {
    void chrome.runtime.lastError; // best-effort: diagnostics never block capture
    writing = false;
    if (writeDirty) {
      writeDirty = false;
      persistDebugBuffer();
    }
  });
}

/** Append a diagnostic event to the persisted ring buffer (the single owner). */
async function recordEvent(input: DiagInput): Promise<void> {
  try {
    await hydrateDebugBuffer();
    debugBuffer = pushEvent(debugBuffer, toEvent(input, 'background'));
    persistDebugBuffer();
  } catch {
    /* diagnostics must never throw into the capture flow */
  }
}

function makeExportId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `exp-${Math.round(performance.now())}`;
  }
}

// ─── Core logic ────────────────────────────────────────────────────

/** Map the wire source to the canonical export source. */
function canonicalSource(source: WireSource): FilterExportSource {
  return source === 'vtoolsv2' ? 'vtools' : 'souk';
}

interface HandleResult {
  ok: boolean;
  count: number;
  errors: string[];
  error?: string;
}

/**
 * Process intercepted filter data: normalize, store, update badge.
 * `source` is the wire source (`vtoolsv2` parses V2 then stores as `vtools`).
 */
async function handleInterceptedFilters(source: string, data: unknown): Promise<HandleResult> {
  let result: NormalizeResult;
  let wire: WireSource;

  if (source === 'vtoolsv2') {
    wire = 'vtoolsv2';
    result = normalizeVToolsV2Response(data);
  } else if (source === 'souk') {
    wire = 'souk';
    result = normalizeSoukResponse(data);
  } else {
    return { ok: false, count: 0, errors: [`Unknown source: ${source}`] };
  }

  const { filters, errors, expectedTotal } = result;
  const canonical = canonicalSource(wire);

  void recordEvent({
    stage: 'normalize',
    source: wire,
    count: filters.length,
    detail: { errorCount: errors.length, expectedTotal: expectedTotal ?? null },
  });

  if (filters.length === 0) {
    console.warn(LOG_PREFIX, `No valid filters parsed from ${source}`, errors);
    void recordEvent({ stage: 'capture_empty', source: wire, detail: { errorCount: errors.length } });
    return { ok: false, count: 0, errors };
  }

  // Anti-regression: a SHORT capture (fewer than the source's reported total)
  // must not overwrite a LARGER set already stored for the same source — e.g.
  // V-Tools serving a truncated list during an outage. A new user still gets the
  // partial (nothing larger is stored); an existing user keeps their fuller set.
  if (expectedTotal != null && filters.length < expectedTotal) {
    const prior = await readState();
    if (prior.lastSource === canonical && prior.filters.length > filters.length) {
      console.warn(
        LOG_PREFIX,
        `Incomplete ${canonical} capture (${filters.length}/${expectedTotal}) — kept ${prior.filters.length} previously stored`,
      );
      void recordEvent({
        stage: 'note',
        source: wire,
        count: filters.length,
        message: `kept ${prior.filters.length} stored over incomplete ${filters.length}/${expectedTotal}`,
        detail: { stored: prior.filters.length, captured: filters.length, expectedTotal },
      });
      return { ok: true, count: prior.filters.length, errors };
    }
  }

  try {
    await saveToStorage({
      filters,
      lastSource: canonical,
      lastUpdate: new Date().toISOString(),
      lastErrors: errors.length > 0 ? errors : null,
    });
  } catch (storageErr) {
    const msg = `Storage save failed: ${(storageErr as Error).message}`;
    console.error(LOG_PREFIX, msg);
    void recordEvent({ stage: 'store_fail', source: wire, message: msg });
    return { ok: false, count: 0, errors: [...errors, msg] };
  }

  void recordEvent({ stage: 'store_ok', source: wire, count: filters.length });

  try {
    chrome.action.setBadgeText({ text: String(filters.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
  } catch (badgeErr) {
    console.warn(LOG_PREFIX, 'Badge update failed:', badgeErr);
  }

  if (errors.length > 0) {
    console.warn(
      LOG_PREFIX,
      `Stored ${filters.length} filters from ${canonical} with ${errors.length} warnings:`,
      errors,
    );
  } else {
    console.log(LOG_PREFIX, `Stored ${filters.length} filters from ${canonical}`);
  }

  return { ok: true, count: filters.length, errors };
}

/**
 * Build + validate the typed JSON export envelope for the given filters.
 * `validateFilterExport` throws if the shape or schema_version is wrong.
 */
function buildExportEnvelope(
  filters: ExportedFilter[],
  source: FilterExportSource,
): FilterExportEnvelope {
  const envelope: FilterExportEnvelope = {
    schema_version: FILTER_EXPORT_SCHEMA_VERSION,
    source,
    exported_at: new Date().toISOString(),
    filters,
  };
  return validateFilterExport(envelope);
}

// ─── Message types ─────────────────────────────────────────────────

type IncomingMessage =
  | { action: 'FILTERS_INTERCEPTED'; source: string; data: unknown }
  | { action: 'GET_FILTERS' }
  | { action: 'EXPORT_JSON'; selectedIndices?: number[] }
  | { action: 'CLEAR_FILTERS' }
  | { action: 'DIAG_EVENT'; event: unknown }
  | {
      action: 'EXPORT_DEBUG';
      includeFilters?: boolean;
      environment?: { userAgent?: string; language?: string };
    };

type SendResponse = (response: unknown) => void;

// ─── Message handler ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: IncomingMessage | undefined, _sender, sendResponse: SendResponse) => {
    if (!message || !('action' in message) || !message.action) {
      sendResponse({ ok: false, error: 'Invalid message: missing action' });
      return false;
    }

    switch (message.action) {
      case 'FILTERS_INTERCEPTED': {
        if (!message.source || message.data == null) {
          sendResponse({ ok: false, error: 'Missing source or data' });
          return false;
        }
        handleInterceptedFilters(message.source, message.data)
          .then((result) => sendResponse(result))
          .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
        return true; // async
      }

      case 'GET_FILTERS': {
        readState()
          .then((state) => {
            sendResponse({
              ok: true,
              filters: state.filters,
              lastSource: state.lastSource,
              lastUpdate: state.lastUpdate,
              lastErrors: state.lastErrors,
            });
          })
          .catch((err: Error) => sendResponse({ ok: false, error: err.message, filters: [] }));
        return true;
      }

      case 'EXPORT_JSON': {
        const selected = message.selectedIndices;
        readState()
          .then((state) => {
            const all = state.filters;
            if (all.length === 0) {
              sendResponse({ ok: false, error: 'No filters to export' });
              return;
            }
            const filters =
              Array.isArray(selected) && selected.length > 0
                ? selected
                    .filter((i) => i >= 0 && i < all.length)
                    .map((i) => all[i])
                : all;
            if (filters.length === 0) {
              sendResponse({ ok: false, error: 'No filters selected for export' });
              return;
            }
            const source: FilterExportSource = state.lastSource ?? 'vtools';
            try {
              const envelope = buildExportEnvelope(filters, source);
              sendResponse({
                ok: true,
                json: JSON.stringify(envelope, null, 2),
                count: envelope.filters.length,
              });
            } catch (validationErr) {
              sendResponse({ ok: false, error: (validationErr as Error).message });
            }
          })
          .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
        return true;
      }

      case 'CLEAR_FILTERS': {
        removeFromStorage(STORAGE_KEYS)
          .then(() => {
            chrome.action.setBadgeText({ text: '' });
            sendResponse({ ok: true });
          })
          .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
        return true;
      }

      case DIAG_ACTION: {
        // Fire-and-forget event from the content script — no response expected.
        if (message.event && typeof message.event === 'object') {
          void recordEvent(message.event as DiagInput);
        }
        return false;
      }

      case EXPORT_DEBUG_ACTION: {
        const includeFilters = message.includeFilters === true;
        const environment = {
          userAgent:
            typeof message.environment?.userAgent === 'string' ? message.environment.userAgent : '',
          language:
            typeof message.environment?.language === 'string' ? message.environment.language : '',
        };
        (async () => {
          await hydrateDebugBuffer();
          const state = await readState();
          const generatedAt = new Date().toISOString();
          const bundle = assembleDebugBundle({
            exportId: makeExportId(),
            generatedAt,
            extensionVersion: chrome.runtime.getManifest().version,
            environment,
            storage: {
              filterCount: state.filters.length,
              lastSource: state.lastSource,
              lastUpdate: state.lastUpdate,
              lastErrors: state.lastErrors,
            },
            events: debugBuffer,
            filters: includeFilters ? state.filters : undefined,
          });
          void recordEvent({
            stage: 'export',
            message: `exported ${bundle.events.length} events (filters ${includeFilters ? 'included' : 'excluded'})`,
          });
          return {
            ok: true,
            json: JSON.stringify(bundle, null, 2),
            filename: `kops-debug-${generatedAt.slice(0, 10)}.json`,
            summary: bundle.summary,
          };
        })()
          .then(sendResponse)
          .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
        return true;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown action' });
        return false;
    }
  },
);

// ─── Install handler ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log(LOG_PREFIX, 'Extension installed');
  chrome.action.setBadgeText({ text: '' });
});

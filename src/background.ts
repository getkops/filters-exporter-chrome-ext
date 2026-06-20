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

  const { filters, errors } = result;
  const canonical = canonicalSource(wire);

  if (filters.length === 0) {
    console.warn(LOG_PREFIX, `No valid filters parsed from ${source}`, errors);
    return { ok: false, count: 0, errors };
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
    return { ok: false, count: 0, errors: [...errors, msg] };
  }

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
  | { action: 'CLEAR_FILTERS' };

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

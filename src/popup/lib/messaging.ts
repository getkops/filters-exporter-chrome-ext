/**
 * messaging.ts — typed wrappers over the four runtime messages the popup sends
 * to the service worker. Centralizes the chrome.runtime.sendMessage plumbing
 * (lastError → reject) so components deal in promises, not callbacks.
 */
import { EXPORT_DEBUG_ACTION } from '../../diagnostics';
import type {
  ExportedFilter,
  FilterExportSource,
} from '../../generated/filter-export-schema.generated';

export interface FiltersResponse {
  ok?: boolean;
  error?: string;
  filters?: ExportedFilter[];
  lastSource?: FilterExportSource | null;
  lastUpdate?: string | null;
  lastErrors?: string[] | null;
}

export interface ExportResponse {
  ok?: boolean;
  error?: string;
  json?: string;
  count?: number;
}

export interface DebugResponse {
  ok?: boolean;
  error?: string;
  json?: string;
  filename?: string;
}

export interface BasicResponse {
  ok?: boolean;
  error?: string;
}

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response: T) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response ?? ({} as T));
      });
    } catch (err) {
      reject(err as Error);
    }
  });
}

export function getFilters(): Promise<FiltersResponse> {
  return sendMessage<FiltersResponse>({ action: 'GET_FILTERS' });
}

export function exportJson(selectedIndices?: number[]): Promise<ExportResponse> {
  return sendMessage<ExportResponse>({ action: 'EXPORT_JSON', selectedIndices });
}

export function clearFilters(): Promise<BasicResponse> {
  return sendMessage<BasicResponse>({ action: 'CLEAR_FILTERS' });
}

export function exportDebug(
  includeFilters: boolean,
  environment: { userAgent: string; language: string },
): Promise<DebugResponse> {
  return sendMessage<DebugResponse>({ action: EXPORT_DEBUG_ACTION, includeFilters, environment });
}

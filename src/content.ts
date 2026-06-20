/**
 * content.ts — Content script injected into V-Tools and Souk.to pages.
 * Bridges intercepted data from inject.ts (MAIN world) to the service worker.
 *
 * inject.ts is declared separately in manifest.json with world: "MAIN" so it
 * runs synchronously in the page context at document_start, eliminating any
 * race with page scripts.
 */

import { DIAG_MSG_TYPE, DIAG_ACTION } from './diagnostics';

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';

  interface InterceptedMessage {
    type: string;
    source: unknown;
    data: unknown;
  }

  function handlePageMessage(event: MessageEvent): void {
    // Extension context invalidated (e.g. extension reloaded) — detach cleanly.
    if (!chrome.runtime?.id) {
      window.removeEventListener('message', handlePageMessage);
      return;
    }

    // Only accept messages from the same window.
    if (event.source !== window) return;

    const msg = event.data as (InterceptedMessage & { event?: unknown }) | null;
    if (!msg || typeof msg.type !== 'string') return;

    // Diagnostics: best-effort forward to the worker's debug ring buffer.
    if (msg.type === DIAG_MSG_TYPE) {
      try {
        chrome.runtime.sendMessage({ action: DIAG_ACTION, event: msg.event });
      } catch {
        /* diagnostics must never disrupt the page */
      }
      return;
    }

    if (msg.type !== MSG_TYPE) return;

    if (!msg.source || typeof msg.source !== 'string') {
      console.warn(LOG_PREFIX, 'Invalid message: missing source');
      return;
    }
    if (!msg.data || typeof msg.data !== 'object') {
      console.warn(LOG_PREFIX, 'Invalid message: missing or invalid data');
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: 'FILTERS_INTERCEPTED', source: msg.source, data: msg.data },
        (response: { ok?: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            console.warn(LOG_PREFIX, 'Service worker error:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.ok) {
            console.log(LOG_PREFIX, `Forwarded ${String(msg.source)} filters to service worker`);
          }
        },
      );
    } catch (err) {
      console.error(LOG_PREFIX, 'Failed to send message to service worker:', err);
    }
  }

  window.addEventListener('message', handlePageMessage);
})();

/**
 * content.js — Content script injected into V-Tools and Souk.to pages.
 * Bridges intercepted data from inject.js (running in MAIN world)
 * to the service worker.
 *
 * Note: inject.js is declared separately in manifest.json with world: "MAIN"
 * so it runs synchronously in the page context at document_start,
 * eliminating any race condition with page scripts.
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';

  /**
   * Forward intercepted data from the page context to the service worker.
   * Validates the message structure before forwarding.
   */
  function handlePageMessage(event) {
    // Only accept messages from the same window
    if (event.source !== window) return;

    const msg = event.data;
    if (!msg || msg.type !== MSG_TYPE) return;

    // Validate payload structure
    if (!msg.source || typeof msg.source !== 'string') {
      console.warn(LOG_PREFIX, 'Invalid message: missing source');
      return;
    }
    if (!msg.data || typeof msg.data !== 'object') {
      console.warn(LOG_PREFIX, 'Invalid message: missing or invalid data');
      return;
    }

    // Forward to service worker with error handling
    try {
      chrome.runtime.sendMessage(
        {
          action: 'FILTERS_INTERCEPTED',
          source: msg.source,
          data: msg.data,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(LOG_PREFIX, 'Service worker error:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.ok) {
            console.log(LOG_PREFIX, `Forwarded ${msg.source} filters to service worker`);
          }
        }
      );
    } catch (err) {
      console.error(LOG_PREFIX, 'Failed to send message to service worker:', err);
    }
  }

  // ─── Init ─────────────────────────────────────────────────────

  window.addEventListener('message', handlePageMessage);
})();

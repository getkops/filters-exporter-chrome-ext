/**
 * content.js — Content script injected into V-Tools and Souk.to pages.
 * Injects inject.js into the page context and bridges messages
 * from the page to the service worker.
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';

  /**
   * Inject the page-context script into the DOM.
   * Uses the extension's web_accessible_resources URL.
   */
  function injectPageScript() {
    try {
      const url = chrome.runtime.getURL('src/inject.js');
      if (!url) {
        console.error(LOG_PREFIX, 'Failed to resolve inject.js URL');
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.onload = function () {
        this.remove();
      };
      script.onerror = function () {
        console.error(LOG_PREFIX, 'Failed to load inject.js');
        this.remove();
      };

      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(script);
      } else {
        console.error(LOG_PREFIX, 'No DOM target available for script injection');
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'Script injection failed:', err);
    }
  }

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

  injectPageScript();
  window.addEventListener('message', handlePageMessage);
})();

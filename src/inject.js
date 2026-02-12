/**
 * inject.js — Injected into the PAGE context (not content script context).
 * Monkey-patches fetch() and XMLHttpRequest to intercept API responses
 * from V-Tools and Souk.to filter endpoints.
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';
  const MSG_TYPE = '__FILTER_EXPORTER_INTERCEPTED__';

  const INTERCEPT_PATTERNS = [
    { source: 'vtools', pattern: 'custom.v-tools.com/v3/services/filters' },
    { source: 'souk', pattern: 'api.souk.to/api/v1/matching_alert/web' },
  ];

  /**
   * Check if a URL matches any of the intercept patterns.
   * @param {string} url
   * @returns {string|null} source name or null
   */
  function matchUrl(url) {
    if (!url || typeof url !== 'string') return null;
    for (const entry of INTERCEPT_PATTERNS) {
      if (url.includes(entry.pattern)) return entry.source;
    }
    return null;
  }

  /**
   * Safely post intercepted data to the content script via window.postMessage.
   * @param {string} source
   * @param {object} data
   */
  function postInterceptedData(source, data) {
    try {
      window.postMessage({ type: MSG_TYPE, source, data }, '*');
    } catch (err) {
      console.error(LOG_PREFIX, 'postMessage failed:', err);
    }
  }

  // ─── Patch fetch() ───────────────────────────────────────────────

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    let url = '';
    try {
      const request = args[0];
      url = typeof request === 'string'
        ? request
        : (request instanceof Request ? request.url : String(request?.url || ''));
    } catch (e) {
      // If we can't determine the URL, just proceed normally
      return originalFetch.apply(this, args);
    }

    const source = matchUrl(url);

    // Non-matching URL — pass through immediately
    if (!source) {
      return originalFetch.apply(this, args);
    }

    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (fetchErr) {
      // Network error — re-throw to preserve native behavior
      throw fetchErr;
    }

    // Clone and parse in background — never block the original response
    try {
      const clone = response.clone();
      clone.json().then((json) => {
        if (json && typeof json === 'object') {
          postInterceptedData(source, json);
        }
      }).catch(() => {
        // Non-JSON response for a matching URL — silently ignore
      });
    } catch (cloneErr) {
      console.warn(LOG_PREFIX, 'Failed to clone response:', cloneErr);
    }

    return response;
  };

  // ─── Patch XMLHttpRequest ────────────────────────────────────────

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this.__filterExporterUrl = typeof url === 'string' ? url : String(url);
    } catch (e) {
      this.__filterExporterUrl = '';
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this.__filterExporterUrl || '';
    const source = matchUrl(url);

    if (source) {
      this.addEventListener('load', function () {
        try {
          if (this.status >= 200 && this.status < 300 && this.responseText) {
            const json = JSON.parse(this.responseText);
            if (json && typeof json === 'object') {
              postInterceptedData(source, json);
            }
          }
        } catch (err) {
          // Non-JSON or parse error — silently ignore
        }
      });

      this.addEventListener('error', function () {
        // XHR error on a matching URL — nothing to intercept
      });
    }

    return originalXHRSend.apply(this, args);
  };

  console.log(LOG_PREFIX, 'Inject script loaded — monitoring API calls');
})();

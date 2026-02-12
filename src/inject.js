/**
 * inject.js — Injected into the PAGE context (not content script context).
 * Monkey-patches fetch() and XMLHttpRequest to intercept API responses
 * from V-Tools and Souk.to filter endpoints.
 */

(function () {
  "use strict";

  const INTERCEPT_PATTERNS = [
    {
      source: "vtools",
      pattern: "custom.v-tools.com/v3/services/filters",
    },
    {
      source: "souk",
      pattern: "api.souk.to/api/v1/matching_alert/web",
    },
  ];

  function matchUrl(url) {
    for (const entry of INTERCEPT_PATTERNS) {
      if (url.includes(entry.pattern)) {
        return entry.source;
      }
    }
    return null;
  }

  function postInterceptedData(source, data) {
    window.postMessage(
      {
        type: "__FILTER_EXPORTER_INTERCEPTED__",
        source,
        data,
      },
      "*",
    );
  }

  // ─── Patch fetch() ───────────────────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const request = args[0];
    const url = typeof request === "string" ? request : request?.url || "";

    const response = await originalFetch.apply(this, args);
    const source = matchUrl(url);

    if (source) {
      // Clone to avoid consuming the body
      const clone = response.clone();
      clone
        .json()
        .then((json) => {
          postInterceptedData(source, json);
        })
        .catch((err) => {
          console.warn("[Filter Exporter] Failed to parse response:", err);
        });
    }

    return response;
  };

  // ─── Patch XMLHttpRequest ────────────────────────────────────────
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__filterExporterUrl = url;
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const source = matchUrl(this.__filterExporterUrl || "");

    if (source) {
      this.addEventListener("load", function () {
        try {
          const json = JSON.parse(this.responseText);
          postInterceptedData(source, json);
        } catch (err) {
          console.warn("[Filter Exporter] Failed to parse XHR response:", err);
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };

  console.log(
    "[Filter Exporter] Inject script loaded — intercepting API calls",
  );
})();

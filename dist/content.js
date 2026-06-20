"use strict";
(() => {
  // src/diagnostics.ts
  var DIAG_MSG_TYPE = "__FILTER_EXPORTER_DIAG__";
  var DIAG_ACTION = "DIAG_EVENT";

  // src/content.ts
  (function() {
    "use strict";
    const LOG_PREFIX = "[Kops Filter Exporter]";
    const MSG_TYPE = "__FILTER_EXPORTER_INTERCEPTED__";
    function handlePageMessage(event) {
      if (!chrome.runtime?.id) {
        window.removeEventListener("message", handlePageMessage);
        return;
      }
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === DIAG_MSG_TYPE) {
        try {
          chrome.runtime.sendMessage({ action: DIAG_ACTION, event: msg.event });
        } catch {
        }
        return;
      }
      if (msg.type !== MSG_TYPE) return;
      if (!msg.source || typeof msg.source !== "string") {
        console.warn(LOG_PREFIX, "Invalid message: missing source");
        return;
      }
      if (!msg.data || typeof msg.data !== "object") {
        console.warn(LOG_PREFIX, "Invalid message: missing or invalid data");
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { action: "FILTERS_INTERCEPTED", source: msg.source, data: msg.data },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(LOG_PREFIX, "Service worker error:", chrome.runtime.lastError.message);
              return;
            }
            if (response?.ok) {
              console.log(LOG_PREFIX, `Forwarded ${String(msg.source)} filters to service worker`);
            }
          }
        );
      } catch (err) {
        console.error(LOG_PREFIX, "Failed to send message to service worker:", err);
      }
    }
    window.addEventListener("message", handlePageMessage);
  })();
})();

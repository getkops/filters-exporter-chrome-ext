/**
 * content.js — Content script injected into V-Tools and Souk.to pages.
 * Injects inject.js into the page context and bridges messages
 * from the page to the service worker.
 */

(function () {
  'use strict';

  // Inject the page-context script
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/inject.js');
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Listen for intercepted data from inject.js
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== '__FILTER_EXPORTER_INTERCEPTED__') return;

    const { source, data } = event.data;

    // Forward to service worker
    chrome.runtime.sendMessage({
      action: 'FILTERS_INTERCEPTED',
      source,
      data,
    });
  });
})();

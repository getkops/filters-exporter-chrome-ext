/**
 * background.js — Service worker for the Filter Exporter extension.
 * Receives intercepted API data from content scripts, parses it,
 * stores normalized filters, and serves data to the popup.
 */

// ─── Inline parsers (service workers can't use ES module imports) ──

function joinField(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map((item) => item[key] || '').join(' | ');
}

function parseVToolsFilters(response) {
  if (!response?.data || !Array.isArray(response.data)) {
    console.warn('[Filter Exporter] Invalid V-Tools response structure');
    return [];
  }
  return response.data.map((filter) => ({
    source: 'V-Tools',
    name: filter.name || '',
    search_text: filter.search_text || '',
    price_from: filter.price_from ?? '',
    price_to: filter.price_to ?? '',
    catalogs: joinField(filter.catalogs, 'data'),
    brands: joinField(filter.brands, 'data'),
    sizes: joinField(filter.sizes, 'data'),
    statuses: joinField(filter.statuses, 'data'),
    colors: joinField(filter.colors, 'data'),
    materials: joinField(filter.materials, 'data'),
    countries: joinField(filter.countries, 'data'),
    enabled: filter.enabled ? 'yes' : 'no',
  }));
}

function parseSoukFilters(response) {
  const alerts = response?.body?.alerts;
  if (!alerts || !Array.isArray(alerts)) {
    console.warn('[Filter Exporter] Invalid Souk.to response structure');
    return [];
  }
  return alerts.map((alert) => ({
    source: 'Souk.to',
    name: alert.name || '',
    search_text: alert.search_text || '',
    price_from: alert.price_from ?? '',
    price_to: alert.price_to ?? '',
    catalogs: joinField(alert.catalogs, 'title'),
    brands: joinField(alert.brands, 'title'),
    sizes: joinField(alert.sizes, 'title'),
    statuses: joinField(alert.status, 'title'),
    colors: joinField(alert.colors, 'title'),
    materials: '',
    countries: '',
    enabled: alert.is_deactivated ? 'no' : 'yes',
  }));
}

// ─── CSV Generation ────────────────────────────────────────────────

const CSV_COLUMNS = [
  'source', 'name', 'search_text', 'price_from', 'price_to',
  'catalogs', 'brands', 'sizes', 'statuses', 'colors',
  'materials', 'countries', 'enabled',
];

function escapeCsvValue(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('|')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function filtersToCSV(filters) {
  const header = CSV_COLUMNS.join(',');
  const rows = filters.map((filter) =>
    CSV_COLUMNS.map((col) => escapeCsvValue(filter[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

// ─── Message Handler ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FILTERS_INTERCEPTED') {
    handleInterceptedFilters(message.source, message.data);
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'GET_FILTERS') {
    chrome.storage.local.get(['filters', 'lastSource', 'lastUpdate'], (result) => {
      sendResponse({
        filters: result.filters || [],
        lastSource: result.lastSource || null,
        lastUpdate: result.lastUpdate || null,
      });
    });
    return true; // async response
  }

  if (message.action === 'EXPORT_CSV') {
    chrome.storage.local.get(['filters'], (result) => {
      const filters = result.filters || [];
      const csv = filtersToCSV(filters);
      sendResponse({ csv });
    });
    return true;
  }

  if (message.action === 'CLEAR_FILTERS') {
    chrome.storage.local.remove(['filters', 'lastSource', 'lastUpdate'], () => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});

// ─── Core Logic ────────────────────────────────────────────────────

function handleInterceptedFilters(source, data) {
  let filters = [];

  if (source === 'vtools') {
    filters = parseVToolsFilters(data);
  } else if (source === 'souk') {
    filters = parseSoukFilters(data);
  }

  if (filters.length === 0) {
    console.warn('[Filter Exporter] No filters parsed from', source);
    return;
  }

  const sourceName = source === 'vtools' ? 'V-Tools' : 'Souk.to';

  chrome.storage.local.set({
    filters,
    lastSource: sourceName,
    lastUpdate: new Date().toISOString(),
  });

  // Update badge
  chrome.action.setBadgeText({ text: String(filters.length) });
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

  console.log(`[Filter Exporter] Stored ${filters.length} filters from ${sourceName}`);
}

// ─── Install handler ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Filter Exporter] Extension installed');
  chrome.action.setBadgeText({ text: '' });
});

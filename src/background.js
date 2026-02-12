/**
 * background.js — Service worker for the Kops Filter Exporter extension.
 * Receives intercepted API data from content scripts, parses and validates it,
 * stores normalized filters, and serves data to the popup.
 */

const LOG_PREFIX = '[Kops Filter Exporter]';

// ─── Utility ───────────────────────────────────────────────────────

/**
 * Safely join array items by a key, returning a pipe-delimited string.
 * @param {Array} arr
 * @param {string} key
 * @returns {string}
 */
function joinField(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr
    .filter((item) => item != null && item[key] != null)
    .map((item) => String(item[key]))
    .join(' | ');
}

/**
 * Safely join array item IDs into a pipe-delimited string.
 * @param {Array} arr
 * @returns {string}
 */
function joinIds(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr
    .filter((item) => item != null && item.id != null)
    .map((item) => String(item.id))
    .join(' | ');
}

/**
 * Safely extract an array field from a filter object.
 * Handles missing fields, nulls, and non-array values.
 * @param {*} value
 * @returns {Array}
 */
function safeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

// ─── Parsers ───────────────────────────────────────────────────────

/**
 * Validate and normalize a single V-Tools filter object.
 * @param {object} filter
 * @returns {object|null} Normalized filter or null if invalid
 */
function normalizeVToolsFilter(filter) {
  if (!filter || typeof filter !== 'object') return null;

  // Name is required — skip unnamed filters
  const name = filter.name;
  if (name == null || String(name).trim() === '') return null;

  return {
    source: 'V-Tools',
    name: String(name),
    search_text: String(filter.search_text ?? ''),
    price_from: filter.price_from ?? '',
    price_to: filter.price_to ?? '',
    catalogs: joinField(safeArray(filter.catalogs), 'data'),
    catalog_ids: joinIds(safeArray(filter.catalogs)),
    brands: joinField(safeArray(filter.brands), 'data'),
    brand_ids: joinIds(safeArray(filter.brands)),
    sizes: joinField(safeArray(filter.sizes), 'data'),
    size_ids: joinIds(safeArray(filter.sizes)),
    statuses: joinField(safeArray(filter.statuses), 'data'),
    status_ids: joinIds(safeArray(filter.statuses)),
    colors: joinField(safeArray(filter.colors), 'data'),
    color_ids: joinIds(safeArray(filter.colors)),
    materials: joinField(safeArray(filter.materials), 'data'),
    material_ids: joinIds(safeArray(filter.materials)),
    countries: joinField(safeArray(filter.countries), 'data'),
    country_ids: joinIds(safeArray(filter.countries)),
    enabled: filter.enabled === true ? 'yes' : 'no',
  };
}

/**
 * Parse the full V-Tools API response.
 * @param {object} response
 * @returns {{ filters: Array, errors: string[] }}
 */
function parseVToolsFilters(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    errors.push('V-Tools response is not an object');
    return { filters: [], errors };
  }

  if (response.code !== undefined && response.code !== 0) {
    errors.push(`V-Tools API returned error code: ${response.code}`);
  }

  if (!Array.isArray(response.data)) {
    errors.push('V-Tools response.data is not an array');
    return { filters: [], errors };
  }

  const filters = [];
  response.data.forEach((raw, index) => {
    const normalized = normalizeVToolsFilter(raw);
    if (normalized) {
      filters.push(normalized);
    } else {
      errors.push(`V-Tools filter at index ${index} skipped (invalid or unnamed)`);
    }
  });

  return { filters, errors };
}

/**
 * Validate and normalize a single Souk.to alert object.
 * @param {object} alert
 * @returns {object|null}
 */
function normalizeSoukFilter(alert) {
  if (!alert || typeof alert !== 'object') return null;

  const name = alert.name;
  if (name == null || String(name).trim() === '') return null;

  return {
    source: 'Souk.to',
    name: String(name),
    search_text: String(alert.search_text ?? ''),
    price_from: alert.price_from ?? '',
    price_to: alert.price_to ?? '',
    catalogs: joinField(safeArray(alert.catalogs), 'title'),
    catalog_ids: joinIds(safeArray(alert.catalogs)),
    brands: joinField(safeArray(alert.brands), 'title'),
    brand_ids: joinIds(safeArray(alert.brands)),
    sizes: joinField(safeArray(alert.sizes), 'title'),
    size_ids: joinIds(safeArray(alert.sizes)),
    statuses: joinField(safeArray(alert.status), 'title'),
    status_ids: joinIds(safeArray(alert.status)),
    colors: joinField(safeArray(alert.colors), 'title'),
    color_ids: joinIds(safeArray(alert.colors)),
    materials: '',
    material_ids: '',
    countries: '',
    country_ids: '',
    enabled: alert.is_deactivated === true ? 'no' : 'yes',
  };
}

/**
 * Parse the full Souk.to API response.
 * @param {object} response
 * @returns {{ filters: Array, errors: string[] }}
 */
function parseSoukFilters(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    errors.push('Souk.to response is not an object');
    return { filters: [], errors };
  }

  if (response.type !== 'success') {
    errors.push(`Souk.to API returned type: ${response.type ?? 'undefined'}`);
  }

  const alerts = response?.body?.alerts;
  if (!Array.isArray(alerts)) {
    errors.push('Souk.to response.body.alerts is not an array');
    return { filters: [], errors };
  }

  const filters = [];
  alerts.forEach((raw, index) => {
    const normalized = normalizeSoukFilter(raw);
    if (normalized) {
      filters.push(normalized);
    } else {
      errors.push(`Souk.to alert at index ${index} skipped (invalid or unnamed)`);
    }
  });

  return { filters, errors };
}

// ─── CSV Generation ────────────────────────────────────────────────

const CSV_COLUMNS = [
  'source', 'name', 'search_text', 'price_from', 'price_to',
  'catalogs', 'catalog_ids',
  'brands', 'brand_ids',
  'sizes', 'size_ids',
  'statuses', 'status_ids',
  'colors', 'color_ids',
  'materials', 'material_ids',
  'countries', 'country_ids',
  'enabled',
];

/**
 * Sanitize and escape a CSV value for safe output.
 * Handles: emojis, accented chars, CJK, zero-width chars,
 * control characters, null bytes, carriage returns, surrogate pairs.
 * @param {*} value
 * @returns {string}
 */
function escapeCsvValue(value) {
  let str = String(value ?? '');

  // Strip null bytes and control characters (keep \n and \t)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize line endings: \r\n → \n, lone \r → \n
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip zero-width chars that can corrupt files
  str = str.replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g, '');

  // Quote if it contains: comma, double-quote, newline, pipe, tab,
  // semicolon (some locales), or any non-ASCII character (emoji, accented, CJK, etc.)
  // eslint-disable-next-line no-control-regex
  if (/[,"\n\t;|]/.test(str) || /[^\x20-\x7E]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Convert normalized filters into a CSV string.
 * @param {Array} filters
 * @returns {string}
 */
function filtersToCSV(filters) {
  if (!Array.isArray(filters) || filters.length === 0) return '';
  const header = CSV_COLUMNS.join(',');
  const rows = filters.map((filter) =>
    CSV_COLUMNS.map((col) => escapeCsvValue(filter[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

// ─── Storage Helpers ───────────────────────────────────────────────

/**
 * Save filters and metadata to chrome.storage.local.
 * @param {object} data
 * @returns {Promise<void>}
 */
function saveToStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Read keys from chrome.storage.local.
 * @param {string[]} keys
 * @returns {Promise<object>}
 */
function readFromStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Remove keys from chrome.storage.local.
 * @param {string[]} keys
 * @returns {Promise<void>}
 */
function removeFromStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ─── Core Logic ────────────────────────────────────────────────────

/**
 * Process intercepted filter data: parse, validate, store, update badge.
 * @param {string} source - 'vtools' or 'souk'
 * @param {object} data - raw API response
 * @returns {{ ok: boolean, count: number, errors: string[] }}
 */
async function handleInterceptedFilters(source, data) {
  let result;

  if (source === 'vtools') {
    result = parseVToolsFilters(data);
  } else if (source === 'souk') {
    result = parseSoukFilters(data);
  } else {
    return { ok: false, count: 0, errors: [`Unknown source: ${source}`] };
  }

  const { filters, errors } = result;

  if (filters.length === 0) {
    console.warn(LOG_PREFIX, `No valid filters parsed from ${source}`, errors);
    return { ok: false, count: 0, errors };
  }

  const sourceName = source === 'vtools' ? 'V-Tools' : 'Souk.to';

  try {
    await saveToStorage({
      filters,
      lastSource: sourceName,
      lastUpdate: new Date().toISOString(),
      lastErrors: errors.length > 0 ? errors : null,
    });
  } catch (storageErr) {
    const msg = `Storage save failed: ${storageErr.message}`;
    console.error(LOG_PREFIX, msg);
    return { ok: false, count: 0, errors: [...errors, msg] };
  }

  // Update badge
  try {
    chrome.action.setBadgeText({ text: String(filters.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
  } catch (badgeErr) {
    console.warn(LOG_PREFIX, 'Badge update failed:', badgeErr);
  }

  if (errors.length > 0) {
    console.warn(LOG_PREFIX, `Stored ${filters.length} filters from ${sourceName} with ${errors.length} warnings:`, errors);
  } else {
    console.log(LOG_PREFIX, `Stored ${filters.length} filters from ${sourceName}`);
  }

  return { ok: true, count: filters.length, errors };
}

// ─── Message Handler ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) {
    sendResponse({ ok: false, error: 'Invalid message: missing action' });
    return false;
  }

  switch (message.action) {
    case 'FILTERS_INTERCEPTED': {
      if (!message.source || !message.data) {
        sendResponse({ ok: false, error: 'Missing source or data' });
        return false;
      }
      // Handle async with promise
      handleInterceptedFilters(message.source, message.data)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async
    }

    case 'GET_FILTERS': {
      readFromStorage(['filters', 'lastSource', 'lastUpdate', 'lastErrors'])
        .then((result) => {
          sendResponse({
            ok: true,
            filters: result.filters || [],
            lastSource: result.lastSource || null,
            lastUpdate: result.lastUpdate || null,
            lastErrors: result.lastErrors || null,
          });
        })
        .catch((err) => {
          sendResponse({ ok: false, error: err.message, filters: [] });
        });
      return true;
    }

    case 'EXPORT_CSV': {
      readFromStorage(['filters'])
        .then((result) => {
          const filters = result.filters || [];
          if (filters.length === 0) {
            sendResponse({ ok: false, error: 'No filters to export' });
            return;
          }
          const csv = filtersToCSV(filters);
          sendResponse({ ok: true, csv, count: filters.length });
        })
        .catch((err) => {
          sendResponse({ ok: false, error: err.message });
        });
      return true;
    }

    case 'CLEAR_FILTERS': {
      removeFromStorage(['filters', 'lastSource', 'lastUpdate', 'lastErrors'])
        .then(() => {
          chrome.action.setBadgeText({ text: '' });
          sendResponse({ ok: true });
        })
        .catch((err) => {
          sendResponse({ ok: false, error: err.message });
        });
      return true;
    }

    default:
      sendResponse({ ok: false, error: `Unknown action: ${message.action}` });
      return false;
  }
});

// ─── Install handler ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log(LOG_PREFIX, 'Extension installed');
  chrome.action.setBadgeText({ text: '' });
});

/**
 * parsers/souk.js — Souk.to API response parser.
 * Normalizes alert data into the universal flat format.
 */

/**
 * Safely join array items by a key.
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
 * Safely join array item IDs.
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Parse Souk.to API response into normalized filters.
 * @param {object} response - Raw API response
 * @returns {Array} Normalized filter objects
 */
export function parseSoukFilters(response) {
  const alerts = response?.body?.alerts;

  if (!alerts || !Array.isArray(alerts)) {
    console.warn('[Filter Exporter] Invalid Souk.to response structure');
    return [];
  }

  return alerts
    .filter((alert) => alert && alert.name)
    .map((alert) => ({
      source: 'Souk.to',
      name: String(alert.name),
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
      video_game_platforms: joinField(safeArray(alert.video_game_platforms), 'title'),
      video_game_platform_ids: joinIds(safeArray(alert.video_game_platforms)),
      enabled: alert.is_deactivated === true ? 'no' : 'yes',
    }));
}

/**
 * parsers/vtools.js — V-Tools API response parser.
 * Normalizes filter data into a universal flat format.
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
 * Parse V-Tools API response into normalized filters.
 * @param {object} response - Raw API response
 * @returns {Array} Normalized filter objects
 */
export function parseVToolsFilters(response) {
  if (!response?.data || !Array.isArray(response.data)) {
    console.warn('[Filter Exporter] Invalid V-Tools response structure');
    return [];
  }

  return response.data
    .filter((filter) => filter && filter.name)
    .map((filter) => ({
      source: 'V-Tools',
      name: String(filter.name),
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
    }));
}

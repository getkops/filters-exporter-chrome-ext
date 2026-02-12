/**
 * vtools.js — Parser for V-Tools filter API response.
 *
 * V-Tools response structure:
 * {
 *   data: [{ name, search_text, price_from, price_to, catalogs: [{id, data}], brands, sizes, statuses, colors, materials, countries, enabled, ... }],
 *   code: 0
 * }
 */

export function parseVToolsFilters(response) {
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

function joinField(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map((item) => item[key] || '').join(' | ');
}

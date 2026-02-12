/**
 * souk.js — Parser for Souk.to filter API response.
 *
 * Souk.to response structure:
 * {
 *   type: "success",
 *   body: {
 *     alerts: [{ name, search_text, price_from, price_to, catalogs: [{id, title}], brands, sizes, colors, status, is_deactivated, ... }],
 *     pagination: { ... }
 *   }
 * }
 */

export function parseSoukFilters(response) {
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

function joinField(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map((item) => item[key] || '').join(' | ');
}

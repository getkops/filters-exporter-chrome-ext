/**
 * export.js — CSV export utilities for the Kops Filter Exporter.
 * Handles CSV generation and file download with UTF-8 BOM for Excel compatibility.
 */

const CSV_COLUMNS = [
  'source', 'name', 'search_text', 'price_from', 'price_to',
  'catalogs', 'catalog_ids',
  'brands', 'brand_ids',
  'sizes', 'size_ids',
  'statuses', 'status_ids',
  'colors', 'color_ids',
  'materials', 'material_ids',
  'countries', 'country_ids',
  'video_game_platforms', 'video_game_platform_ids',
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
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  str = str.replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g, '');
  if (/[,"\n\t;|]/.test(str) || /[^\x20-\x7E]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Convert an array of normalized filter objects into a CSV string.
 * @param {Array} filters
 * @returns {string} CSV string (without BOM)
 */
export function filtersToCSV(filters) {
  if (!Array.isArray(filters) || filters.length === 0) return '';
  const header = CSV_COLUMNS.join(',');
  const rows = filters.map((filter) =>
    CSV_COLUMNS.map((col) => escapeCsvValue(filter[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Trigger a CSV file download in the browser.
 * Includes UTF-8 BOM for Excel compatibility.
 * @param {string} csvString
 * @param {string} filename
 */
export function downloadCSV(csvString, filename) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}

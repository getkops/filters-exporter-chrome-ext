/**
 * export.js — CSV generation and download utility.
 */

const CSV_COLUMNS = [
  'source',
  'name',
  'search_text',
  'price_from',
  'price_to',
  'catalogs',
  'brands',
  'sizes',
  'statuses',
  'colors',
  'materials',
  'countries',
  'enabled',
];

/**
 * Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsvValue(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('|')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Convert an array of normalized filter objects into a CSV string.
 */
export function filtersToCSV(filters) {
  const header = CSV_COLUMNS.join(',');
  const rows = filters.map((filter) =>
    CSV_COLUMNS.map((col) => escapeCsvValue(filter[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Trigger a file download in the browser.
 */
export function downloadCSV(csvString, filename = 'filters_export.csv') {
  // Add BOM for proper UTF-8 handling in Excel
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
  }, 100);
}

import type { Messages } from './types';

/** English catalog (the default / fallback locale). */
export const en: Messages = {
  // Header
  tagline: 'Extract filters from V-Tools & Souk.to',
  howItWorks: 'How it works',
  close: 'Close',

  // Status chip
  statusWaiting: 'Waiting for data…',
  sourceVtools: 'V-Tools',
  sourceSouk: 'Souk.to',
  sourceGeneric: 'Filters',
  captured: (n) => `${n} captured`,

  // Toolbar
  searchPlaceholder: 'Search filters…',
  filtersShown: (n) => `${n} shown`,
  selectedOf: (selected, total) => `${selected} of ${total} selected`,
  selectAll: 'Select all',

  // Table
  colName: 'Name',
  colBrands: 'Brands',
  colPrice: 'Price',
  colStatus: 'Status',
  statusActive: 'Active',
  statusOff: 'Off',
  unnamed: '(unnamed)',
  noResults: 'No filters match your search',

  // Action bar
  exportN: (n) => `Export ${n}`,
  exportSelectedN: (n) => `Export ${n} selected`,
  refresh: 'Refresh',
  more: 'More',

  // Menus
  refreshVtools: 'Refresh V-Tools',
  refreshSouk: 'Refresh Souk.to',
  clear: 'Clear filters',
  debugExport: 'Export debug session',
  debugInclude: 'Include filter data',
  debugIncludeHint: 'Includes your captured filters in the bundle (your own data)',
  lastCapture: (time) => `Last capture ${time}`,

  // Empty state / onboarding
  emptyTitle: 'No filters captured yet',
  step1: 'Open your V-Tools or Souk.to filters page',
  step2: 'Your filters are captured automatically',
  step3: 'Come back here and export them',
  openVtools: 'Open V-Tools',
  openSouk: 'Open Souk.to',

  // Loading
  loading: 'Loading filters…',

  // Errors
  errConnect: "Couldn't reach the extension. Try reopening the popup.",
  errParse: (n) => `${n} warning${n !== 1 ? 's' : ''} during capture`,
  errExport: 'Export failed — try again',
  errNoFilters: 'No filters to export',
  errClear: 'Clear failed — try again',
  errDownload: 'Download failed — check the console',
  errOpenPage: "Couldn't open the page",
  errDebug: 'Debug export failed — try again',

  // Toasts
  toastExported: (n) => `Exported ${n} filter${n !== 1 ? 's' : ''}`,
  toastCleared: 'Filters cleared',
  toastDebugSavedCopied: 'Debug session saved + copied',
  toastDebugSaved: 'Debug session saved',
  refreshOpening: (source) =>
    `Opening ${source} — filters capture automatically. Reopen this popup to see them.`,
};

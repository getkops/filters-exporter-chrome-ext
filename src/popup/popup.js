/**
 * popup.js — Popup UI logic for the Kops Filter Exporter extension.
 * Handles filter display, CSV export, and live updates with comprehensive error handling.
 */

(function () {
  'use strict';

  // ─── DOM References ───────────────────────────────────────────

  const $ = (id) => document.getElementById(id);

  const statusBar = $('statusBar');
  const statusText = $('statusText');
  const statusBadge = $('statusBadge');
  const errorBanner = $('errorBanner');
  const errorText = $('errorText');
  const loadingState = $('loadingState');
  const emptyState = $('emptyState');
  const filterTable = $('filterTable');
  const filterTableBody = $('filterTableBody');
  const exportBtn = $('exportBtn');
  const clearBtn = $('clearBtn');
  const lastUpdateEl = $('lastUpdate');

  // ─── State ────────────────────────────────────────────────────

  let isExporting = false;

  // ─── CSV Generation ───────────────────────────────────────────

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

  function filtersToCSV(filters) {
    if (!Array.isArray(filters) || filters.length === 0) return '';
    const header = CSV_COLUMNS.join(',');
    const rows = filters.map((filter) =>
      CSV_COLUMNS.map((col) => escapeCsvValue(filter[col])).join(',')
    );
    return [header, ...rows].join('\n');
  }

  function downloadCSV(csvString, filename) {
    try {
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
    } catch (err) {
      console.error('[Kops Filter Exporter] CSV download failed:', err);
      showToast('Download failed — check console', 'error');
    }
  }

  // ─── Communication ────────────────────────────────────────────

  /**
   * Send a message to the service worker with error handling.
   * @param {object} message
   * @returns {Promise<object>}
   */
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response || {});
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── UI State Transitions ────────────────────────────────────

  function showLoading() {
    loadingState.style.display = 'flex';
    emptyState.style.display = 'none';
    filterTable.style.display = 'none';
    hideError();
  }

  function showEmpty() {
    loadingState.style.display = 'none';
    emptyState.style.display = 'flex';
    filterTable.style.display = 'none';
    statusBar.classList.remove('active');
    statusText.textContent = 'Waiting for data…';
    statusBadge.textContent = '0';
    exportBtn.disabled = true;
    clearBtn.disabled = true;
    lastUpdateEl.textContent = '';
  }

  function showError(message) {
    errorBanner.style.display = 'flex';
    errorText.textContent = message;
  }

  function hideError() {
    errorBanner.style.display = 'none';
    errorText.textContent = '';
  }

  // ─── Render Filters ──────────────────────────────────────────

  function renderFilters(filters, source, updated, errors) {
    // Hide loading, show table
    loadingState.style.display = 'none';
    emptyState.style.display = 'none';
    filterTable.style.display = 'table';

    // Status bar
    statusBar.classList.add('active');
    const count = filters.length;
    statusText.textContent = `${source} — ${count} filter${count !== 1 ? 's' : ''} captured`;
    statusBadge.textContent = String(count);

    // Show warning if there were parse errors
    if (errors && errors.length > 0) {
      showError(`${errors.length} warning${errors.length !== 1 ? 's' : ''} during parsing`);
    } else {
      hideError();
    }

    // Build table rows
    filterTableBody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    filters.forEach((filter) => {
      const tr = document.createElement('tr');

      // Name cell
      const tdName = document.createElement('td');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'filter-name';
      nameSpan.textContent = filter.name || '(unnamed)';
      nameSpan.title = filter.name || '';
      tdName.appendChild(nameSpan);
      tr.appendChild(tdName);

      // Brands cell
      const tdBrands = document.createElement('td');
      const brandsSpan = document.createElement('span');
      brandsSpan.className = 'filter-brands';
      brandsSpan.textContent = filter.brands || '—';
      brandsSpan.title = filter.brands || '';
      tdBrands.appendChild(brandsSpan);
      tr.appendChild(tdBrands);

      // Price cell
      const tdPrice = document.createElement('td');
      const priceSpan = document.createElement('span');
      priceSpan.className = 'filter-price';
      const from = filter.price_from !== '' && filter.price_from != null ? filter.price_from : '0';
      const to = filter.price_to !== '' && filter.price_to != null ? filter.price_to : '∞';
      priceSpan.textContent = `€${from}–${to}`;
      tdPrice.appendChild(priceSpan);
      tr.appendChild(tdPrice);

      // Status cell
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      const isActive = filter.enabled === 'yes';
      badge.className = `badge ${isActive ? 'badge-active' : 'badge-inactive'}`;
      badge.textContent = isActive ? 'Active' : 'Off';
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      fragment.appendChild(tr);
    });

    filterTableBody.appendChild(fragment);

    // Enable buttons
    exportBtn.disabled = false;
    clearBtn.disabled = false;

    // Footer timestamp
    if (updated) {
      try {
        const date = new Date(updated);
        if (!isNaN(date.getTime())) {
          lastUpdateEl.textContent = `Last capture: ${date.toLocaleTimeString()}`;
        }
      } catch (e) {
        lastUpdateEl.textContent = '';
      }
    }
  }

  // ─── Load Filters ────────────────────────────────────────────

  async function loadFilters() {
    showLoading();

    try {
      const response = await sendMessage({ action: 'GET_FILTERS' });

      if (!response.ok && response.error) {
        showEmpty();
        showError(response.error);
        return;
      }

      const { filters, lastSource, lastUpdate, lastErrors } = response;

      if (Array.isArray(filters) && filters.length > 0) {
        renderFilters(filters, lastSource, lastUpdate, lastErrors);
      } else {
        showEmpty();
      }
    } catch (err) {
      console.error('[Kops Filter Exporter] Failed to load filters:', err);
      showEmpty();
      showError('Could not connect to service worker');
    }
  }

  // ─── Toast ────────────────────────────────────────────────────

  function showToast(message, type = '') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach((t) => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow then animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── Event Listeners ─────────────────────────────────────────

  exportBtn.addEventListener('click', async () => {
    if (isExporting) return;
    isExporting = true;
    exportBtn.disabled = true;

    try {
      const response = await sendMessage({ action: 'GET_FILTERS' });

      if (!response.filters || response.filters.length === 0) {
        showToast('No filters to export');
        return;
      }

      const csv = filtersToCSV(response.filters);
      if (!csv) {
        showToast('Failed to generate CSV');
        return;
      }

      const source = (response.lastSource || 'filters')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${source}_filters_${timestamp}.csv`;

      downloadCSV(csv, filename);
      showToast(`Exported ${response.filters.length} filters`, 'success');
    } catch (err) {
      console.error('[Kops Filter Exporter] Export failed:', err);
      showToast('Export failed — try again', 'error');
    } finally {
      isExporting = false;
      exportBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', async () => {
    clearBtn.disabled = true;

    try {
      await sendMessage({ action: 'CLEAR_FILTERS' });
      showEmpty();
      hideError();
      showToast('Filters cleared');
    } catch (err) {
      console.error('[Kops Filter Exporter] Clear failed:', err);
      showToast('Clear failed — try again', 'error');
      clearBtn.disabled = false;
    }
  });

  // ─── Live Updates ─────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.filters) {
      loadFilters();
    }
  });

  // ─── Init ─────────────────────────────────────────────────────

  loadFilters();
})();

/**
 * popup.js — Popup UI logic for the Filter Exporter extension.
 */

(function () {
  'use strict';

  // ─── DOM Elements ──────────────────────────────────────────────
  const statusBar = document.getElementById('statusBar');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusBadge = document.getElementById('statusBadge');
  const emptyState = document.getElementById('emptyState');
  const filterTable = document.getElementById('filterTable');
  const filterTableBody = document.getElementById('filterTableBody');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const lastUpdate = document.getElementById('lastUpdate');

  // ─── CSV Generation (inline for popup context) ────────────────

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

  function downloadCSV(csvString, filename) {
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

  // ─── Load Filters ─────────────────────────────────────────────

  function loadFilters() {
    chrome.runtime.sendMessage({ action: 'GET_FILTERS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Filter Exporter] Error:', chrome.runtime.lastError);
        return;
      }

      const { filters, lastSource, lastUpdate: updated } = response;

      if (filters && filters.length > 0) {
        renderFilters(filters, lastSource, updated);
      } else {
        renderEmpty();
      }
    });
  }

  // ─── Render Filters ───────────────────────────────────────────

  function renderFilters(filters, source, updated) {
    // Status bar
    statusBar.classList.add('active');
    statusText.textContent = `${source} — ${filters.length} filter${filters.length > 1 ? 's' : ''} captured`;
    statusBadge.textContent = String(filters.length);

    // Show table, hide empty state
    emptyState.style.display = 'none';
    filterTable.style.display = 'table';

    // Clear and populate table
    filterTableBody.innerHTML = '';
    filters.forEach((filter) => {
      const tr = document.createElement('tr');

      // Name
      const tdName = document.createElement('td');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'filter-name';
      nameSpan.textContent = filter.name;
      nameSpan.title = filter.name;
      tdName.appendChild(nameSpan);
      tr.appendChild(tdName);

      // Brands
      const tdBrands = document.createElement('td');
      const brandsSpan = document.createElement('span');
      brandsSpan.className = 'filter-brands';
      brandsSpan.textContent = filter.brands || '—';
      brandsSpan.title = filter.brands || '';
      tdBrands.appendChild(brandsSpan);
      tr.appendChild(tdBrands);

      // Price
      const tdPrice = document.createElement('td');
      const priceSpan = document.createElement('span');
      priceSpan.className = 'filter-price';
      const from = filter.price_from !== '' ? filter.price_from : '0';
      const to = filter.price_to !== '' ? filter.price_to : '∞';
      priceSpan.textContent = `€${from}–${to}`;
      tdPrice.appendChild(priceSpan);
      tr.appendChild(tdPrice);

      // Status
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${filter.enabled === 'yes' ? 'badge-active' : 'badge-inactive'}`;
      badge.textContent = filter.enabled === 'yes' ? 'Active' : 'Off';
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      filterTableBody.appendChild(tr);
    });

    // Enable buttons
    exportBtn.disabled = false;
    clearBtn.disabled = false;

    // Footer
    if (updated) {
      const date = new Date(updated);
      lastUpdate.textContent = `Last capture: ${date.toLocaleTimeString()}`;
    }
  }

  function renderEmpty() {
    statusBar.classList.remove('active');
    statusText.textContent = 'Waiting for data…';
    statusBadge.textContent = '0';
    emptyState.style.display = 'flex';
    filterTable.style.display = 'none';
    exportBtn.disabled = true;
    clearBtn.disabled = true;
    lastUpdate.textContent = '';
  }

  // ─── Toast ────────────────────────────────────────────────────

  function showToast(message, type = '') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach((t) => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ─── Event Listeners ─────────────────────────────────────────

  exportBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'GET_FILTERS' }, (response) => {
      if (chrome.runtime.lastError || !response.filters?.length) {
        showToast('No filters to export');
        return;
      }

      const csv = filtersToCSV(response.filters);
      const source = (response.lastSource || 'filters').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${source}_filters_${timestamp}.csv`;

      downloadCSV(csv, filename);
      showToast(`Exported ${response.filters.length} filters`, 'success');
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_FILTERS' }, () => {
      renderEmpty();
      showToast('Filters cleared');
    });
  });

  // ─── Listen for live updates from background ──────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.filters) {
      loadFilters();
    }
  });

  // ─── Init ─────────────────────────────────────────────────────

  loadFilters();
})();

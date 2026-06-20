/**
 * popup.ts — Popup UI logic for the Kops Filter Exporter extension.
 * Renders the typed `ExportedFilter` shape, handles search + row selection,
 * and downloads the validated JSON export envelope built by the service worker.
 */

import {
  FILTER_EXPORT_SCHEMA_VERSION,
  type ExportedFilter,
  type FilterExportSource,
} from '../generated/filter-export-schema.generated';

(function () {
  'use strict';

  const LOG_PREFIX = '[Kops Filter Exporter]';

  // ─── DOM references ───────────────────────────────────────────

  const $ = (id: string): HTMLElement => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el;
  };

  const statusBar = $('statusBar');
  const statusText = $('statusText');
  const statusBadge = $('statusBadge');
  const errorBanner = $('errorBanner');
  const errorText = $('errorText');
  const loadingState = $('loadingState');
  const emptyState = $('emptyState');
  const filterTable = $('filterTable');
  const filterTableBody = $('filterTableBody');
  const exportBtn = $('exportBtn') as HTMLButtonElement;
  const clearBtn = $('clearBtn') as HTMLButtonElement;
  const lastUpdateEl = $('lastUpdate');
  const searchBar = $('searchBar');
  const searchInput = $('searchInput') as HTMLInputElement;
  const selectionToolbar = $('selectionToolbar');
  const selectAllCheckbox = $('selectAllCheckbox') as HTMLInputElement;
  const selectionText = $('selectionText');
  const headerCheckbox = $('headerCheckbox') as HTMLInputElement;
  const refreshDropdown = $('refreshDropdown');
  const refreshBtn = $('refreshBtn');
  const refreshMenu = $('refreshMenu');
  const debugExportBtn = $('debugExportBtn') as HTMLButtonElement;
  const debugIncludeFilters = $('debugIncludeFilters') as HTMLInputElement;

  // ─── State ────────────────────────────────────────────────────

  let isExporting = false;
  let allFilters: ExportedFilter[] = [];
  let visibleIndices: number[] = [];
  let selectedIndices = new Set<number>();

  const REFRESH_TARGETS: Record<string, string> = {
    vtoolsv2: 'https://dashboard.v-tools.com/dashboard/filters',
    souk: 'https://souk.to/app/alerts',
  };

  interface FiltersResponse {
    ok?: boolean;
    error?: string;
    filters?: ExportedFilter[];
    lastSource?: FilterExportSource | null;
    lastUpdate?: string | null;
    lastErrors?: string[] | null;
  }

  interface ExportResponse {
    ok?: boolean;
    error?: string;
    json?: string;
    count?: number;
  }

  interface DebugResponse {
    ok?: boolean;
    error?: string;
    json?: string;
    filename?: string;
  }

  // ─── Communication ────────────────────────────────────────────

  function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response: T) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response ?? ({} as T));
        });
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  // ─── JSON download ────────────────────────────────────────────

  function downloadJSON(jsonString: string, filename: string): void {
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
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
      console.error(LOG_PREFIX, 'JSON download failed:', err);
      showToast('Download failed — check console', 'error');
    }
  }

  // ─── Filter-shape display helpers ─────────────────────────────

  function brandsText(filter: ExportedFilter): string {
    return filter.brand_names.length > 0 ? filter.brand_names.join(', ') : '—';
  }

  function priceText(filter: ExportedFilter): string {
    const from = filter.price_min != null ? String(filter.price_min) : '0';
    const to = filter.price_max != null ? String(filter.price_max) : '∞';
    return `€${from}–${to}`;
  }

  function keywordText(filter: ExportedFilter): string {
    const parts: string[] = [];
    if (filter.keyword_rules) {
      for (const group of filter.keyword_rules.groups) parts.push(...group.keywords);
    }
    parts.push(...filter.blacklist_keywords);
    return parts.join(' ');
  }

  // ─── UI state transitions ────────────────────────────────────

  function showLoading(): void {
    loadingState.style.display = 'flex';
    emptyState.style.display = 'none';
    filterTable.style.display = 'none';
    searchBar.style.display = 'none';
    selectionToolbar.style.display = 'none';
    hideError();
  }

  function showEmpty(): void {
    loadingState.style.display = 'none';
    emptyState.style.display = 'flex';
    filterTable.style.display = 'none';
    searchBar.style.display = 'none';
    selectionToolbar.style.display = 'none';
    statusBar.classList.remove('active');
    statusText.textContent = 'Waiting for data…';
    statusBadge.textContent = '0';
    exportBtn.disabled = true;
    clearBtn.disabled = true;
    lastUpdateEl.textContent = '';
  }

  function showError(message: string): void {
    errorBanner.style.display = 'flex';
    errorText.textContent = message;
  }

  function hideError(): void {
    errorBanner.style.display = 'none';
    errorText.textContent = '';
  }

  // ─── Search ──────────────────────────────────────────────────

  function getSearchQuery(): string {
    return (searchInput.value || '').trim().toLowerCase();
  }

  function filterMatchesSearch(filter: ExportedFilter, query: string): boolean {
    if (!query) return true;
    const searchable = [filter.name, ...filter.brand_names, keywordText(filter)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(query);
  }

  function computeVisibleIndices(): void {
    const query = getSearchQuery();
    visibleIndices = [];
    allFilters.forEach((filter, i) => {
      if (filterMatchesSearch(filter, query)) visibleIndices.push(i);
    });
  }

  // ─── Selection ───────────────────────────────────────────────

  function makeExportIcon(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function setExportLabel(text: string): void {
    exportBtn.textContent = '';
    exportBtn.appendChild(makeExportIcon());
    exportBtn.appendChild(document.createTextNode(` ${text}`));
  }

  function updateSelectionUI(): void {
    const count = selectedIndices.size;
    const visibleCount = visibleIndices.length;
    const visibleSelected = visibleIndices.filter((i) => selectedIndices.has(i)).length;

    if (allFilters.length > 0) {
      selectionToolbar.style.display = 'flex';
      selectionText.textContent =
        count === 0
          ? `${visibleCount} filter${visibleCount !== 1 ? 's' : ''} shown`
          : `${count} of ${allFilters.length} selected`;
    } else {
      selectionToolbar.style.display = 'none';
    }

    const allVisibleSelected = visibleCount > 0 && visibleSelected === visibleCount;
    const someVisibleSelected = visibleSelected > 0 && visibleSelected < visibleCount;

    selectAllCheckbox.checked = allVisibleSelected;
    selectAllCheckbox.classList.toggle('indeterminate', someVisibleSelected);
    headerCheckbox.checked = allVisibleSelected;
    headerCheckbox.classList.toggle('indeterminate', someVisibleSelected);

    const hasSelection = count > 0;
    const rows = filterTableBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const idx = parseInt((row as HTMLElement).dataset.filterIndex ?? '-1', 10);
      const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (cb) cb.checked = selectedIndices.has(idx);
      row.classList.toggle('unselected', hasSelection && !selectedIndices.has(idx));
    });

    setExportLabel(count > 0 ? `Export ${count} selected` : 'Export JSON');
  }

  function toggleSelectAll(): void {
    const visibleSelected = visibleIndices.filter((i) => selectedIndices.has(i)).length;
    const allVisible = visibleSelected === visibleIndices.length;
    if (allVisible) visibleIndices.forEach((i) => selectedIndices.delete(i));
    else visibleIndices.forEach((i) => selectedIndices.add(i));
    updateSelectionUI();
  }

  function toggleRow(index: number): void {
    if (selectedIndices.has(index)) selectedIndices.delete(index);
    else selectedIndices.add(index);
    updateSelectionUI();
  }

  // ─── Render ──────────────────────────────────────────────────

  function renderTable(): void {
    filterTableBody.innerHTML = '';

    if (visibleIndices.length === 0 && getSearchQuery()) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'no-results';
      td.textContent = 'No filters match your search';
      tr.appendChild(td);
      filterTableBody.appendChild(tr);
      return;
    }

    const hasSelection = selectedIndices.size > 0;
    const fragment = document.createDocumentFragment();

    visibleIndices.forEach((filterIndex) => {
      const filter = allFilters[filterIndex];
      const tr = document.createElement('tr');
      tr.dataset.filterIndex = String(filterIndex);

      const tdCheck = document.createElement('td');
      tdCheck.className = 'td-checkbox';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selectedIndices.has(filterIndex);
      cb.addEventListener('change', () => toggleRow(filterIndex));
      tdCheck.appendChild(cb);
      tr.appendChild(tdCheck);

      const tdName = document.createElement('td');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'filter-name';
      nameSpan.textContent = filter.name || '(unnamed)';
      nameSpan.title = filter.name || '';
      tdName.appendChild(nameSpan);
      tr.appendChild(tdName);

      const tdBrands = document.createElement('td');
      const brandsSpan = document.createElement('span');
      brandsSpan.className = 'filter-brands';
      const brands = brandsText(filter);
      brandsSpan.textContent = brands;
      brandsSpan.title = brands === '—' ? '' : brands;
      tdBrands.appendChild(brandsSpan);
      tr.appendChild(tdBrands);

      const tdPrice = document.createElement('td');
      const priceSpan = document.createElement('span');
      priceSpan.className = 'filter-price';
      priceSpan.textContent = priceText(filter);
      tdPrice.appendChild(priceSpan);
      tr.appendChild(tdPrice);

      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      const isActive = filter.enabled === true;
      badge.className = `badge ${isActive ? 'badge-active' : 'badge-inactive'}`;
      badge.textContent = isActive ? 'Active' : 'Off';
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      if (hasSelection && !selectedIndices.has(filterIndex)) tr.classList.add('unselected');

      fragment.appendChild(tr);
    });

    filterTableBody.appendChild(fragment);
  }

  function sourceLabel(source: FilterExportSource | null): string {
    if (source === 'vtools') return 'V-Tools';
    if (source === 'souk') return 'Souk.to';
    return 'Filters';
  }

  function renderFilters(
    filters: ExportedFilter[],
    source: FilterExportSource | null,
    updated: string | null,
    errors: string[] | null,
  ): void {
    allFilters = filters;
    selectedIndices = new Set();

    loadingState.style.display = 'none';
    emptyState.style.display = 'none';
    filterTable.style.display = 'table';
    searchBar.style.display = 'flex';

    statusBar.classList.add('active');
    const count = filters.length;
    statusText.textContent = `${sourceLabel(source)} — ${count} filter${count !== 1 ? 's' : ''} captured`;
    statusBadge.textContent = String(count);

    if (errors && errors.length > 0) {
      showError(`${errors.length} warning${errors.length !== 1 ? 's' : ''} during parsing`);
    } else {
      hideError();
    }

    computeVisibleIndices();
    renderTable();
    updateSelectionUI();

    exportBtn.disabled = false;
    clearBtn.disabled = false;

    if (updated) {
      try {
        const date = new Date(updated);
        if (!Number.isNaN(date.getTime())) {
          lastUpdateEl.textContent = `Last capture: ${date.toLocaleTimeString()}`;
        }
      } catch {
        lastUpdateEl.textContent = '';
      }
    }
  }

  // ─── Load filters ────────────────────────────────────────────

  async function loadFilters(): Promise<void> {
    showLoading();
    try {
      const response = await sendMessage<FiltersResponse>({ action: 'GET_FILTERS' });
      if (!response.ok && response.error) {
        showEmpty();
        showError(response.error);
        return;
      }
      const filters = response.filters;
      if (Array.isArray(filters) && filters.length > 0) {
        renderFilters(filters, response.lastSource ?? null, response.lastUpdate ?? null, response.lastErrors ?? null);
      } else {
        showEmpty();
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'Failed to load filters:', err);
      showEmpty();
      showError('Could not connect to service worker');
    }
  }

  // ─── Toast ────────────────────────────────────────────────────

  function showToast(message: string, type = ''): void {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── Event listeners ─────────────────────────────────────────

  searchInput.addEventListener('input', () => {
    computeVisibleIndices();
    renderTable();
    updateSelectionUI();
  });

  selectAllCheckbox.addEventListener('change', toggleSelectAll);
  headerCheckbox.addEventListener('change', toggleSelectAll);

  exportBtn.addEventListener('click', async () => {
    if (isExporting) return;
    isExporting = true;
    exportBtn.disabled = true;

    try {
      const selectedIndicesArr =
        selectedIndices.size > 0 ? [...selectedIndices].sort((a, b) => a - b) : undefined;

      const response = await sendMessage<ExportResponse>({
        action: 'EXPORT_JSON',
        selectedIndices: selectedIndicesArr,
      });

      if (!response.ok || !response.json) {
        showToast(response.error || 'Failed to generate JSON', 'error');
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const filename = `kops-filters-v${FILTER_EXPORT_SCHEMA_VERSION}-${date}.json`;
      downloadJSON(response.json, filename);
      showToast(`Exported ${response.count ?? 0} filters`, 'success');
    } catch (err) {
      console.error(LOG_PREFIX, 'Export failed:', err);
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
      allFilters = [];
      visibleIndices = [];
      selectedIndices = new Set();
      searchInput.value = '';
      showEmpty();
      hideError();
      showToast('Filters cleared');
    } catch (err) {
      console.error(LOG_PREFIX, 'Clear failed:', err);
      showToast('Clear failed — try again', 'error');
      clearBtn.disabled = false;
    }
  });

  // ─── Debug session export ───────────────────────────────────────
  // Always enabled — the most important case to debug is "nothing captured".

  debugExportBtn.addEventListener('click', async () => {
    debugExportBtn.disabled = true;
    try {
      const response = await sendMessage<DebugResponse>({
        action: 'EXPORT_DEBUG',
        includeFilters: debugIncludeFilters.checked,
        environment: { userAgent: navigator.userAgent, language: navigator.language },
      });
      if (!response.ok || !response.json) {
        showToast(response.error || 'Debug export failed', 'error');
        return;
      }
      const filename = response.filename || `kops-debug-${new Date().toISOString().slice(0, 10)}.json`;
      downloadJSON(response.json, filename);
      let copied = false;
      try {
        await navigator.clipboard.writeText(response.json);
        copied = true;
      } catch {
        /* clipboard is best-effort — the download already succeeded */
      }
      showToast(copied ? 'Debug session saved + copied' : 'Debug session saved', 'success');
    } catch (err) {
      console.error(LOG_PREFIX, 'Debug export failed:', err);
      showToast('Debug export failed — try again', 'error');
    } finally {
      debugExportBtn.disabled = false;
    }
  });

  // ─── Refresh dropdown ───────────────────────────────────────────

  refreshBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    refreshDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!refreshDropdown.contains(e.target as Node)) refreshDropdown.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') refreshDropdown.classList.remove('open');
  });

  refreshMenu.addEventListener('click', async (e) => {
    const item = (e.target as HTMLElement).closest('.dropdown-item') as HTMLElement | null;
    if (!item) return;
    const source = item.dataset.source ?? '';
    const url = REFRESH_TARGETS[source];
    if (!url) return;
    refreshDropdown.classList.remove('open');
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (err) {
      console.error(LOG_PREFIX, 'Refresh failed:', err);
      showToast('Could not open page', 'error');
    }
  });

  // ─── Live updates ─────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.filters) void loadFilters();
  });

  // ─── Init ─────────────────────────────────────────────────────

  void loadFilters();
})();

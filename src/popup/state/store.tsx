/**
 * store.tsx — the popup's single state container (Preact context + hooks).
 *
 * Holds the captured filters, search, selection, the transient toast, and the
 * help-sheet flag; exposes async actions (export / clear / refresh / debug) that
 * talk to the service worker via lib/messaging. Subscribes to
 * chrome.storage.onChanged so a capture in another tab updates the popup live.
 *
 * Failure paths are localized here: the worker's raw `response.error` is logged
 * to the console, and the user always sees a translated message — so a French
 * user never hits an English error string.
 */
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type {
  ExportedFilter,
  FilterExportSource,
} from '../../generated/filter-export-schema.generated';
import { useMessages } from '../i18n';
import { clearFilters, exportDebug, exportJson, getFilters } from '../lib/messaging';
import { copyToClipboard, downloadJson } from '../lib/download';
import { EXPORT_SCHEMA_VERSION, LOG_PREFIX, REFRESH_TARGETS, type RefreshSource } from '../lib/constants';

export type Status = 'loading' | 'empty' | 'list';
export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface PopupState {
  status: Status;
  filters: ExportedFilter[];
  source: FilterExportSource | null;
  lastUpdate: string | null;
  /** Localized, persistent banner (parse warnings / connection failure). */
  banner: string | null;
  search: string;
  selection: Set<number>;
  toast: Toast | null;
  exporting: boolean;
  helpOpen: boolean;
}

export interface PopupActions {
  setSearch(query: string): void;
  toggleRow(index: number): void;
  setSelection(next: Set<number>): void;
  exportFilters(): Promise<void>;
  clearAll(): Promise<void>;
  refresh(source: RefreshSource, focus?: boolean): Promise<void>;
  exportDebugSession(includeFilters: boolean): Promise<void>;
  toggleHelp(open?: boolean): void;
  dismissToast(): void;
}

const INITIAL: PopupState = {
  status: 'loading',
  filters: [],
  source: null,
  lastUpdate: null,
  banner: null,
  search: '',
  selection: new Set(),
  toast: null,
  exporting: false,
  helpOpen: false,
};

interface StoreValue {
  state: PopupState;
  actions: PopupActions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ComponentChildren }) {
  const m = useMessages();
  const [state, setState] = useState<PopupState>(INITIAL);

  // Mirror state in a ref so async actions read the latest values without
  // re-creating their callbacks on every keystroke/selection change.
  const stateRef = useRef(state);
  stateRef.current = state;

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastSeq = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = (toastSeq.current += 1);
    setState((s) => ({ ...s, toast: { id, message, kind } }));
    toastTimer.current = setTimeout(() => {
      setState((s) => (s.toast?.id === id ? { ...s, toast: null } : s));
    }, 2500);
  }, []);

  const dismissToast = useCallback(() => setState((s) => ({ ...s, toast: null })), []);

  const load = useCallback(async () => {
    try {
      const res = await getFilters();
      if (res.ok === false && res.error) {
        console.warn(LOG_PREFIX, res.error);
        setState((s) => ({ ...s, status: 'empty', filters: [], selection: new Set(), banner: m.errConnect }));
        return;
      }
      const filters = Array.isArray(res.filters) ? res.filters : [];
      if (filters.length > 0) {
        const warn = res.lastErrors && res.lastErrors.length > 0 ? m.errParse(res.lastErrors.length) : null;
        setState((s) => ({
          ...s,
          status: 'list',
          filters,
          source: res.lastSource ?? null,
          lastUpdate: res.lastUpdate ?? null,
          banner: warn,
          selection: new Set(),
        }));
      } else {
        setState((s) => ({
          ...s,
          status: 'empty',
          filters: [],
          source: res.lastSource ?? null,
          lastUpdate: null,
          banner: null,
          selection: new Set(),
        }));
      }
    } catch (err) {
      console.error(LOG_PREFIX, 'load failed:', err);
      setState((s) => ({ ...s, status: 'empty', banner: m.errConnect }));
    }
  }, [m]);

  const setSearch = useCallback((query: string) => setState((s) => ({ ...s, search: query })), []);

  const toggleRow = useCallback((index: number) => {
    setState((s) => {
      const selection = new Set(s.selection);
      if (selection.has(index)) selection.delete(index);
      else selection.add(index);
      return { ...s, selection };
    });
  }, []);

  const setSelection = useCallback((next: Set<number>) => setState((s) => ({ ...s, selection: next })), []);

  const exportFilters = useCallback(async () => {
    const cur = stateRef.current;
    if (cur.exporting || cur.filters.length === 0) return;
    setState((s) => ({ ...s, exporting: true }));
    try {
      const selected =
        cur.selection.size > 0 ? [...cur.selection].sort((a, b) => a - b) : undefined;
      const res = await exportJson(selected);
      if (!res.ok || !res.json) {
        if (res.error) console.warn(LOG_PREFIX, res.error);
        showToast(m.errExport, 'error');
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const saved = downloadJson(res.json, `kops-filters-v${EXPORT_SCHEMA_VERSION}-${date}.json`);
      showToast(saved ? m.toastExported(res.count ?? 0) : m.errDownload, saved ? 'success' : 'error');
    } catch (err) {
      console.error(LOG_PREFIX, 'export failed:', err);
      showToast(m.errExport, 'error');
    } finally {
      setState((s) => ({ ...s, exporting: false }));
    }
  }, [m, showToast]);

  const clearAll = useCallback(async () => {
    try {
      const res = await clearFilters();
      if (res.ok === false && res.error) console.warn(LOG_PREFIX, res.error);
      setState((s) => ({
        ...s,
        status: 'empty',
        filters: [],
        source: null,
        lastUpdate: null,
        banner: null,
        search: '',
        selection: new Set(),
      }));
      showToast(m.toastCleared, 'info');
    } catch (err) {
      console.error(LOG_PREFIX, 'clear failed:', err);
      showToast(m.errClear, 'error');
    }
  }, [m, showToast]);

  const refresh = useCallback(
    async (source: RefreshSource, focus = false) => {
      const label = source === 'vtoolsv2' ? m.sourceVtools : m.sourceSouk;
      try {
        // In-list Refresh opens a BACKGROUND tab (focus=false) so the popup stays
        // open and live-updates when capture lands. Onboarding "Open" focuses the
        // tab (focus=true) so a first-time user actually lands on the page.
        await chrome.tabs.create({ url: REFRESH_TARGETS[source], active: focus });
        if (!focus) showToast(m.refreshOpening(label), 'info');
      } catch (err) {
        console.error(LOG_PREFIX, 'refresh failed:', err);
        showToast(m.errOpenPage, 'error');
      }
    },
    [m, showToast],
  );

  const exportDebugSession = useCallback(
    async (includeFilters: boolean) => {
      try {
        const res = await exportDebug(includeFilters, {
          userAgent: navigator.userAgent,
          language: navigator.language,
        });
        if (!res.ok || !res.json) {
          if (res.error) console.warn(LOG_PREFIX, res.error);
          showToast(m.errDebug, 'error');
          return;
        }
        const filename = res.filename || `kops-debug-${new Date().toISOString().slice(0, 10)}.json`;
        if (!downloadJson(res.json, filename)) {
          showToast(m.errDownload, 'error');
          return;
        }
        const copied = await copyToClipboard(res.json);
        showToast(copied ? m.toastDebugSavedCopied : m.toastDebugSaved, 'success');
      } catch (err) {
        console.error(LOG_PREFIX, 'debug export failed:', err);
        showToast(m.errDebug, 'error');
      }
    },
    [m, showToast],
  );

  const toggleHelp = useCallback(
    (open?: boolean) => setState((s) => ({ ...s, helpOpen: open ?? !s.helpOpen })),
    [],
  );

  // Initial load + live updates when another tab captures filters.
  useEffect(() => {
    void load();
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === 'local' && changes.filters) void load();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load]);

  const actions = useMemo<PopupActions>(
    () => ({
      setSearch,
      toggleRow,
      setSelection,
      exportFilters,
      clearAll,
      refresh,
      exportDebugSession,
      toggleHelp,
      dismissToast,
    }),
    [
      setSearch,
      toggleRow,
      setSelection,
      exportFilters,
      clearAll,
      refresh,
      exportDebugSession,
      toggleHelp,
      dismissToast,
    ],
  );

  return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}

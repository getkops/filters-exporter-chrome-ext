import { useMemo } from 'preact/hooks';
import { useStore } from './state/store';
import { computeVisibleIndices } from './state/selectors';
import {
  ActionBar,
  EmptyState,
  ErrorBanner,
  FilterTable,
  Header,
  HelpSheet,
  LoadingState,
  Toasts,
  Toolbar,
} from './components';

/**
 * App — the state router. Header + (optional) banner are always present; the
 * work area shows loading / onboarding / the filter list; the action bar and
 * help sheet layer on top. Visible indices are memoized once and shared by the
 * toolbar and table.
 */
export function App() {
  const { state } = useStore();
  const visible = useMemo(
    () => computeVisibleIndices(state.filters, state.search),
    [state.filters, state.search],
  );

  return (
    <div class="app">
      <Header />
      {state.banner && <ErrorBanner message={state.banner} />}
      <main class="work">
        {state.status === 'loading' && <LoadingState />}
        {state.status === 'empty' && <EmptyState />}
        {state.status === 'list' && (
          <>
            <Toolbar visible={visible} />
            <FilterTable visible={visible} />
          </>
        )}
      </main>
      {state.status === 'list' && <ActionBar />}
      {state.helpOpen && <HelpSheet />}
      <Toasts />
    </div>
  );
}

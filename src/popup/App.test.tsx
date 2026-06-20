// @vitest-environment happy-dom
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { I18nProvider, type Locale } from './i18n';
import { StoreProvider } from './state/store';
import { App } from './App';
import { makeFilter } from './test-fixtures';

const send = () => chrome.runtime.sendMessage as unknown as Mock;
const tabsCreate = () => chrome.tabs.create as unknown as Mock;
const addStorageListener = () => chrome.storage.onChanged.addListener as unknown as Mock;

/** Respond to GET_FILTERS with `resp`; everything else resolves ok. */
function mockFilters(resp: Record<string, unknown>) {
  send().mockImplementation((msg: { action: string }, cb: (r: unknown) => void) => {
    cb(msg.action === 'GET_FILTERS' ? resp : { ok: true });
  });
}

function renderApp(locale: Locale = 'en') {
  return render(
    <I18nProvider locale={locale}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  send().mockReset();
  tabsCreate().mockReset();
  tabsCreate().mockResolvedValue({});
  addStorageListener().mockReset();
  chrome.runtime.lastError = undefined;
});

describe('onboarding (empty state)', () => {
  it('shows the 3-step how-it-works and Open buttons in English', async () => {
    mockFilters({ ok: true, filters: [] });
    renderApp('en');
    expect(await screen.findByText('No filters captured yet')).toBeInTheDocument();
    expect(screen.getByText('Your filters are captured automatically')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open V-Tools/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Souk\.to/ })).toBeInTheDocument();
  });

  it('renders the onboarding in French', async () => {
    mockFilters({ ok: true, filters: [] });
    renderApp('fr');
    expect(await screen.findByText('Aucun filtre capturé')).toBeInTheDocument();
    expect(screen.getByText('Vos filtres sont capturés automatiquement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ouvrir V-Tools/ })).toBeInTheDocument();
  });
});

describe('filter list', () => {
  it('renders rows, the source/count chip and status badges', async () => {
    mockFilters({
      ok: true,
      lastSource: 'vtools',
      lastUpdate: '2026-06-20T14:32:00.000Z',
      filters: [
        makeFilter({ name: 'Nike Air', brand_names: ['Nike'], price_min: 10, price_max: 50, enabled: true }),
        makeFilter({ name: 'Adidas', enabled: false }),
      ],
    });
    renderApp('en');
    expect(await screen.findByText('Nike Air')).toBeInTheDocument();
    expect(screen.getByText('Adidas')).toBeInTheDocument();
    expect(screen.getByText('V-Tools')).toBeInTheDocument();
    expect(screen.getByText('2 captured')).toBeInTheDocument();
    expect(screen.getByText('€10–50')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('filters rows by search and shows a no-results message', async () => {
    mockFilters({
      ok: true,
      lastSource: 'souk',
      filters: [makeFilter({ name: 'Nike' }), makeFilter({ name: 'Adidas' })],
    });
    renderApp('en');
    const input = await screen.findByPlaceholderText(/Search filters/);
    fireEvent.input(input, { target: { value: 'nike' } });
    expect(screen.getByText('Nike')).toBeInTheDocument();
    expect(screen.queryByText('Adidas')).not.toBeInTheDocument();
    fireEvent.input(input, { target: { value: 'zzz' } });
    expect(screen.getByText('No filters match your search')).toBeInTheDocument();
  });

  it('surfaces parse warnings as a localized banner', async () => {
    mockFilters({ ok: true, lastSource: 'souk', filters: [makeFilter({ name: 'X' })], lastErrors: ['boom'] });
    renderApp('en');
    expect(await screen.findByText('1 warning during capture')).toBeInTheDocument();
  });
});

describe('export', () => {
  it('select-all updates the label and EXPORT_JSON carries the indices', async () => {
    mockFilters({
      ok: true,
      lastSource: 'vtools',
      filters: [makeFilter({ name: 'A' }), makeFilter({ name: 'B' })],
    });
    renderApp('en');
    await screen.findByText('A');

    expect(screen.getByRole('button', { name: 'Export 2' })).toBeInTheDocument();

    // The first checkbox is the toolbar select-all.
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const exportBtn = await screen.findByRole('button', { name: 'Export 2 selected' });

    fireEvent.click(exportBtn);
    await waitFor(() => {
      expect(send()).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXPORT_JSON', selectedIndices: [0, 1] }),
        expect.any(Function),
      );
    });
  });
});

describe('refresh', () => {
  it('onboarding "Open" focuses the new tab (active:true) so first-timers land on the page', async () => {
    mockFilters({ ok: true, filters: [] });
    renderApp('en');
    fireEvent.click(await screen.findByRole('button', { name: /Open V-Tools/ }));
    await waitFor(() => {
      expect(tabsCreate()).toHaveBeenCalledWith({
        url: 'https://dashboard.v-tools.com/dashboard/filters',
        active: true,
      });
    });
  });

  it('in-list Refresh opens a background tab (active:false), keeping the popup open', async () => {
    mockFilters({ ok: true, lastSource: 'vtools', filters: [makeFilter({ name: 'A' })] });
    renderApp('en');
    await screen.findByText('A');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(await screen.findByText('Refresh V-Tools'));
    await waitFor(() => {
      expect(tabsCreate()).toHaveBeenCalledWith({
        url: 'https://dashboard.v-tools.com/dashboard/filters',
        active: false,
      });
    });
  });
});

describe('live updates', () => {
  it('re-loads when storage.filters changes in another tab', async () => {
    type StorageListener = (c: Record<string, unknown>, area: string) => void;
    const captured: { fn: StorageListener | null } = { fn: null };
    addStorageListener().mockImplementation((fn: StorageListener) => {
      captured.fn = fn;
    });
    mockFilters({ ok: true, filters: [] });
    renderApp('en');
    await screen.findByText('No filters captured yet');

    // A capture lands in another tab → storage fires → popup re-loads to a list.
    mockFilters({ ok: true, lastSource: 'souk', filters: [makeFilter({ name: 'Fresh' })] });
    captured.fn?.({ filters: { newValue: [] } }, 'local');
    expect(await screen.findByText('Fresh')).toBeInTheDocument();
  });
});

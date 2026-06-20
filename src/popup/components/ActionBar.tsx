import { useState } from 'preact/hooks';
import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import { formatTime } from '../lib/format';
import { Icon } from './Icon';
import { Menu, MenuItem } from './Menu';

/** ↻ — opens the source page (in a background tab) to re-capture. */
function RefreshMenu() {
  const m = useMessages();
  const { actions } = useStore();
  return (
    <Menu icon="refresh" label={m.refresh}>
      {(close) => (
        <>
          <MenuItem
            icon="external"
            label={m.refreshVtools}
            onClick={() => {
              close();
              void actions.refresh('vtoolsv2');
            }}
          />
          <MenuItem
            icon="external"
            label={m.refreshSouk}
            onClick={() => {
              close();
              void actions.refresh('souk');
            }}
          />
        </>
      )}
    </Menu>
  );
}

/** ⋯ — secondary actions: clear, and the debug-session export (+ its opt-in). */
function OverflowMenu() {
  const m = useMessages();
  const { state, actions } = useStore();
  const [includeFilters, setIncludeFilters] = useState(false);
  const time = formatTime(state.lastUpdate);
  return (
    <Menu icon="more" label={m.more}>
      {(close) => (
        <>
          <MenuItem
            icon="clear"
            label={m.clear}
            danger
            disabled={state.filters.length === 0}
            onClick={() => {
              close();
              void actions.clearAll();
            }}
          />
          <div class="menu-sep" />
          <label class="menu-check" title={m.debugIncludeHint}>
            <input
              type="checkbox"
              checked={includeFilters}
              onChange={(e) => setIncludeFilters(e.currentTarget.checked)}
            />
            <span>{m.debugInclude}</span>
          </label>
          <MenuItem
            icon="debug"
            label={m.debugExport}
            onClick={() => {
              close();
              void actions.exportDebugSession(includeFilters);
            }}
          />
          {time && <div class="menu-foot">{m.lastCapture(time)}</div>}
        </>
      )}
    </Menu>
  );
}

export function ActionBar() {
  const m = useMessages();
  const { state, actions } = useStore();
  const selCount = state.selection.size;
  const label = selCount > 0 ? m.exportSelectedN(selCount) : m.exportN(state.filters.length);
  return (
    <div class="action-bar">
      <button
        type="button"
        class="btn btn-primary export-btn"
        disabled={state.exporting || state.filters.length === 0}
        onClick={() => void actions.exportFilters()}
      >
        <Icon name="export" size={16} />
        <span>{label}</span>
      </button>
      <RefreshMenu />
      <OverflowMenu />
    </div>
  );
}

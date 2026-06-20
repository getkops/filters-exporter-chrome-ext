import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import { selectionSummary, toggleAllVisible } from '../state/selectors';
import { Icon } from './Icon';

/** Merged toolbar: search on the left, select-all + live count on the right. */
export function Toolbar({ visible }: { visible: number[] }) {
  const m = useMessages();
  const { state, actions } = useStore();
  const { allVisibleSelected, indeterminate } = selectionSummary(visible, state.selection);
  const selCount = state.selection.size;
  const label =
    selCount > 0 ? m.selectedOf(selCount, state.filters.length) : m.filtersShown(visible.length);

  return (
    <div class="toolbar">
      <div class="search">
        <Icon name="search" size={15} class="search-icon" />
        <input
          type="text"
          class="search-input"
          value={state.search}
          placeholder={m.searchPlaceholder}
          autocomplete="off"
          spellcheck={false}
          onInput={(e) => actions.setSearch(e.currentTarget.value)}
        />
      </div>
      <label class="select-all" title={m.selectAll}>
        <input
          type="checkbox"
          checked={allVisibleSelected}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate;
          }}
          onChange={() => actions.setSelection(toggleAllVisible(visible, state.selection))}
        />
        <span class="count-label">{label}</span>
      </label>
    </div>
  );
}

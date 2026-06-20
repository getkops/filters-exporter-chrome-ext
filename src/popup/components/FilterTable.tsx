import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import { FilterRow } from './FilterRow';

export function FilterTable({ visible }: { visible: number[] }) {
  const m = useMessages();
  const { state, actions } = useStore();
  const searching = state.search.trim().length > 0;

  if (visible.length === 0 && searching) {
    return <div class="table-empty">{m.noResults}</div>;
  }

  const hasSelection = state.selection.size > 0;
  return (
    <div class="table-scroll">
      <table class="filter-table">
        <thead>
          <tr>
            <th class="cell-check" aria-hidden="true" />
            <th class="cell-name">{m.colName}</th>
            <th class="cell-brands">{m.colBrands}</th>
            <th class="cell-price">{m.colPrice}</th>
            <th class="cell-status">{m.colStatus}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((i) => (
            <FilterRow
              key={i}
              filter={state.filters[i]}
              index={i}
              selected={state.selection.has(i)}
              dim={hasSelection && !state.selection.has(i)}
              onToggle={actions.toggleRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

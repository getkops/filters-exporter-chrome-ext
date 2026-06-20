import { useMessages } from '../i18n';
import type { ExportedFilter } from '../../generated/filter-export-schema.generated';
import { brandsText, priceText } from '../lib/format';

export function FilterRow({
  filter,
  index,
  selected,
  dim,
  onToggle,
}: {
  filter: ExportedFilter;
  index: number;
  selected: boolean;
  dim: boolean;
  onToggle: (index: number) => void;
}) {
  const m = useMessages();
  const active = filter.enabled === true;
  const brands = brandsText(filter);
  return (
    <tr class={`row${dim ? ' dim' : ''}${selected ? ' selected' : ''}`}>
      <td class="cell-check">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(index)}
          aria-label={filter.name || m.unnamed}
        />
      </td>
      <td class="cell-name">
        <span class="filter-name" title={filter.name || undefined}>
          {filter.name || m.unnamed}
        </span>
      </td>
      <td class="cell-brands">
        <span class="filter-brands" title={brands !== '—' ? brands : undefined}>
          {brands}
        </span>
      </td>
      <td class="cell-price">
        <span class="filter-price">{priceText(filter)}</span>
      </td>
      <td class="cell-status">
        <span class={`badge ${active ? 'badge-active' : 'badge-off'}`}>
          {active ? m.statusActive : m.statusOff}
        </span>
      </td>
    </tr>
  );
}

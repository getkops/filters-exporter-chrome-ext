/**
 * selectors.ts — pure derivations over (filters, search, selection). Kept out of
 * components so the search + select-all + indeterminate logic is unit-testable
 * and matches the original popup exactly.
 */
import type { ExportedFilter } from '../../generated/filter-export-schema.generated';
import { keywordText } from '../lib/format';

/** Case-insensitive substring match over name + brands + keywords. */
export function matchesSearch(filter: ExportedFilter, query: string): boolean {
  if (!query) return true;
  const haystack = [filter.name, ...filter.brand_names, keywordText(filter)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** Indices of filters matching the (raw) search string, in original order. */
export function computeVisibleIndices(filters: ExportedFilter[], search: string): number[] {
  const query = search.trim().toLowerCase();
  const out: number[] = [];
  filters.forEach((filter, i) => {
    if (matchesSearch(filter, query)) out.push(i);
  });
  return out;
}

export interface SelectionSummary {
  /** number of currently-visible rows that are selected */
  visibleSelected: number;
  /** all visible rows selected (and there is at least one) */
  allVisibleSelected: boolean;
  /** some-but-not-all visible rows selected (header checkbox = indeterminate) */
  indeterminate: boolean;
}

export function selectionSummary(
  visibleIndices: number[],
  selection: Set<number>,
): SelectionSummary {
  const visibleSelected = visibleIndices.filter((i) => selection.has(i)).length;
  const allVisibleSelected = visibleIndices.length > 0 && visibleSelected === visibleIndices.length;
  const indeterminate = visibleSelected > 0 && visibleSelected < visibleIndices.length;
  return { visibleSelected, allVisibleSelected, indeterminate };
}

/** Toggle every visible row: if all are selected, clear them; else select all. */
export function toggleAllVisible(visibleIndices: number[], selection: Set<number>): Set<number> {
  const next = new Set(selection);
  const allSelected = visibleIndices.every((i) => next.has(i)) && visibleIndices.length > 0;
  if (allSelected) visibleIndices.forEach((i) => next.delete(i));
  else visibleIndices.forEach((i) => next.add(i));
  return next;
}

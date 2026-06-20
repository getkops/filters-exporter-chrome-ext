/**
 * format.ts — pure display helpers for the `ExportedFilter` shape. Ported from
 * the original popup.ts so the rendered values stay byte-for-byte identical.
 */
import type { ExportedFilter } from '../../generated/filter-export-schema.generated';

/** Comma-joined brand names, or an em dash when none. */
export function brandsText(filter: ExportedFilter): string {
  return filter.brand_names.length > 0 ? filter.brand_names.join(', ') : '—';
}

/** `€{min}–{max}`, defaulting min→0 and max→∞ when unbounded. */
export function priceText(filter: ExportedFilter): string {
  const from = filter.price_min != null ? String(filter.price_min) : '0';
  const to = filter.price_max != null ? String(filter.price_max) : '∞';
  return `€${from}–${to}`;
}

/** All keyword-group words plus blacklist phrases, space-joined (search fodder). */
export function keywordText(filter: ExportedFilter): string {
  const parts: string[] = [];
  if (filter.keyword_rules) {
    for (const group of filter.keyword_rules.groups) parts.push(...group.keywords);
  }
  parts.push(...filter.blacklist_keywords);
  return parts.join(' ');
}

/** Localized wall-clock time of an ISO timestamp, or '' when absent/invalid. */
export function formatTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import { formatTime } from '../lib/format';

/**
 * The live source + count chip that replaces the old status bar. Shows
 * "Waiting…" until filters load, then "● {source} · {n} captured" with the
 * last-capture time as a hover tooltip.
 */
export function StatusChip() {
  const m = useMessages();
  const { state } = useStore();

  if (state.status !== 'list') {
    return (
      <div class="status-chip status-muted">
        <span class="status-dot" />
        <span class="status-text">{m.statusWaiting}</span>
      </div>
    );
  }

  const label =
    state.source === 'vtools'
      ? m.sourceVtools
      : state.source === 'souk'
        ? m.sourceSouk
        : m.sourceGeneric;
  const time = formatTime(state.lastUpdate);

  return (
    <div class="status-chip status-live" title={time ? m.lastCapture(time) : undefined}>
      <span class="status-dot" />
      <span class="status-source">{label}</span>
      <span class="status-sep" aria-hidden="true">·</span>
      <span class="status-count">{m.captured(state.filters.length)}</span>
    </div>
  );
}

import { useMessages } from '../i18n';

export function LoadingState() {
  const m = useMessages();
  return (
    <div class="loading">
      <span class="spinner" aria-hidden="true" />
      <span class="loading-text">{m.loading}</span>
    </div>
  );
}

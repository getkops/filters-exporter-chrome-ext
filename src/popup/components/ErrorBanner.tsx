import { Icon } from './Icon';

/** Persistent, already-localized banner for parse warnings / connection issues. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div class="error-banner" role="alert">
      <Icon name="info" size={14} />
      <span>{message}</span>
    </div>
  );
}

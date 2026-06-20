import { useStore } from '../state/store';
import { Icon } from './Icon';

/**
 * Single transient toast, anchored just above the action bar (clear of the
 * header text and the buttons). Opaque surface + a per-kind icon. Click to
 * dismiss early; auto-dismisses via the store timer.
 */
export function Toasts() {
  const { state, actions } = useStore();
  const toast = state.toast;
  if (!toast) return null;
  const icon = toast.kind === 'success' ? 'check' : 'info';
  return (
    <div class="toast-host">
      <div
        key={toast.id}
        class={`toast toast-${toast.kind}`}
        role="status"
        onClick={() => actions.dismissToast()}
      >
        <Icon name={icon} size={15} class="toast-icon" />
        <span class="toast-msg">{toast.message}</span>
      </div>
    </div>
  );
}

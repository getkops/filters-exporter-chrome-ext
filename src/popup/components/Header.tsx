import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { StatusChip } from './StatusChip';

export function Header() {
  const m = useMessages();
  const { state, actions } = useStore();
  return (
    <header class="header">
      <div class="brand">
        <span class="brand-icon">
          <Icon name="filter" size={17} />
        </span>
        <div class="brand-text">
          <h1 class="brand-name">Kops Filter Exporter</h1>
          <StatusChip />
        </div>
      </div>
      <button
        type="button"
        class={`icon-btn help-btn${state.helpOpen ? ' is-open' : ''}`}
        aria-label={m.howItWorks}
        title={m.howItWorks}
        aria-pressed={state.helpOpen}
        onClick={() => actions.toggleHelp()}
      >
        <Icon name="help" size={17} />
      </button>
    </header>
  );
}

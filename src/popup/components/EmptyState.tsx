import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import { Icon } from './Icon';

/** First-run onboarding: the 3-step "how it works" + one-click Open buttons. */
export function EmptyState() {
  const m = useMessages();
  const { actions } = useStore();
  return (
    <div class="empty">
      <div class="empty-icon">
        <Icon name="filter" size={26} />
      </div>
      <h2 class="empty-title">{m.emptyTitle}</h2>
      <ol class="steps">
        <li>
          <span class="step-n">1</span>
          <span class="step-text">{m.step1}</span>
        </li>
        <li>
          <span class="step-n">2</span>
          <span class="step-text">{m.step2}</span>
        </li>
        <li>
          <span class="step-n">3</span>
          <span class="step-text">{m.step3}</span>
        </li>
      </ol>
      <div class="empty-actions">
        <button type="button" class="btn btn-secondary" onClick={() => void actions.refresh('vtoolsv2', true)}>
          <Icon name="external" size={15} />
          <span>{m.openVtools}</span>
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => void actions.refresh('souk', true)}>
          <Icon name="external" size={15} />
          <span>{m.openSouk}</span>
        </button>
      </div>
      <button type="button" class="link-btn" onClick={() => void actions.exportDebugSession(false)}>
        {m.debugExport}
      </button>
    </div>
  );
}

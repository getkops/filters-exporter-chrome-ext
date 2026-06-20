import { useMessages } from '../i18n';
import { useStore } from '../state/store';
import type { RefreshSource } from '../lib/constants';
import { Icon } from './Icon';

/** Persistent "How it works" — reachable via the header ? even with filters loaded. */
export function HelpSheet() {
  const m = useMessages();
  const { actions } = useStore();
  const open = (source: RefreshSource) => {
    actions.toggleHelp(false);
    void actions.refresh(source, true);
  };
  return (
    <div class="sheet-backdrop" onClick={() => actions.toggleHelp(false)}>
      <div class="sheet" role="dialog" aria-label={m.howItWorks} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{m.howItWorks}</h2>
          <button type="button" class="icon-btn" aria-label={m.close} onClick={() => actions.toggleHelp(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <p class="sheet-tagline">{m.tagline}</p>
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
        <div class="sheet-actions">
          <button type="button" class="btn btn-secondary" onClick={() => open('vtoolsv2')}>
            <Icon name="external" size={15} />
            <span>{m.openVtools}</span>
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => open('souk')}>
            <Icon name="external" size={15} />
            <span>{m.openSouk}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * main.tsx — Popup entry. Wraps <App/> in the i18n + store providers and mounts
 * it into #root. Styles are linked by popup.html (bundled separately to
 * popup.css), not imported here, so CSS never enters the JS bundle.
 */
import { render } from 'preact';
import { I18nProvider } from './i18n';
import { StoreProvider } from './state/store';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  render(
    <I18nProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </I18nProvider>,
    root,
  );
}

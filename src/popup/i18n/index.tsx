/**
 * i18n/index.tsx — locale detection + the Preact provider/hook.
 *
 * Auto-detect only (no in-app toggle): the locale is resolved once from the
 * browser language and provided to the tree. Components read the typed catalog
 * via `useMessages()` — e.g. `const m = useMessages(); m.exportN(42)`.
 */
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { en } from './en';
import { fr } from './fr';
import type { Locale, Messages } from './types';

const catalogs: Record<Locale, Messages> = { en, fr };

/** Resolve a BCP-47 language tag to a supported locale (French → fr, else en). */
export function detectLocale(lang?: string): Locale {
  const tag = lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en';
  return tag.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

const MessagesContext = createContext<Messages>(en);

/** Provides the active catalog. `locale` is injectable so tests can render in fr. */
export function I18nProvider({
  locale,
  children,
}: {
  locale?: Locale;
  children: ComponentChildren;
}) {
  const resolved = locale ?? detectLocale();
  return <MessagesContext.Provider value={catalogs[resolved]}>{children}</MessagesContext.Provider>;
}

export function useMessages(): Messages {
  return useContext(MessagesContext);
}

export type { Locale, Messages } from './types';

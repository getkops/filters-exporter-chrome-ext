/**
 * Popup-local constants.
 *
 * The export filename embeds the envelope schema version. We mirror it here
 * rather than importing FILTER_EXPORT_SCHEMA_VERSION from the generated schema,
 * because that module's zod schema initializers would pull ~130 KB of zod into
 * the popup bundle (the validation itself runs in the service worker). A unit
 * test (constants.test.ts) asserts this stays equal to the generated SSOT.
 */
export const EXPORT_SCHEMA_VERSION = 1;

/** Where "Refresh" / onboarding "Open …" buttons send the user to capture. */
export type RefreshSource = 'vtoolsv2' | 'souk';
export const REFRESH_TARGETS: Record<RefreshSource, string> = {
  vtoolsv2: 'https://dashboard.v-tools.com/dashboard/filters',
  souk: 'https://souk.to/app/alerts',
};

export const LOG_PREFIX = '[Kops Filter Exporter]';

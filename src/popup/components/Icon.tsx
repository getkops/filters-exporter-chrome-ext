import type { VNode } from 'preact';

/**
 * Icon.tsx — inline SVG icon set. All icons share a 24×24 viewBox and inherit
 * `currentColor`, so they theme via the parent's text color. CSP-safe (no
 * external files). Strokes are set on the <svg> and inherited; dot-style icons
 * override fill on their own circles.
 */
export type IconName =
  | 'filter'
  | 'help'
  | 'search'
  | 'export'
  | 'refresh'
  | 'more'
  | 'clear'
  | 'debug'
  | 'info'
  | 'close'
  | 'external'
  | 'check';

const PATHS: Record<IconName, VNode> = {
  filter: <path d="M3 4h18l-7 8.5V18l-4 2v-7.5L3 4z" />,
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.2-3 4" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  export: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  refresh: (
    <>
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  clear: (
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  ),
  debug: (
    <path d="M9 4.5L7.5 2M15 4.5L16.5 2M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM12 8v12M5 12H3m18 0h-2M5.5 8L4 6.5m14.5 1.5L20 6.5M5.5 17L4 18.5m14.5-1.5L20 18.5" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
  external: <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />,
  check: <path d="M20 6L9 17l-5-5" />,
};

export function Icon({ name, size = 16, class: cls }: { name: IconName; size?: number; class?: string }) {
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

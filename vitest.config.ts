import { defineConfig } from 'vitest/config';

// Pure-logic suites (paginate, normalize, diagnostics, format, i18n, …) keep the
// default `node` environment for speed. Component suites that render Preact opt
// into the DOM with a `// @vitest-environment happy-dom` pragma at the top of
// the file. The shared setup stubs a minimal `chrome` global so popup modules
// that touch chrome.* at import time don't throw.
export default defineConfig({
  // Transform JSX/TSX with Preact's automatic runtime (not React) so importing a
  // .tsx module under test pulls `preact/jsx-runtime`, never `react/jsx-runtime`.
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});

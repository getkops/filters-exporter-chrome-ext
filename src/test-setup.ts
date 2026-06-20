import { vi } from 'vitest';

// Minimal `chrome` surface so popup modules that read chrome.* at import time
// (the store's storage subscription, messaging helpers) don't throw under test.
// Individual tests override these vi.fn()s with mockResolvedValue / spies.
const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    lastError: undefined as { message: string } | undefined,
    getManifest: vi.fn(() => ({ version: '0.0.0-test' })),
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: { create: vi.fn(() => Promise.resolve({})) },
};

vi.stubGlobal('chrome', chromeMock);

// happy-dom lacks Blob object-URL helpers; stub them so downloadJson() works in
// component tests without replacing the real URL constructor (used elsewhere).
if (typeof URL !== 'undefined') {
  const u = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
  u.createObjectURL ??= () => 'blob:mock';
  u.revokeObjectURL ??= () => undefined;
}

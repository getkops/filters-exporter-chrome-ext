import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { getFilters, exportJson, clearFilters, exportDebug } from './messaging';
import { EXPORT_DEBUG_ACTION } from '../../diagnostics';

const send = () => chrome.runtime.sendMessage as unknown as Mock;

beforeEach(() => {
  send().mockReset();
  chrome.runtime.lastError = undefined;
});

describe('messaging wrappers', () => {
  it('getFilters sends GET_FILTERS and resolves the response', async () => {
    send().mockImplementation((_msg: unknown, cb: (r: unknown) => void) => cb({ ok: true, filters: [] }));
    const res = await getFilters();
    expect(send()).toHaveBeenCalledWith({ action: 'GET_FILTERS' }, expect.any(Function));
    expect(res).toEqual({ ok: true, filters: [] });
  });

  it('exportJson forwards selectedIndices verbatim', async () => {
    send().mockImplementation((_msg: unknown, cb: (r: unknown) => void) => cb({ ok: true, json: '{}', count: 2 }));
    await exportJson([3, 1]);
    expect(send()).toHaveBeenCalledWith(
      { action: 'EXPORT_JSON', selectedIndices: [3, 1] },
      expect.any(Function),
    );
  });

  it('exportDebug uses the shared diagnostics action constant + payload', async () => {
    send().mockImplementation((_msg: unknown, cb: (r: unknown) => void) => cb({ ok: true, json: '{}' }));
    await exportDebug(true, { userAgent: 'UA', language: 'fr' });
    expect(send()).toHaveBeenCalledWith(
      {
        action: EXPORT_DEBUG_ACTION,
        includeFilters: true,
        environment: { userAgent: 'UA', language: 'fr' },
      },
      expect.any(Function),
    );
  });

  it('rejects when chrome.runtime.lastError is set', async () => {
    send().mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      chrome.runtime.lastError = { message: 'boom' };
      cb(undefined);
    });
    await expect(clearFilters()).rejects.toThrow('boom');
  });
});

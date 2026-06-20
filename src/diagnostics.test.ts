import { describe, it, expect } from 'vitest';
import {
  redactSecrets,
  redactKey,
  sanitizeUrl,
  urlParamKeys,
  shapeOf,
  pushEvent,
  toEvent,
  assembleDebugBundle,
  DIAG_BUFFER_CAP,
  type DiagEvent,
} from './diagnostics';

// ─────────────────────────────────────────────────────────────────────────────
// The diagnostics core is the security boundary of the debug export: every byte
// that reaches a support bundle passes through these functions. The suite is
// therefore adversarial about leakage — it asserts that tokens, search terms,
// and PII-shaped keys never survive.
// ─────────────────────────────────────────────────────────────────────────────

describe('redactSecrets', () => {
  it('strips bearer tokens, key=value secrets, JWTs and long hex', () => {
    expect(redactSecrets('Authorization: Bearer abc123.def456')).not.toContain('abc123');
    expect(redactSecrets('token=supersecretvalue')).toBe('[redacted]');
    expect(redactSecrets('cookie=sessionXYZ; other=1')).toContain('[redacted]');
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4';
    expect(redactSecrets(jwt)).toBe('[redacted]');
    expect(redactSecrets('hash a1b2c3d4e5f60718293a4b5c6d7e8f90 end')).toContain('[redacted]');
  });

  it('leaves ordinary text untouched and is idempotent', () => {
    const text = 'pagination aborted at page 3';
    expect(redactSecrets(text)).toBe(text);
    expect(redactSecrets(redactSecrets('token=abcdef'))).toBe('[redacted]');
  });
});

describe('redactKey', () => {
  it('scrubs PII-shaped keys but keeps structural ones', () => {
    expect(redactKey('alerts')).toBe('alerts');
    expect(redactKey('filter_id')).toBe('filter_id');
    expect(redactKey('john.doe@example.com')).toBe('[email]');
    expect(redactKey('550e8400-e29b-41d4-a716-446655440000')).toBe('[uuid]');
    expect(redactKey('33612345678')).toBe('[num]');
  });

  it('caps very long keys', () => {
    expect(redactKey('x'.repeat(200)).endsWith('…')).toBe(true);
    expect(redactKey('x'.repeat(200)).length).toBeLessThanOrEqual(65);
  });
});

describe('sanitizeUrl', () => {
  it('reduces to origin+path, dropping the query (search terms) and hash', () => {
    expect(sanitizeUrl('https://api.souk.to/api/v1/matching_alert/web?page=2&search=nike&token=zzz')).toBe(
      'https://api.souk.to/api/v1/matching_alert/web',
    );
    expect(sanitizeUrl('https://www.v-tools.com/api/vinted/filters/list?limit=20&created_at[lt]=5#x')).toBe(
      'https://www.v-tools.com/api/vinted/filters/list',
    );
  });

  it('never lets a search term survive', () => {
    expect(sanitizeUrl('https://api.souk.to/x?search=mysecretbrand')).not.toContain('mysecretbrand');
  });

  it('handles unparseable / relative URLs without throwing', () => {
    expect(sanitizeUrl('/relative/path?q=1')).toBe('/relative/path');
    expect(sanitizeUrl('')).toBe('');
  });
});

describe('urlParamKeys', () => {
  it('returns param names only — never values', () => {
    const keys = urlParamKeys(
      'https://www.v-tools.com/api/vinted/filters/list?limit=0&order=created_at&search=nike',
    );
    expect(keys).toBe('limit,order,search');
    expect(keys).not.toContain('nike');
  });

  it('is empty when there is no query', () => {
    expect(urlParamKeys('https://x.com/path')).toBe('');
    expect(urlParamKeys('')).toBe('');
  });
});

describe('shapeOf', () => {
  it('emits keys and types but NEVER values', () => {
    const body = {
      type: 'success',
      body: { alerts: [{ id: 'x1', name: 'nike sneakers', search: 'nike' }], total: 5 },
    };
    const shape = shapeOf(body);
    const json = JSON.stringify(shape);
    expect(json).not.toContain('nike');
    expect(json).not.toContain('success');
    expect(json).not.toContain('x1');
    // structure is preserved
    expect(shape).toMatchObject({ type: 'string', body: { total: 'number' } });
    expect((shape as Record<string, unknown>).body).toHaveProperty('alerts');
  });

  it('represents arrays by a single element shape and marks empties', () => {
    expect(shapeOf([])).toEqual(['empty']);
    expect(shapeOf([{ a: 1 }, { a: 2 }])).toEqual([{ a: 'number' }]);
  });

  it('redacts PII-shaped object keys', () => {
    const shape = shapeOf({ 'user@mail.com': { active: true } }) as Record<string, unknown>;
    expect(Object.keys(shape)).toEqual(['[email]']);
  });

  it('caps depth so deeply nested input cannot blow up the bundle', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(() => JSON.stringify(shapeOf(deep))).not.toThrow();
  });
});

describe('pushEvent ring buffer', () => {
  const ev = (i: number): DiagEvent => ({ ts: `t${i}`, ctx: 'background', level: 'info', stage: 'note' });

  it('keeps only the most recent `cap` events', () => {
    let buf: DiagEvent[] = [];
    for (let i = 0; i < DIAG_BUFFER_CAP + 50; i++) buf = pushEvent(buf, ev(i));
    expect(buf).toHaveLength(DIAG_BUFFER_CAP);
    expect(buf[0].ts).toBe(`t${50}`); // oldest 50 evicted
    expect(buf[buf.length - 1].ts).toBe(`t${DIAG_BUFFER_CAP + 49}`);
  });

  it('does not mutate the input array', () => {
    const original: DiagEvent[] = [ev(0)];
    const next = pushEvent(original, ev(1));
    expect(original).toHaveLength(1);
    expect(next).toHaveLength(2);
  });
});

describe('toEvent', () => {
  it('stamps ts, defaults ctx/level by stage, and redacts free text', () => {
    const e = toEvent({ stage: 'http_error', message: 'HTTP 401 token=leaked' }, 'inject', 'T');
    expect(e.ts).toBe('T');
    expect(e.ctx).toBe('inject');
    expect(e.level).toBe('error'); // derived from stage
    expect(e.message).toContain('[redacted]');
    expect(e.message).not.toContain('leaked');
  });

  it('redacts detail keys and string values, preserving non-strings', () => {
    const e = toEvent(
      { stage: 'note', detail: { 'token=abc': 'Bearer xyz', httpStatus: 500, flag: true } },
      'background',
      'T',
    );
    const detail = e.detail!;
    expect(Object.keys(detail).some((k) => k.includes('[redacted]'))).toBe(true);
    expect(Object.values(detail)).toContain(500);
    expect(Object.values(detail)).toContain(true);
    expect(JSON.stringify(detail)).not.toContain('xyz');
  });

  it('respects an explicitly provided level/ctx', () => {
    const e = toEvent({ stage: 'note', level: 'warn', ctx: 'popup' }, 'background', 'T');
    expect(e.level).toBe('warn');
    expect(e.ctx).toBe('popup');
  });
});

describe('assembleDebugBundle', () => {
  const baseInput = () => ({
    exportId: 'exp-1',
    generatedAt: '2026-06-20T10:00:00.000Z',
    extensionVersion: '2.0.0',
    environment: { userAgent: 'UA', language: 'fr' },
    storage: { filterCount: 12, lastSource: 'souk', lastUpdate: 'T-cap', lastErrors: null },
    events: [
      toEvent({ stage: 'intercept', source: 'souk' }, 'inject', 'T1'),
      toEvent({ stage: 'http_error', httpStatus: 401 }, 'inject', 'T2'),
      toEvent({ stage: 'intercept', source: 'souk' }, 'inject', 'T3'),
    ] as DiagEvent[],
  });

  it('derives an authoritative summary from events + storage', () => {
    const b = assembleDebugBundle(baseInput());
    expect(b.summary.eventCount).toBe(3);
    expect(b.summary.interceptCount).toBe(2);
    expect(b.summary.errorCount).toBe(1);
    expect(b.summary.lastInterceptAt).toBe('T3');
    expect(b.summary.lastCaptureAt).toBe('T-cap');
    expect(b.summary.storedFilterCount).toBe(12);
    expect(b.notes.length).toBeGreaterThan(0);
  });

  it('makes an empty event log legible (zero, not missing)', () => {
    const input = { ...baseInput(), events: [] };
    const b = assembleDebugBundle(input);
    expect(b.summary.eventCount).toBe(0);
    expect(b.summary.interceptCount).toBe(0);
    expect(b.summary.lastInterceptAt).toBeNull();
    // storage backbone still present
    expect(b.summary.storedFilterCount).toBe(12);
  });

  it('includes filters only when explicitly provided, and redacts stored errors', () => {
    const withErrors = {
      ...baseInput(),
      storage: { filterCount: 0, lastSource: null, lastUpdate: null, lastErrors: ['failed token=abc'] },
    };
    expect(assembleDebugBundle(withErrors).filters).toBeUndefined();
    expect(assembleDebugBundle(withErrors).storage.lastErrors?.[0]).toContain('[redacted]');

    const withFilters = { ...baseInput(), filters: [{ name: 'f' }] };
    expect(assembleDebugBundle(withFilters).filters).toEqual([{ name: 'f' }]);
  });
});

import { describe, it, expect } from 'vitest';
import { makeFilter } from '../test-fixtures';
import { brandsText, priceText, keywordText, formatTime } from './format';

describe('brandsText', () => {
  it('joins brand names or shows an em dash', () => {
    expect(brandsText(makeFilter({ brand_names: ['Nike', 'Adidas'] }))).toBe('Nike, Adidas');
    expect(brandsText(makeFilter({ brand_names: [] }))).toBe('—');
  });
});

describe('priceText', () => {
  it('formats bounded and unbounded ranges', () => {
    expect(priceText(makeFilter({ price_min: 10, price_max: 50 }))).toBe('€10–50');
    expect(priceText(makeFilter({ price_min: 5 }))).toBe('€5–∞');
    expect(priceText(makeFilter({ price_max: 80 }))).toBe('€0–80');
    expect(priceText(makeFilter({}))).toBe('€0–∞');
  });
});

describe('keywordText', () => {
  it('flattens keyword groups + blacklist, space-joined', () => {
    const f = makeFilter({
      keyword_rules: { groups: [{ keywords: ['vintage', 'rare'] }, { keywords: ['90s'] }] },
      blacklist_keywords: ['fake'],
    });
    expect(keywordText(f)).toBe('vintage rare 90s fake');
    expect(keywordText(makeFilter({}))).toBe('');
  });
});

describe('formatTime', () => {
  it('returns empty for nullish/invalid input', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('')).toBe('');
    expect(formatTime('not-a-date')).toBe('');
  });

  it('formats a valid ISO timestamp as a wall-clock time', () => {
    expect(formatTime('2026-06-20T14:32:00.000Z', 'en-US')).toMatch(/\d{1,2}:\d{2}/);
  });
});

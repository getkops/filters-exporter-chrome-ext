import { describe, it, expect } from 'vitest';
import { makeFilter } from '../test-fixtures';
import {
  matchesSearch,
  computeVisibleIndices,
  selectionSummary,
  toggleAllVisible,
} from './selectors';

describe('matchesSearch', () => {
  it('matches name, brands and keywords; empty query matches all', () => {
    const f = makeFilter({
      name: 'Nike Air',
      brand_names: ['Nike'],
      keyword_rules: { groups: [{ keywords: ['retro'] }] },
      blacklist_keywords: ['fake'],
    });
    expect(matchesSearch(f, '')).toBe(true);
    expect(matchesSearch(f, 'nike')).toBe(true);
    expect(matchesSearch(f, 'retro')).toBe(true);
    expect(matchesSearch(f, 'fake')).toBe(true);
    expect(matchesSearch(f, 'adidas')).toBe(false);
  });
});

describe('computeVisibleIndices', () => {
  it('filters by a trimmed, case-insensitive query', () => {
    const filters = [
      makeFilter({ name: 'Nike' }),
      makeFilter({ name: 'Adidas' }),
      makeFilter({ name: 'Nike Pro' }),
    ];
    expect(computeVisibleIndices(filters, '  NIKE ')).toEqual([0, 2]);
    expect(computeVisibleIndices(filters, '')).toEqual([0, 1, 2]);
  });
});

describe('selectionSummary', () => {
  it('reports all / none / indeterminate states', () => {
    expect(selectionSummary([0, 1, 2], new Set([0, 1, 2]))).toMatchObject({
      allVisibleSelected: true,
      indeterminate: false,
    });
    expect(selectionSummary([0, 1, 2], new Set())).toMatchObject({
      allVisibleSelected: false,
      indeterminate: false,
    });
    expect(selectionSummary([0, 1, 2], new Set([1]))).toMatchObject({
      allVisibleSelected: false,
      indeterminate: true,
    });
    expect(selectionSummary([], new Set())).toMatchObject({
      allVisibleSelected: false,
      indeterminate: false,
    });
  });
});

describe('toggleAllVisible', () => {
  it('selects all when not all selected, clears when all selected, preserves others', () => {
    expect([...toggleAllVisible([0, 1, 2], new Set())].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect([...toggleAllVisible([0, 1, 2], new Set([0, 1, 2]))]).toEqual([]);
    expect([...toggleAllVisible([0, 1], new Set([0, 5]))].sort((a, b) => a - b)).toEqual([0, 1, 5]);
  });
});

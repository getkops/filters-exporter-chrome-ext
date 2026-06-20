import { describe, it, expect } from 'vitest';
import { FILTER_EXPORT_SCHEMA_VERSION } from '../../generated/filter-export-schema.generated';
import { EXPORT_SCHEMA_VERSION } from './constants';

describe('EXPORT_SCHEMA_VERSION', () => {
  it('mirrors the generated schema SSOT (so the popup can stay zod-free)', () => {
    expect(EXPORT_SCHEMA_VERSION).toBe(FILTER_EXPORT_SCHEMA_VERSION);
  });
});

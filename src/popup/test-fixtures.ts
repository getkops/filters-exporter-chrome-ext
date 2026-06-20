import type { ExportedFilter } from '../generated/filter-export-schema.generated';

/** Build a complete `ExportedFilter` for tests, overriding only what matters. */
export function makeFilter(overrides: Partial<ExportedFilter> = {}): ExportedFilter {
  return {
    name: 'Filter',
    enabled: true,
    autocop: false,
    catalog_ids: [],
    brand_ids: [],
    brand_names: [],
    size_ids: [],
    size_names: [],
    status_ids: [],
    color_ids: [],
    color_names: [],
    material_ids: [],
    material_names: [],
    country_ids: [],
    region_isos: [],
    video_game_platform_ids: [],
    video_game_rating_ids: [],
    isbn_list: [],
    keyword_rules: null,
    blacklist_keywords: [],
    ...overrides,
  };
}

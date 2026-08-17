/* prettier-ignore */
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED FILE — DO NOT EDIT.
//
// Self-contained filter-export contract (ADR-040): the typed JSON envelope the
// Kops Filter Exporter produces and Kops imports. It imports only `zod` — no
// other modules — so this one file is the schema source of truth on the
// backend and is vendored verbatim into the public extension.
//
// Do not hand-edit. Regenerate it from the schema; a drift-check gate keeps the
// backend copy and the vendored copy byte-identical.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

export const filterExportSourceValues = ['souk', 'vtools'] as const;
export type FilterExportSource = (typeof filterExportSourceValues)[number];
export const filterExportSourceSchema = z.enum(filterExportSourceValues);

export const exportedFilterSchema = z.object({
    name: z.string(),
    enabled: z.boolean(),
    autocop: z.boolean(),
    price_min: z.number().optional(),
    price_max: z.number().optional(),
    seller_rating_min: z.number().optional(),
    seller_eval_count_min: z.number().optional(),
    exclude_business_sellers: z.boolean().optional(),
    keywords_title_only: z.boolean().optional(),
    blacklist_title_only: z.boolean().optional(),
    catalog_ids: z.array(z.number()).default([]),
    brand_ids: z.array(z.number()).default([]),
    brand_names: z.array(z.string()).default([]),
    size_ids: z.array(z.number()).default([]),
    size_names: z.array(z.string()).default([]),
    status_ids: z.array(z.number()).default([]),
    color_ids: z.array(z.number()).default([]),
    color_names: z.array(z.string()).default([]),
    material_ids: z.array(z.number()).default([]),
    material_names: z.array(z.string()).default([]),
    country_ids: z.array(z.number()).default([]),
    region_isos: z.array(z.string()).default([]),
    video_game_platform_ids: z.array(z.number()).default([]),
    video_game_rating_ids: z.array(z.number()).default([]),
    video_game_rating_names: z.array(z.string()).default([]),
    isbn_list: z.array(z.string()).default([]),
    model_ids: z.array(z.number()).default([]),
    model_names: z.array(z.string()).default([]),
    storage_names: z.array(z.string()).default([]),
    sim_locks: z.array(z.string()).default([]),
    battery_health_buckets: z.array(z.string()).default([]),
    keyword_rules: z.lazy(() => keywordRulesSchema).nullable(),
    blacklist_keywords: z.array(z.string()).default([]),
});

export const filterExportEnvelopeSchema = z.object({
    schema_version: z.number(),
    source: filterExportSourceSchema,
    exported_at: z.string(),
    filters: z.array(exportedFilterSchema).default([]),
});

export const keywordGroupSchema = z.object({
    keywords: z.array(z.string()).default([]),
});

export const keywordRulesSchema = z.object({
    groups: z.array(keywordGroupSchema).default([]),
});

export type ExportedFilter = z.infer<typeof exportedFilterSchema>;

export type FilterExportEnvelope = z.infer<typeof filterExportEnvelopeSchema>;

export type KeywordGroup = z.infer<typeof keywordGroupSchema>;

export type KeywordRules = z.infer<typeof keywordRulesSchema>;

export const FILTER_EXPORT_SCHEMA_VERSION = 1;

export function validateFilterExport(raw: unknown): FilterExportEnvelope {
    const parsed = filterExportEnvelopeSchema.parse(raw);
    if (parsed.schema_version !== FILTER_EXPORT_SCHEMA_VERSION) {
        throw new Error(`Unsupported filter export schema_version ${parsed.schema_version} (expected ${FILTER_EXPORT_SCHEMA_VERSION}). Re-export from the latest Kops Filter Exporter extension.`);
    }
    return parsed;
}

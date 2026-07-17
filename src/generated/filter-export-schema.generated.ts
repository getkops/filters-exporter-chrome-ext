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
    catalog_ids: z.array(z.number()),
    brand_ids: z.array(z.number()),
    brand_names: z.array(z.string()),
    size_ids: z.array(z.number()),
    size_names: z.array(z.string()),
    status_ids: z.array(z.number()),
    color_ids: z.array(z.number()),
    color_names: z.array(z.string()),
    material_ids: z.array(z.number()),
    material_names: z.array(z.string()),
    country_ids: z.array(z.number()),
    region_isos: z.array(z.string()),
    video_game_platform_ids: z.array(z.number()),
    video_game_rating_ids: z.array(z.number()),
    isbn_list: z.array(z.string()),
    model_ids: z.array(z.number()),
    model_names: z.array(z.string()),
    storage_names: z.array(z.string()),
    sim_locks: z.array(z.string()),
    battery_health_buckets: z.array(z.string()),
    keyword_rules: z.lazy(() => keywordRulesSchema).nullable(),
    blacklist_keywords: z.array(z.string()),
});

export const filterExportEnvelopeSchema = z.object({
    schema_version: z.number(),
    source: filterExportSourceSchema,
    exported_at: z.string(),
    filters: z.array(exportedFilterSchema),
});

export const keywordGroupSchema = z.object({
    keywords: z.array(z.string()),
});

export const keywordRulesSchema = z.object({
    groups: z.array(keywordGroupSchema),
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

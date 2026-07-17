<p align="center">
  <img src="icons/icon128.png" alt="Kops Filter Exporter" width="120" />
</p>

<h1 align="center">Kops Filter Exporter</h1>

<p align="center">
  <strong>Chrome extension (MV3) that extracts filters from V-Tools &amp; Souk.to and exports them as a typed JSON envelope for import into Kops</strong>
  <br />
  <em>Open-source tool by <a href="https://getkops.com">Kops</a> — the fastest Vinted items monitor on the market</em>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/kops-filter-exporter/mbdpmogocbigcjghpdlcckplhjnbhand">
    <img src="https://img.shields.io/chrome-web-store/v/mbdpmogocbigcjghpdlcckplhjnbhand?label=chrome%20web%20store&logo=googlechrome&logoColor=white&color=4285F4" alt="Chrome Web Store" />
  </a>
  <img src="https://img.shields.io/badge/manifest-v3-brightgreen" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/built%20with-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
</p>

---

## What it does

Kops Filter Exporter silently intercepts the filters/alerts API responses when you visit V-Tools or Souk.to dashboards, normalizes them into a **typed, versioned JSON envelope**, and lets you download everything as a single `.json` file ready to import into [Kops](https://getkops.com).

> **v2.0.0** replaced the old lossy CSV export with a typed JSON envelope. CSV could not represent keyword groups (AND/OR logic); the JSON contract can. Legacy **V-Tools V1** is no longer supported.

### Supported sources

| Source      | Dashboard URL                            | Intercepted API                          |
| ----------- | ---------------------------------------- | ---------------------------------------- |
| **V-Tools** | `dashboard.v-tools.com/dashboard/filters`| `www.v-tools.com/api/vinted/filters/list`|
| **Souk.to** | `souk.to/{lang}/app/alerts`              | `api.souk.to/api/v1/matching_alert/web`  |

> Souk.to language prefixes (`/en/`, `/fr/`, etc.) and multi-page results are handled automatically — the extension replays your authenticated request to fetch every page.

## The JSON export format

The export is a typed envelope whose schema is the **single source of truth**, generated from the Kops Go DTOs (ADR-040) and vendored into this repo at `src/generated/filter-export-schema.generated.ts`.

```jsonc
{
  "schema_version": 1,                 // bumped on breaking changes; Kops rejects mismatches
  "source": "vtools",                  // "vtools" | "souk"
  "exported_at": "2026-06-20T10:00:00.000Z",
  "filters": [
    {
      "name": "Example phone deals",
      "enabled": true,
      "autocop": false,
      "price_min": 2,                  // omitted when 0/absent
      "price_max": 20,
      "catalog_ids": [3661],
      "brand_ids": [1001],
      "brand_names": ["Sample Brand"],
      "size_ids": [], "size_names": [],
      "status_ids": [3],
      "color_ids": [1], "color_names": ["Black"],
      "material_ids": [], "material_names": [],
      "country_ids": [16, 19],
      "region_isos": [],               // V-Tools regions resolved to ISO codes
      "video_game_platform_ids": [],
      "video_game_rating_ids": [],
      "isbn_list": [],
      "model_ids": [4041, 4042],       // Vinted brand_collection (phone model) ids
      "model_names": [],               // Souk supplies these; V-Tools sends id-only (Kops resolves)
      "storage_names": ["128 Go", "256 Go"],
      "sim_locks": ["Non"],            // SIM-lock value text
      "battery_health_buckets": [],    // no Vinted facet — settable in Kops only
      "keyword_rules": {               // groups are AND'd; keywords within a group are OR'd
        "groups": [
          { "keywords": ["alpha", "bravo"] },
          { "keywords": ["charlie", "delta"] }
        ]
      },
      "blacklist_keywords": ["echo"]
    }
  ]
}
```

- **Keyword logic is preserved**: `keyword_rules.groups` are AND'd together; the `keywords` inside each group are OR'd. `blacklist_keywords` are negative terms.
- Every list field is always present (`[]` when empty). `keyword_rules` is `null` when a filter has no include keywords.
- Filename: `kops-filters-v{schema_version}-{YYYY-MM-DD}.json`.

## Installation

### Option A — Chrome Web Store (recommended)

Install directly from the [**Chrome Web Store**](https://chromewebstore.google.com/detail/kops-filter-exporter/mbdpmogocbigcjghpdlcckplhjnbhand) — one click, automatic updates.

### Option B — Download the latest release

1. Go to the [**Releases page**](https://github.com/getkops/filters-exporter-chrome-ext/releases/latest)
2. Download the `kops-filter-exporter-v*.zip` and unzip it
3. Open `chrome://extensions` → enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the unzipped folder

### Option C — Build from source

This extension is written in TypeScript and bundled with esbuild, so it must be built before loading.

The toolchain (Node + pnpm) is pinned with [mise](https://mise.jdx.dev). Install mise once, then:

```bash
mise install      # installs the pinned Node + pnpm (see mise.toml)
pnpm install      # installs JS dependencies
mise run build    # bundles src/ → dist/   (or: pnpm build)
```

> Don't have mise? You can still use any Node ≥ 24 and pnpm 11 directly with `pnpm install && pnpm build` — mise just guarantees everyone uses the same versions.

Then in Chrome:

1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select the repository root (Chrome reads `manifest.json`, which points at `dist/`)

## Usage

1. Navigate to a supported filter page (V-Tools or Souk.to), or use the **Refresh** dropdown in the popup to open one
2. The extension badge shows the number of captured filters
3. Click the extension icon to see and search the filter list (select rows to export a subset)
4. Click **Export JSON** to download the envelope, then import it into Kops

## Development

| Command              | What it does                                              |
| -------------------- | -------------------------------------------------------- |
| `pnpm build`         | Bundle `src/*.ts` → `dist/` (IIFE files Chrome loads)    |
| `pnpm typecheck`     | `tsc --noEmit` strict type-check                          |
| `pnpm test`          | Run the vitest suite against the fixture exports          |
| `pnpm validate:exports` | Lint real exports dropped in `tmp/exports/` for bad data |
| `pnpm anonymize`     | Scrub a raw V-Tools/Souk capture into a safe fixture      |
| `pnpm verify:schema` | Fail if the vendored schema drifts from the Kops SSOT     |
| `pnpm sync:schema`   | Copy the freshly generated schema from the Kops repo      |

The common ones are also exposed as mise tasks — `mise run build` / `typecheck` / `test` / `validate`, and `mise run check` runs the full CI gate (typecheck + build + test) at once. CI provisions Node + pnpm with mise, so local and CI use identical versions (see `mise.toml`).

### Schema sync gate

The JSON contract is generated from the Go DTOs in the Kops monorepo and vendored here. After changing the Go DTOs, maintainers re-sync the vendored copy:

```bash
KOPS_REPO=/path/to/kops-dashboard pnpm sync:schema
```

CI runs `pnpm verify:schema`, which diffs the vendored file against
`$KOPS_REPO/api/gen/extension/filter-export-schema.generated.ts` **only when `KOPS_REPO` is set** (otherwise it is a no-op, since the vendored file is the source of truth in environments without the monorepo). **Do not hand-edit** `src/generated/filter-export-schema.generated.ts`.

### Test fixtures & anonymization

The committed `fixtures/*.json` are **fully synthetic** — no real account data — and split the parser scenarios into named files (`souk-keyword-groups`, `souk-legacy-search-text`, `vtools-keyword-operators`, `vtools-facets`, `vtools-phone`).

Real captures (`example_*.json`) are **gitignored**. To turn one into a safe fixture, run the anonymizer: it deterministically strips every account identifier (`user_id`, `client_id`, alert/filter IDs, timestamps), replaces names and keyword terms with synthetic tokens, and genericizes brand/model titles, while preserving structure so the output still exercises every parser path:

```bash
pnpm anonymize example_souk.json --out fixtures/my-scenario.json
```

### Validating real exports

To sanity-check real data the extension just produced — without committing it — drop the files into the gitignored `tmp/exports/` folder and run:

```bash
pnpm validate:exports                       # scan tmp/exports/*.json (verbose)
pnpm validate:exports path/to/file.json     # or pass explicit files/dirs
pnpm validate:exports tmp/exports --brief    # hide per-finding context detail
pnpm validate:exports tmp/exports --json     # machine-readable report
pnpm validate:exports tmp/exports --strict   # warnings also fail (exit 1)
```

It routes each file through the **exact production pipeline** (it imports the real `normalize.ts` + the vendored zod schema — no reimplementation, so what it checks is byte-for-byte what the extension exports) and accepts both shapes you can have on disk:

- **Typed export envelopes** downloaded from the popup (`kops-filters-v1-*.json`) — validated directly against `filterExportEnvelopeSchema`.
- **Raw API captures** (Souk `body.alerts` / V-Tools V2 `data.list`) — re-normalized, then schema-validated. Legacy V-Tools V1 (`data: [...]`) is reported as unsupported.

On top of schema validation it runs integrity heuristics tiered by signal (errors → warnings → notes) to surface extraction bugs: unresolved regions (missing from `VTOOLSV2_REGIONS`), `price_min > price_max`, `*_ids`/`*_names` length mismatches, malformed/mangled text (U+FFFD or control chars), empty "husk" filters, bad ISBNs, empty keyword groups, and accidental copies (filters with identical criteria). Output is **verbose by default** — each finding prints the offending arrays/values as context, and an **"Action required"** section aggregates the de-duplicated `reg_…` ids you need to add to `VTOOLSV2_REGIONS`. Exit code is non-zero when any file has errors (or, under `--strict`, any warnings). Runs on Node ≥23.6 native TypeScript — no build step. `tmp/` is gitignored, so nothing you drop there is ever committed.

## How it works

The extension uses a **fetch/XHR monkey-patching** technique via content scripts — no `chrome.debugger`, so there's no yellow debugging banner.

```
inject.ts (page MAIN world) → content.ts (content script) → background.ts (service worker) → popup.ts
```

1. `inject.ts` patches `window.fetch` and `XMLHttpRequest` to capture matching API responses (and paginate them)
2. `content.ts` bridges the page context to the extension via `window.postMessage`
3. `background.ts` normalizes the data into `ExportedFilter[]`, stores it in `chrome.storage.local`, and builds the validated JSON envelope
4. `popup.ts` displays the filters and triggers the JSON download

## Project structure

```
├── manifest.json                # Manifest V3 (points at dist/)
├── mise.toml                    # pinned Node + pnpm toolchain + task shortcuts
├── pnpm-workspace.yaml          # pnpm settings (build-script allow-list)
├── build.mjs                    # esbuild bundler
├── tsconfig.json                # strict TypeScript config
├── vitest.config.ts             # node-env test config
├── scripts/
│   ├── sync-schema.mjs          # cross-repo schema sync / drift gate
│   ├── anonymize-export.mjs     # scrub a raw capture into a safe fixture
│   └── validate-export.ts       # integrity linter for real exports (tmp/exports/)
├── fixtures/                    # committed SYNTHETIC example exports (tests)
├── src/
│   ├── inject.ts                # fetch/XHR interception + pagination (page context)
│   ├── content.ts               # message bridge (content script)
│   ├── background.ts            # service worker, storage, JSON export
│   ├── normalize.ts             # pure V-Tools/Souk normalizers + region table
│   ├── parsers.test.ts          # vitest suite (runs against fixtures)
│   ├── generated/
│   │   └── filter-export-schema.generated.ts   # vendored SSOT — DO NOT EDIT
│   └── popup/
│       ├── popup.html           # popup UI
│       ├── popup.ts             # popup logic
│       └── popup.css            # dark-mode styles (raw CSS)
├── dist/                        # build output (loaded by Chrome)
└── icons/                       # extension icons (16/48/128px)
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests. Run `mise run check` (typecheck + build + test) before pushing.

## License

MIT — Made with ♥ by [Kops](https://getkops.com)

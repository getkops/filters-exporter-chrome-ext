// build-firefox.mjs — derive the Firefox (AMO) package from the Chrome build.
//
// The repo's manifest.json targets Chrome (MV3 `background.service_worker`).
// Firefox does not run MV3 service workers and needs an explicit Gecko add-on id,
// so this script derives a Firefox-specific manifest FROM the Chrome manifest
// (single source of truth — the version, permissions, content_scripts, etc. are
// never duplicated by hand, so the two can't drift) and assembles a ready-to-
// package staging dir under build/firefox/:
//
//   - background.service_worker  →  background.scripts   (event page; background.ts
//                                    is service-worker-safe so it runs unchanged)
//   - + browser_specific_settings.gecko { id, strict_min_version: "128.0" }
//     (128 is the first Firefox with content_scripts "world": "MAIN" support, which
//      the interception in inject.ts relies on)
//   - everything else (name, version, permissions, action, content_scripts, …) verbatim
//
// Run AFTER `node build.mjs` (it needs dist/). The staging dir holds manifest.json
// at its root plus dist/ _locales/ icons/ LICENSE — the exact fileset AMO expects.
// `pnpm lint:firefox` / `pnpm run:firefox` point web-ext at build/firefox/.
//
// Usage:  node build.mjs && node scripts/build-firefox.mjs   (== pnpm build:firefox)

import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = resolve(root, 'build/firefox');

// Firefox add-on identity. The id is PERMANENT once the AMO listing is created —
// it ties updates and chrome.storage to this add-on, so it must never change.
const GECKO_ID = 'kops-filter-exporter@getkops.com';
// Gated by the content-script "world": "MAIN" support that landed in Firefox 128.
const STRICT_MIN_VERSION = '128.0';

// Copied verbatim into the staging dir (same fileset as the Chrome release zip).
const ASSETS = ['dist', '_locales', 'icons', 'LICENSE'];

async function main() {
  if (!existsSync(resolve(root, 'dist'))) {
    console.error('[build-firefox] dist/ not found — run `node build.mjs` first.');
    process.exit(1);
  }

  // Derive the Firefox manifest from the Chrome one (single source of truth).
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  manifest.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: STRICT_MIN_VERSION,
      // Firefox now requires an explicit data-collection declaration on new
      // add-ons. This extension collects nothing (see PRIVACY_POLICY.md), so
      // declare the "none" sentinel — this is also what the AMO listing shows.
      data_collection_permissions: { required: ['none'] },
    },
  };
  // Firefox MV3 uses a non-persistent background script (event page), not a worker.
  manifest.background = { scripts: ['dist/background.js'] };

  // Assemble a clean staging dir: manifest at the root + the referenced assets.
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const asset of ASSETS) {
    const from = resolve(root, asset);
    if (!existsSync(from)) {
      console.error(`[build-firefox] missing asset: ${asset}`);
      process.exit(1);
    }
    await cp(from, join(OUT, asset), { recursive: true });
  }

  console.log(`[build-firefox] staged build/firefox/ (v${manifest.version}) — ready for web-ext / AMO.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// sync-schema.mjs — cross-repo sync for the vendored filter-export schema.
//
// The filter-export contract (ADR-040) is generated from the Go DTO SSOT in the
// Kops monorepo. This script copies the generated TS into this repo (or, with
// --check, verifies the two are identical and fails on drift).
//
// Usage:
//   KOPS_REPO=/path/to/kops-dashboard node scripts/sync-schema.mjs          # copy
//   KOPS_REPO=/path/to/kops-dashboard node scripts/sync-schema.mjs --check  # diff
//
// `verify:schema` (CI gate) runs this with --check ONLY when KOPS_REPO is set;
// otherwise it prints a notice and exits 0 (the vendored file is the source of
// truth in environments without the monorepo checked out).

import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const DEST = resolve(root, 'src/generated/filter-export-schema.generated.ts');
const SRC_REL = 'api/gen/extension/filter-export-schema.generated.ts';

const check = process.argv.includes('--check');
const kopsRepo = process.env.KOPS_REPO;

async function main() {
  if (!kopsRepo) {
    if (check) {
      console.log(
        '[sync-schema] KOPS_REPO not set — skipping drift check (vendored schema treated as source of truth).',
      );
      process.exit(0);
    }
    console.error(
      '[sync-schema] KOPS_REPO is not set. Run with KOPS_REPO=/path/to/kops-dashboard to sync.',
    );
    process.exit(1);
  }

  const src = join(kopsRepo, SRC_REL);
  if (!existsSync(src)) {
    console.error(`[sync-schema] Generated source not found: ${src}`);
    console.error('             Regenerate the schema in the Kops repo first.');
    process.exit(1);
  }

  if (check) {
    const [a, b] = await Promise.all([readFile(src, 'utf8'), readFile(DEST, 'utf8')]);
    if (a !== b) {
      console.error('[sync-schema] DRIFT: vendored schema differs from the generated source.');
      console.error(`             source: ${src}`);
      console.error(`             vendored: ${DEST}`);
      console.error('             Run `KOPS_REPO=… pnpm sync:schema` to update.');
      process.exit(1);
    }
    console.log('[sync-schema] OK — vendored schema matches the generated source.');
    return;
  }

  await mkdir(dirname(DEST), { recursive: true });
  await copyFile(src, DEST);
  console.log(`[sync-schema] Copied ${src} → ${DEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

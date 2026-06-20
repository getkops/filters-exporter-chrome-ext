// build.mjs — esbuild bundler for the Kops Filter Exporter extension.
//
// Bundles each TypeScript entry point into a single IIFE file under dist/ that
// Chrome can load directly (zod is bundled into background.js). Also copies the
// popup's static assets (html + css) into dist/popup/.

import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

const ENTRIES = [
  { in: 'src/background.ts', out: 'dist/background.js' },
  { in: 'src/inject.ts', out: 'dist/inject.js' },
  { in: 'src/content.ts', out: 'dist/content.js' },
  { in: 'src/popup/popup.ts', out: 'dist/popup/popup.js' },
];

async function run() {
  // Clean previous output so deleted entries never linger.
  await rm(outdir, { recursive: true, force: true });

  for (const entry of ENTRIES) {
    const outfile = resolve(root, entry.out);
    await mkdir(dirname(outfile), { recursive: true });
    await build({
      entryPoints: [resolve(root, entry.in)],
      outfile,
      bundle: true,
      format: 'iife',
      target: ['chrome110'],
      platform: 'browser',
      sourcemap: false,
      minify: false,
      legalComments: 'none',
      logLevel: 'info',
    });
  }

  // Copy popup static assets and ensure the html points at the bundled popup.js.
  const popupOutDir = resolve(outdir, 'popup');
  await mkdir(popupOutDir, { recursive: true });

  let html = await readFile(resolve(root, 'src/popup/popup.html'), 'utf8');
  // The bundle emits popup.js next to popup.html, so the src is already correct;
  // normalize any "./popup.js" / "popup.ts" reference defensively.
  html = html.replace(/src=["'](?:\.\/)?popup\.(?:ts|js)["']/g, 'src="popup.js"');
  await writeFile(resolve(popupOutDir, 'popup.html'), html);
  await copyFile(resolve(root, 'src/popup/popup.css'), resolve(popupOutDir, 'popup.css'));

  console.log('Build complete → dist/');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

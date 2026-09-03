#!/usr/bin/env node
// Local development: rebuild the catalogue when plugins change, then run the Astro dev server.
// Usage: npm run dev   (from site/)  ->  http://localhost:4321/
import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(SITE, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const buildCatalog = () => {
  const r = spawnSync(process.execPath, [join(SITE, 'scripts/build-catalog.mjs')], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) console.error('dev: catalogue build failed, keeping the previous public/catalog.json');
};
buildCatalog();

let timer;
const rebuild = (what) => { clearTimeout(timer); timer = setTimeout(() => { console.log(`dev: ${what} changed, rebuilding catalogue`); buildCatalog(); }, 300); };
for (const p of [join(ROOT, 'plugins'), join(ROOT, '.claude-plugin'), join(SITE, 'collections.json'), join(SITE, 'synonyms.json')]) {
  try { watch(p, { recursive: true }, (_e, f) => rebuild(f ?? p)); } catch { /* path may not exist yet */ }
}

const astro = spawn(npx, ['astro', 'dev', '--host', ...process.argv.slice(2)], { cwd: SITE, stdio: 'inherit', env: process.env });
astro.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => astro.kill('SIGINT'));

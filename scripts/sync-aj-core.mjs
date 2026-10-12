/**
 * Vendor the scan/verdict core of agent-janitor into src/vendor/aj-core.
 *
 * The plugin is a thin Cordis adapter; artifact detection, reference
 * finding, git metadata, and verdict rules stay owned by the agent-janitor
 * repository. This script copies the closure `analyze()` needs and refuses
 * anything that grows imports outside it.
 *
 * Usage: node scripts/sync-aj-core.mjs [--check]
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, '..');
const sourceRoot = process.env.AJ_SRC
  ? resolve(pluginRoot, process.env.AJ_SRC)
  : resolve(pluginRoot, '..', 'agent-janitor', 'src');
const vendorRoot = join(pluginRoot, 'src', 'vendor', 'aj-core');

/** The janitor closure: analyze() and everything it pulls. */
const FILES = [
  'plan.ts',
  'detect.ts',
  'verdict.ts',
  'refs.ts',
  'gitmeta.ts',
  'git.ts',
  'config.ts',
  'util.ts',
];
const ALLOWED_IMPORTS = new Set(FILES.map((f) => `./${f.replace(/\.ts$/, '.js')}`));

function importsOf(source) {
  const imports = [];
  for (const line of source.split('\n')) {
    const m = /^import\s(?:type\s)?(?:[^'"]*from\s)?['"]([^'"]+)['"]/.exec(line);
    if (m) imports.push(m[1]);
  }
  return imports;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  let dirty = false;

  await mkdir(vendorRoot, { recursive: true });

  for (const file of FILES) {
    const src = join(sourceRoot, file);
    if (!existsSync(src)) {
      console.error(`sync-aj-core: missing source ${src}`);
      console.error('Is the agent-janitor checkout a sibling of this plugin?');
      process.exit(1);
    }
    const source = await readFile(src, 'utf8');

    for (const spec of importsOf(source)) {
      const ok = ALLOWED_IMPORTS.has(spec) || spec.startsWith('node:') || spec === 'yaml';
      if (!ok) {
        console.error(`sync-aj-core: ${file} now imports "${spec}" — outside the janitor closure.`);
        console.error('Extend FILES/ALLOWED_IMPORTS deliberately after reviewing that dependency.');
        process.exit(1);
      }
    }

    const dest = join(vendorRoot, file);
    const existing = existsSync(dest) ? await readFile(dest, 'utf8') : null;
    if (existing !== source) dirty = true;

    if (!checkOnly && existing !== source) {
      await copyFile(src, dest);
      console.log(`synced ${file}${existing === null ? ' (new)' : ' (updated)'}`);
    }
  }

  if (checkOnly) {
    if (dirty) {
      console.error('sync-aj-core: vendored copy is stale; run `npm run sync`.');
      process.exit(1);
    }
    console.log('sync-aj-core: vendored copy is in sync.');
  } else if (!dirty) {
    console.log('sync-aj-core: already in sync.');
  }
}

main();

/**
 * Unit tests driving the vendored janitor engine (analyze) over a real
 * fixture tree — no DSH host needed. Run: npm test
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, renderPlanMarkdown } from '../lib/vendor/aj-core/plan.js';
import { DEFAULT_CONFIG } from '../lib/vendor/aj-core/config.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${name}`);
    console.error(err.message);
  }
}

const OLD = new Date(Date.now() - 30 * 24 * 3600 * 1000);

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-janitor-'));
  execSync('git init -q && git config user.email t@t && git config user.name t', { cwd: root });
  const files = {
    'README.md': '# repo\n',
    'plans/2026-09-01-task.md': '# Plan\nsome plan text\n',
    'scratch-oneoff.ts': 'console.log("one off");\n',
    'src/fresh-scratch.ts': 'export const x = 1;\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, content);
    utimesSync(p, OLD, OLD);
  }
  writeFileSync(join(root, 'plans', '2026-10-11-today.md'), '# fresh plan\n');
  execSync('git add -A && git commit -qm init', { cwd: root });
  return root;
}

console.log('vendored engine: analyze');

await test('plan doc and scratch script detected; non-debris never appears', () => {
  const root = fixture();
  try {
    const plan = analyze(root, DEFAULT_CONFIG);
    const verdicts = new Map(plan.items.map((i) => [i.path, i.verdict]));
    assert.ok(verdicts.has('plans/2026-09-01-task.md'), `plan doc detected: ${[...verdicts.keys()]}`);
    assert.ok(verdicts.has('scratch-oneoff.ts'), 'scratch script detected');
    // A plain README is not debris — it must never become a plan item.
    assert.equal(verdicts.has('README.md'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('protected paths are honored (exact file or directory prefix)', () => {
  const root = fixture();
  try {
    const config = { ...DEFAULT_CONFIG, protected: ['plans'] };
    const plan = analyze(root, config);
    const verdicts = new Map(plan.items.map((i) => [i.path, i.verdict]));
    assert.equal(verdicts.get('plans/2026-09-01-task.md'), 'protected');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('minAgeDays keeps younger files safe', () => {
  const root = fixture();
  try {
    // Fixture files were git-committed today, so age is ~0 either way;
    // raising the bar to 365d must flip detected artifacts to 'recent'.
    const plan = analyze(root, { ...DEFAULT_CONFIG, minAgeDays: 365 });
    const verdicts = new Map(plan.items.map((i) => [i.path, i.verdict]));
    assert.equal(verdicts.get('scratch-oneoff.ts'), 'recent');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('markdown plan renders with paths and verdicts', () => {
  const root = fixture();
  try {
    const md = renderPlanMarkdown(analyze(root, DEFAULT_CONFIG));
    assert.ok(md.includes('plans/2026-09-01-task.md'));
    assert.ok(/protected|keep|recent|needs-review|safe-to-remove/.test(md));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('analyze is deterministic across runs', () => {
  const root = fixture();
  try {
    const a = JSON.stringify(analyze(root, DEFAULT_CONFIG).items.map((i) => [i.path, i.verdict]));
    const b = JSON.stringify(analyze(root, DEFAULT_CONFIG).items.map((i) => [i.path, i.verdict]));
    assert.equal(a, b);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

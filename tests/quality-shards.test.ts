// Dom 2026-10-12 (CI runners first): quality.yml runs `quality:ci` as a matrix of 4 shards instead of one 12-minute job. The sharded
// run must stay the SAME gate: quality:static + test:all is exactly quality:ci, every test-file shard runs, and the one `quality` job
// deploy.sh reads (scripts/deploy.sh:73) is green only when every shard is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('.github/workflows/quality.yml', 'utf8');
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
const jobBlock = (name: string) => { const i = text.indexOf(`\n  ${name}:\n`); assert.ok(i >= 0, `quality.yml has no job ${name}`); const rest = text.slice(i + 1); const next = rest.slice(1).search(/\n {2}[\w-]+:\n/); return next < 0 ? rest : rest.slice(0, next + 1); };
const steps = (s: string) => s.split(' && ');

test('quality:static + test:all is exactly quality:ci, so the shards run the same checks (a step added to one but not the other fails here)', () => {
  const ci = steps(scripts['quality:ci']!), stat = steps(scripts['quality:static']!);
  assert.deepEqual([...stat].sort(), ci.filter((s) => s !== 'npm run test:all').sort());
  assert.equal(ci.filter((s) => s === 'npm run test:all').length, 1, 'quality:ci runs test:all once');
});

test('the shard matrix: the static part runs quality:static and the database checks, and every test-file shard 1..N of N is listed', () => {
  const block = jobBlock('quality-shard');
  const parts = /\n {8}part: \[([^\]]+)\]/.exec(block)?.[1]?.split(',').map((s) => s.trim()) ?? [];
  assert.equal(parts.length, 4, `a matrix of 4: ${parts.join(' ')}`);
  assert.ok(parts.includes('static'));
  assert.match(block, /if: matrix\.part == 'static'\n {8}run: npm run quality:static\n/);
  for (const db of ['account', 'awards', 'origins', 'duel-season']) assert.match(block, new RegExp(`if: matrix\\.part == 'static'\\n {8}name: [^\\n]+\\n {8}run: PG_BIN="\\$\\(pg_config --bindir\\)" node scripts/${db}-database-check\\.mjs`), db);
  const total = Number(/--test-shard="\$\{PART#tests-\}\/(\d+)"/.exec(block)?.[1]);
  const shards = parts.filter((p) => p.startsWith('tests-')).map((p) => Number(p.slice('tests-'.length))).sort((a, b) => a - b);
  assert.deepEqual(shards, Array.from({ length: total }, (_, i) => i + 1), `shards 1..${total} each listed once`);
  assert.match(block, /fail-fast: false/, 'one red shard does not cancel the others (every failure shows)');
});

test('a test shard runs test:all\'s own command with --test-shard, nothing dropped', () => {
  const [pre, run] = scripts['test:all']!.split(' && ');
  assert.equal(run, 'node --test tests/*.test.ts');
  assert.match(jobBlock('quality-shard'), new RegExp(`run: ${pre!.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} && node --test --test-shard="\\$\\{PART#tests-\\}/\\d+" tests/\\*\\.test\\.ts\\n`));
});

test('`quality` is the one verdict: it needs every shard, runs even when one failed, and is green only on success', () => {
  const block = jobBlock('quality');
  assert.match(block, /\n {4}needs: quality-shard\n/);
  assert.match(block, /\n {4}if: always\(\) && \(github\.event\.action != 'edited'/, 'always(): a failed shard still produces a red `quality`, never a skipped one');
  assert.match(block, /\[ "\$SHARDS" = success \] \|\| \{[^}]*exit 1; \}/);
  assert.match(block, /SHARDS: \$\{\{ needs\.quality-shard\.result \}\}/);
  assert.doesNotMatch(jobBlock('quality-shard'), /\n {4}name: quality\n/, 'no shard is named exactly `quality` (deploy.sh selects that name)');
});

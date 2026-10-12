// Dom 2026-10-12 (CI runners first): `quality:ci` is split across two workflows. quality.yml runs quality:static (+ the database checks);
// unit-ci.yml owns test:all (8 shards, the unit receipt), so the suite runs once per PR, not twice (Lead, after #2298 went live in CK).
// Together they must stay the SAME gate: quality:static + test:all is exactly quality:ci, every unit shard runs, the one `quality` job
// deploy.sh reads (scripts/deploy.sh:73) is green only when its shard is, and deploy.sh skips the Mac's suite only with BOTH.
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

test('quality.yml runs quality:static and the database checks, and no test:all shard (unit-ci.yml owns the suite)', () => {
  const block = jobBlock('quality-shard');
  const parts = /\n {8}part: \[([^\]]+)\]/.exec(block)?.[1]?.split(',').map((s) => s.trim()) ?? [];
  assert.deepEqual(parts, ['static']);
  assert.doesNotMatch(text, /--test-shard|tests\/\*\.test\.ts|npm run test:all/, 'the suite is not run here a second time');
  assert.match(block, /if: matrix\.part == 'static'\n {8}run: npm run quality:static\n/);
  for (const db of ['account', 'awards', 'origins', 'duel-season']) assert.match(block, new RegExp(`if: matrix\\.part == 'static'\\n {8}name: [^\\n]+\\n {8}run: PG_BIN="\\$\\(pg_config --bindir\\)" node scripts/${db}-database-check\\.mjs`), db);
  assert.match(block, /fail-fast: false/, 'one red shard does not cancel the others (every failure shows)');
});

test('unit-ci.yml runs test:all\'s own command over shards 1..8, nothing dropped', () => {
  const unit = readFileSync('.github/workflows/unit-ci.yml', 'utf8');
  const [, run] = scripts['test:all']!.split(' && ');
  assert.equal(run, 'node --test tests/*.test.ts');
  assert.match(unit, /node --test --test-shard=\$\{\{ matrix\.shard \}\}\/8 tests\/\*\.test\.ts/);
  assert.match(unit, /shard: \[1, 2, 3, 4, 5, 6, 7, 8\]/);
});

test('deploy.sh skips the Mac\'s suite only when quality AND the unit receipt hold (quality no longer runs test:all)', () => {
  const d = readFileSync('scripts/deploy.sh', 'utf8');
  assert.match(d, /^if \[\[ -n "\$ci_green" && "\$vps_unit" == ok \]\]; then$/m);
  assert.doesNotMatch(d, /^if \[\[ -n "\$ci_green" \]\]; then$/m);
  assert.ok(d.indexOf('vps_unit=$(node scripts/ci-unit-trust.mjs') < d.indexOf('if [[ -n "$ci_green" && "$vps_unit" == ok ]]'), 'the unit receipt is read first');
});

test('`quality` is the one verdict: it needs every shard, runs even when one failed, and is green only on success', () => {
  const block = jobBlock('quality');
  assert.match(block, /\n {4}needs: quality-shard\n/);
  assert.match(block, /\n {4}if: always\(\) && \(github\.event\.action != 'edited'/, 'always(): a failed shard still produces a red `quality`, never a skipped one');
  assert.match(block, /\[ "\$SHARDS" = success \] \|\| \{[^}]*exit 1; \}/);
  assert.match(block, /SHARDS: \$\{\{ needs\.quality-shard\.result \}\}/);
  assert.doesNotMatch(jobBlock('quality-shard'), /\n {4}name: quality\n/, 'no shard is named exactly `quality` (deploy.sh selects that name)');
});

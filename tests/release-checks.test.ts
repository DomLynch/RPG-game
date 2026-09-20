// Runner behaviour for scripts/release-checks.mjs against a throwaway repo with synthetic checks: independent checks run
// concurrently, fixed-port (`strictPort`) scripts run alone, one retry absorbs a flake, a hard failure exits non-zero, and
// the receipt is written only on success. No browser, no GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runner = join(process.cwd(), 'scripts', 'release-checks.mjs');

function repo(commands: string[][]) {
  const root = mkdtempSync(join(tmpdir(), 'release-checks-'));
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(join(root, 'a'), 'a');
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
  mkdirSync(join(root, 'scripts'));
  // a script that sleeps, and one that also declares a fixed port
  writeFileSync(join(root, 'scripts', 'sleep.mjs'), 'const ms = Number(process.argv[2]); setTimeout(() => process.exit(Number(process.argv[3] || 0)), ms);\n');
  writeFileSync(join(root, 'scripts', 'fixed.mjs'), '// strictPort: true\nconst ms = Number(process.argv[2]); setTimeout(() => process.exit(0), ms);\n');
  writeFileSync(join(root, '.quality-gate.json'), JSON.stringify({ commands: [['true']], release_commands: commands }));
  return root;
}

const run = (root: string, env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [runner, root], { encoding: 'utf8', env: { ...process.env, ...env } });

test('independent checks run concurrently; fixed-port checks run alone; receipt written', () => {
  const root = repo([
    ...Array.from({ length: 6 }, () => ['node', 'scripts/sleep.mjs', '700']),
    ['node', 'scripts/fixed.mjs', '300'],
    ['node', 'scripts/fixed.mjs', '300'],
  ]);
  const started = Date.now();
  const result = run(root, { RELEASE_CHECK_CONCURRENCY: '6' });
  const wall = (Date.now() - started) / 1000;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(wall < 3.5, `6x700ms in parallel with 2x300ms fixed-port overlapping should take ~1s + startup, took ${wall}s`);
  assert.match(result.stdout, /8 total, concurrency 6, 2 fixed-port \(one at a time\)/);
  assert.ok(existsSync(join(root, 'artifacts', 'release-checks.json')));
  const written = JSON.parse(readFileSync(join(root, 'artifacts', 'release-checks.json'), 'utf8'));
  assert.equal(written.checks, 8);
  assert.equal(written.checks_detail.length, 8);
  assert.ok(written.checks_detail.every((c: { seconds: number }) => c.seconds > 0.2), 'durations recorded per check');
  assert.ok(existsSync(join(root, 'artifacts', 'release-checks', '01-scripts_sleep.mjs.log')), 'per-check log kept');
});

test('a check that fails is retried once alone; a persistent failure exits non-zero with no receipt', () => {
  const root = repo([['node', 'scripts/sleep.mjs', '10'], ['node', 'scripts/sleep.mjs', '10', '3']]);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Retrying release check 2 alone/);
  assert.match(result.stderr, /Release check 2 output/);
  assert.ok(!existsSync(join(root, 'artifacts', 'release-checks.json')), 'no receipt on failure');
});

test('RELEASE_CHECK_CONCURRENCY=1 is the old serial behaviour', () => {
  const root = repo([['node', 'scripts/sleep.mjs', '400'], ['node', 'scripts/sleep.mjs', '400']]);
  const started = Date.now();
  const result = run(root, { RELEASE_CHECK_CONCURRENCY: '1' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok((Date.now() - started) / 1000 >= 0.8, 'serial: sum of durations');
});

test('longest checks from the previous receipt start first; unknown checks sit at the median', () => {
  const root = repo([['node', 'scripts/sleep.mjs', '50'], ['node', 'scripts/sleep.mjs', '51'], ['node', 'scripts/sleep.mjs', '52'], ['node', 'scripts/sleep.mjs', '53']]);
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  writeFileSync(join(root, 'artifacts', 'release-checks.json'), JSON.stringify({ checks_detail: [
    { command: 'node scripts/sleep.mjs 50', seconds: 5 }, { command: 'node scripts/sleep.mjs 51', seconds: 90 }, { command: 'node scripts/sleep.mjs 53', seconds: 40 },
  ] }));
  const result = run(root, { RELEASE_CHECK_CONCURRENCY: '1' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const order = [...result.stdout.matchAll(/Release check (\d)\/4 started/g)].map(m => Number(m[1]));
  assert.deepEqual(order, [2, 3, 4, 1], 'known 90s first; unknown check at the median (40s) ties the known 40s and keeps contract order; known 5s last');
  assert.match(result.stdout, /ordered by last run's durations \(3 known\)/);
});

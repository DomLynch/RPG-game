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
  assert.match(result.stdout, /8 total, 0 trusted from CI, 8 to run, concurrency 6, 2 fixed-port \(one at a time\)/);
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

test('RELEASE_CHECKS_SKIP leaves trusted checks unexecuted and records them in the receipt', () => {
  const root = repo([['node', 'scripts/sleep.mjs', '10'], ['node', 'scripts/sleep.mjs', '10', '7'], ['node', 'scripts/sleep.mjs', '10']]);
  const result = run(root, { RELEASE_CHECKS_SKIP: '2, 9, x', RELEASE_CHECKS_SKIP_SOURCE: 'CI run 42' });
  assert.equal(result.status, 0, 'check 2 would fail (exit 7) but is trusted, so it never runs: ' + result.stdout + result.stderr);
  assert.match(result.stdout, /check 2\/3 trusted from CI run 42/);
  assert.match(result.stdout, /3 total, 1 trusted from CI run 42, 2 to run/);
  const written = JSON.parse(readFileSync(join(root, 'artifacts', 'release-checks.json'), 'utf8'));
  assert.equal(written.checks, 3);
  assert.deepEqual(written.checks_detail.map((c: { index: number; trusted?: string }) => [c.index, c.trusted ?? null]), [[1, null], [2, 'CI run 42'], [3, null]]);
});

test('ci-trusted-checks trusts only green jobs with receipts on a completed run for the exact sha', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-trust-'));
  const fake = join(dir, 'gh');
  const sha = 'a'.repeat(40);
  // A fake gh: run list -> one completed run for the sha; run view -> jobs; api -> artifact names (no receipt for #3).
  writeFileSync(fake, `#!/bin/bash
if [ -z "$SUMMARY_JSON" ]; then SUMMARY_JSON='{"sha":"${sha}","checks":[{"index":1,"status":0},{"index":2,"status":3},{"index":3,"status":0},{"index":4,"status":5}]}'; fi
case "$1 $2" in
  "run list") echo '[{"databaseId":42,"headSha":"${sha}","url":"https://x/runs/42"}]';;
  "run view") echo '[{"name":"check 1 (a)","conclusion":"success"},{"name":"check 2 (b)","conclusion":"failure"},{"name":"check 3 (c)","conclusion":"success"},{"name":"check 4 (d)","conclusion":"success"},{"name":"summary","conclusion":"success"}]';;
  "api "*) echo '["release-check-1","release-check-2","release-check-4","release-checks-summary"]';;
  "run download") for i in "$@"; do case "$prev" in --dir) dir="$i";; esac; prev="$i"; done; printf '%s' "$SUMMARY_JSON" > "$dir/release-checks-summary.json";;
  *) exit 1;;
esac
`);
  execFileSync('chmod', ['+x', fake]);
  const resolver = join(process.cwd(), 'scripts', 'ci-trusted-checks.mjs');
  const call = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [resolver, ...args], { encoding: 'utf8', env: { ...process.env, CI_TRUST_GH: fake, ...env } });
  let r = call([sha]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '1', 'job 1 green + artifact + receipt status 0 -> trusted; 2 failed; 3 no artifact; 4 green job but receipt status 5');
  assert.match(r.stderr, /trusting 1 check\(s\) \[1\]; running locally: \[2:failure\/receipt-status=3 3:no-artifact 4:receipt-status=5\]/);
  r = call([sha], { SUMMARY_JSON: JSON.stringify({ sha: 'c'.repeat(40), checks: [{ index: 1, status: 0 }] }) });
  assert.equal(r.stdout, '', 'combined receipt for another sha -> nothing trusted');
  r = call(['b'.repeat(40)]);
  assert.equal(r.stdout, '', 'run exists but for a different sha -> nothing trusted');
  r = call([sha], { RELEASE_CHECKS_TRUST_CI: '0' });
  assert.equal(r.stdout, '', 'kill switch');
  r = call(['abc']);
  assert.equal(r.stdout, '', 'short sha rejected');
  r = spawnSync(process.execPath, [resolver, sha], { encoding: 'utf8', env: { ...process.env, CI_TRUST_GH: '/nonexistent/gh' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'gh failure -> nothing trusted, exit 0');
});

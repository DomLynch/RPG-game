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
  // Parallelism is proved by beating the serial floor (6x700 + 2x300 = 4.8 s before any startup), not by an absolute wall time: on a loaded
  // MacBook (load 41, 2026-09-21) the eight node startups alone pushed the old 3.5 s bound to 3.7–4.2 s while the checks still overlapped.
  assert.ok(wall < 4.8, `6x700ms in parallel with 2x300ms fixed-port overlapping must beat the 4.8 s serial floor, took ${wall}s`);
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

test('ci-trusted-checks trusts a check only when its job is green and its receipt says exit 0 for the deployed tree', () => {
  // A throwaway repo: trunk T0, branch B rebased on T0, merged as M. M's tree == B's tree, so a run recorded against B
  // (pull_request / dispatch) vouches for M; T0's own run does not (other tree).
  const repo = mkdtempSync(join(tmpdir(), 'ci-trust-repo-'));
  const g = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'trunk'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  writeFileSync(join(repo, 'a.txt'), '1\n'); g('add', '.'); g('commit', '-qm', 'T0');
  const t0 = g('rev-parse', 'HEAD');
  g('checkout', '-qb', 'branch'); writeFileSync(join(repo, 'a.txt'), '2\n'); g('commit', '-qam', 'B');
  const b = g('rev-parse', 'HEAD');
  g('checkout', '-q', 'trunk'); g('merge', '-q', '--no-ff', '-m', 'M', 'branch');
  const m = g('rev-parse', 'HEAD');
  const tree = g('rev-parse', 'HEAD^{tree}');
  assert.equal(tree, g('rev-parse', `${b}^{tree}`), 'fixture: merge of a rebased branch keeps the branch tree');
  const receipt = (index: number, status: number, forTree = tree) => JSON.stringify({ index, status, tree: forTree, sha: b });
  const dir = mkdtempSync(join(tmpdir(), 'ci-trust-'));
  const fake = join(dir, 'gh');
  // Fake gh: run 7 (still `queued` at run level, jobs already concluding) is recorded against branch head B, run 9
  // (completed) against trunk T0.
  // Receipts: run 7 has 1 (ok), 2 (exit 3), 4 (ok); 3 is still running with no receipt. Run 9 has 3 ok but for T0's tree.
  writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "run list")
    for i in "$@"; do case "$prev" in --commit) commit="$i";; esac; prev="$i"; done
    if [ "$commit" = "${b}" ]; then echo '[{"databaseId":7,"headSha":"${b}","url":"https://x/runs/7","status":"queued"}]'
    elif [ "$commit" = "${t0}" ]; then echo '[{"databaseId":9,"headSha":"${t0}","url":"https://x/runs/9","status":"completed"}]'
    else echo '[]'; fi;;
  "run view")
    if [ "$3" = "7" ]; then echo '[{"name":"check 1 (a)","conclusion":"success"},{"name":"check 2 (b)","conclusion":"failure"},{"name":"check 3 (c)","conclusion":null},{"name":"check 4 (d)","conclusion":"success"},{"name":"plan","conclusion":"success"}]'
    elif [ -n "$NO_CHECK_JOBS" ]; then echo '[{"name":"plan","conclusion":null},{"name":"check","conclusion":null}]'
    else echo '[{"name":"check 3 (c)","conclusion":"success"}]'; fi;;
  "run download")
    for i in "$@"; do case "$prev" in --dir) dir="$i";; esac; prev="$i"; done
    if [ "$3" = "7" ]; then
      mkdir -p "$dir/release-check-1-receipt" "$dir/release-check-2-receipt" "$dir/release-check-4-receipt"
      printf '%s' '${receipt(1, 0)}' > "$dir/release-check-1-receipt/release-check-1.json"
      printf '%s' '${receipt(2, 3)}' > "$dir/release-check-2-receipt/release-check-2.json"
      printf '%s' '${receipt(4, 0)}' > "$dir/release-check-4-receipt/release-check-4.json"
    else
      mkdir -p "$dir/release-check-3-receipt"; printf '%s' '${receipt(3, 0, 'f'.repeat(40))}' > "$dir/release-check-3-receipt/release-check-3.json"
    fi;;
  *) exit 1;;
esac
`);
  execFileSync('chmod', ['+x', fake]);
  const resolver = join(process.cwd(), 'scripts', 'ci-trusted-checks.mjs');
  const call = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [resolver, ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, CI_TRUST_GH: fake, ...env } });
  let r = call([m]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '1,4', 'merge commit M: queued branch run vouches for 1 and 4 (green + receipt 0 + same tree); 2 failed; 3 unfinished: ' + r.stderr);
  assert.match(r.stderr, /trusting 2 check\(s\) \[1,4\] for tree/);
  assert.match(r.stderr, /running locally: \[2:failure\/receipt-status=3 3:unfinished\/no-receipt\]/);
  r = call([t0]);
  assert.equal(r.stdout, '', 'T0 has a green job 3 but its receipt is for another tree -> nothing trusted');
  assert.match(r.stderr, /3:other-tree/);
  r = call([t0], { NO_CHECK_JOBS: '1' });
  assert.equal(r.stdout, '', 'run found but its matrix has not started -> nothing trusted');
  assert.match(r.stderr, /running locally: \[all: no check jobs in the run\(s\) yet\]/);
  r = call([b]);
  assert.equal(r.stdout, '1,4', 'deploying the branch head itself uses the same run');
  r = call([m], { RELEASE_CHECKS_TRUST_CI: '0' });
  assert.equal(r.stdout, '', 'kill switch');
  r = call(['abc']);
  assert.equal(r.stdout, '', 'short sha rejected');
  r = spawnSync(process.execPath, [resolver, m], { cwd: repo, encoding: 'utf8', env: { ...process.env, CI_TRUST_GH: '/nonexistent/gh' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'gh failure -> nothing trusted, exit 0');
});

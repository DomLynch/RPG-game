// Runner behaviour for scripts/release-checks.mjs against a throwaway repo with synthetic checks: independent checks run
// concurrently, fixed-port (`strictPort`) scripts run alone, one retry absorbs a flake, a hard failure exits non-zero, and
// the receipt is written only on success. No browser, no GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A checkout without .git (the VPS work copies) cannot resolve HEAD: tests that need it skip there and stay strict in CI and on the Mac.
const noGit = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { stdio: 'ignore' }).status !== 0 && 'no git history in this checkout (HEAD is unreadable)';
const runner = join(process.cwd(), 'scripts', 'release-checks.mjs');
// The knobs a real deploy exports (deploy.sh: RELEASE_CHECKS_TRUST_CI=0 for the whole run, RELEASE_CHECKS_SKIP*) must not reach the
// children here: run G c97ce967 (2026-09-28) failed two ci-trusted-checks tests inside test:all with "disabled by RELEASE_CHECKS_TRUST_CI=0".
// Scrubbed from the env each child gets (tests/deploy-trust.test.ts does the same for DEPLOY_TRUST_*), never from process.env itself.
// DEPLOY_* too: deploy.sh exports DEPLOY_TRUST_ROWS / DEPLOY_FAST_GATE for a ci-trust-run and then runs this file as its unit gate, and
// an inherited DEPLOY_TRUST_ROWS made release-checks.mjs skip the full-run stamp the test below expects (Lead 2026-10-07, Deploy's 00:10 abort).
// Read at each spawn, not at load, so a test can set the variable on process.env and prove it never reaches the child.
const clean = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('RELEASE_CHECKS_') && !k.startsWith('DEPLOY_')));

function repo(commands: string[][]) {
  const root = mkdtempSync(join(tmpdir(), 'release-checks-'));
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(join(root, 'a'), 'a');
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
  mkdirSync(join(root, 'scripts'));
  // a script that sleeps, and one that also declares a fixed port
  // Each mock logs its own start/end so a test can prove overlap (or its absence) directly, independent of machine load.
  const log = (tag: string) => `import { appendFileSync } from 'node:fs'; const ms = Number(process.argv[2]), t0 = Date.now(); setTimeout(() => { appendFileSync('spans.log', \`${tag} \${t0} \${Date.now()}\\n\`); process.exit(Number(process.argv[3] || 0)); }, ms);\n`;
  writeFileSync(join(root, 'scripts', 'sleep.mjs'), log('sleep'));
  writeFileSync(join(root, 'scripts', 'fixed.mjs'), '// strictPort: true\n' + log('fixed'));
  // A barrier: each copy registers, then waits (>= 300 ms) until argv[2] copies have registered, so overlap is a fact of the
  // runner, not of wall time. A serial runner leaves the first copy alone until its 20 s cap: overlap 1, red, never green.
  writeFileSync(join(root, 'scripts', 'barrier.mjs'), `import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'; const need = Number(process.argv[2]), t0 = Date.now(); mkdirSync('arrived', { recursive: true }); writeFileSync('arrived/' + process.pid, ''); const tick = () => { const now = Date.now(); if ((readdirSync('arrived').length >= need && now - t0 >= 300) || now - t0 > 20000) { appendFileSync('spans.log', \`barrier \${t0} \${Date.now()}\\n\`); process.exit(0); } setTimeout(tick, 20); }; tick();\n`);
  writeFileSync(join(root, '.quality-gate.json'), JSON.stringify({ commands: [['true']], release_commands: commands }));
  return root;
}
// What the mocks logged: for every check, how many checks (itself included) were alive at some instant of its span.
const spans = (root: string) => readFileSync(join(root, 'spans.log'), 'utf8').trim().split('\n').map(l => { const [tag, a, b] = l.split(' '); return { tag, a: Number(a), b: Number(b) }; });
const alive = (root: string) => { const all = spans(root); return all.map(s => ({ tag: s.tag, n: all.filter(o => o.a < s.b && s.a < o.b).length })); };
const maxOverlap = (root: string) => Math.max(...alive(root).map(s => s.n));

const run = (root: string, env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [runner, root], { encoding: 'utf8', env: { ...clean(), ...env } });

test('independent checks run concurrently; fixed-port checks run alone; receipt written', () => {
  const root = repo([
    ...Array.from({ length: 6 }, () => ['node', 'scripts/barrier.mjs', '4']),
    ['node', 'scripts/fixed.mjs', '300'],
    ['node', 'scripts/fixed.mjs', '300'],
  ]);
  const started = Date.now();
  const result = run(root, { RELEASE_CHECK_CONCURRENCY: '6' });
  const wall = (Date.now() - started) / 1000;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  // Concurrency is proved by the mocks' own spans (several alive at once), never by wall time: on a loaded MacBook (load 25–41 with the
  // suite's own files in parallel, 2026-09-21) eight node startups took a still-overlapped run past the old 3.5 s bound and even past
  // the 4.8 s serial sleep floor (5.75 s measured) — wall time says nothing about overlap there.
  assert.ok(maxOverlap(root) >= 4, `checks overlapped: at most ${maxOverlap(root)} alive at once (wall ${wall}s)`);
  // The runner's fixed-port contract is a lock AMONG fixed-port checks (one of them at a time); they may share the pool with independent
  // checks, and on the ubuntu runner they did (CI run 35616787102: a fixed span overlapped one sleep). So: the fixed spans never overlap each other.
  const fixed = spans(root).filter(s => s.tag === 'fixed');
  assert.equal(fixed.length, 2);
  assert.ok(fixed[0].b <= fixed[1].a || fixed[1].b <= fixed[0].a, `fixed-port checks run one at a time: ${JSON.stringify(fixed)}`);
  assert.match(result.stdout, /8 total, 0 trusted from CI, 8 to run, concurrency 6, 2 fixed-port \(one at a time\)/);
  assert.ok(existsSync(join(root, 'artifacts', 'release-checks.json')));
  const written = JSON.parse(readFileSync(join(root, 'artifacts', 'release-checks.json'), 'utf8'));
  assert.equal(written.checks, 8);
  assert.equal(written.checks_detail.length, 8);
  assert.ok(written.checks_detail.every((c: { seconds: number }) => c.seconds > 0.2), 'durations recorded per check');
  assert.ok(existsSync(join(root, 'artifacts', 'release-checks', '01-scripts_barrier.mjs.log')), 'per-check log kept');
});

test('a check that fails is retried once alone; a persistent failure exits non-zero with no receipt', () => {
  const root = repo([['node', 'scripts/sleep.mjs', '10'], ['node', 'scripts/sleep.mjs', '10', '3']]);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Retrying release check 2 alone/);
  assert.match(result.stderr, /Release check 2 output/);
  assert.ok(!existsSync(join(root, 'artifacts', 'release-checks.json')), 'no receipt on failure');
});

test('a retried check that passes keeps its first failure: own log file, tail printed', () => {
  const root = repo([['sh', '-c', 'if [ -f seen ]; then exit 0; fi; touch seen; echo first-attempt-cause; exit 3']]);
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Retrying release check 1 alone/);
  assert.match(result.stdout, /check 1 first attempt \(failed, retry passed\)[\s\S]*first-attempt-cause/);
  const dir = join(root, 'artifacts', 'release-checks');
  const first = readFileSync(join(dir, '01-sh.log'), 'utf8');
  assert.match(first, /first-attempt-cause/, 'the retry did not overwrite the first attempt');
  assert.ok(existsSync(join(dir, '01-sh.retry.log')), 'the retry has its own log');
});

// "Killed, not waited out" is asserted by ORDER, not by a clock (same fix as tests/deploy-ceiling.test.ts, #628). At load 200+ node
// startup alone ran past the 2 s ceiling, so the old honest `node scripts/sleep.mjs 10` was itself killed and the wedge's pid file was
// never written. Now nothing here starts node: the honest check is `true`, and the wedge is an `sh` whose forked subshell (the
// grandchild, like jpegtran under a check's node) sleeps 30 s, then writes a marker. That subshell holds the check's stdout pipe, and
// the runner resolves a check on 'close', so the run cannot return before the grandchild dies or writes. Marker absent on return = the
// group was killed. A kill that reached only the direct child makes this test slow (30 s) and red, never green.
test('a check that never exits is killed at the ceiling, process group included, and counts as a failure', () => {
  const root = repo([['sh', '-c', '(sleep 30; touch wedge.finished); exit'], ['true']]);
  const result = run(root, { RELEASE_CHECK_CEILING_S: '2' });
  assert.notEqual(result.status, 0, 'the wedged check fails the run: ' + result.stdout);
  assert.match(result.stdout, /check 1\/2 CEILING 2s — killing the process group/);
  assert.match(result.stdout, /check 2\/2 passed/, 'the honest check still passes');
  assert.ok(!existsSync(join(root, 'wedge.finished')), 'the grandchild died with the group, not waited out');
  assert.match(result.stdout, /Not retrying release check 1: it hit the 2s ceiling/);
  assert.doesNotMatch(result.stdout, /Retrying release check 1 alone/, 'a row killed at the ceiling is not retried (it would hang again)');
});

test('RELEASE_CHECK_CONCURRENCY=1 is the old serial behaviour', () => {
  const root = repo([['node', 'scripts/sleep.mjs', '400'], ['node', 'scripts/sleep.mjs', '400']]);
  const started = Date.now();
  const result = run(root, { RELEASE_CHECK_CONCURRENCY: '1' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok((Date.now() - started) / 1000 >= 0.8, 'serial: sum of durations');
  assert.equal(maxOverlap(root), 1, 'serial: never two checks alive at once');
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
  const call = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [resolver, ...args], { cwd: repo, encoding: 'utf8', env: { ...clean(), CI_TRUST_GH: fake, ...env } });
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
  r = spawnSync(process.execPath, [resolver, m], { cwd: repo, encoding: 'utf8', env: { ...clean(), CI_TRUST_GH: '/nonexistent/gh' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'gh failure -> nothing trusted, exit 0');
});

test('ci-trusted-checks trusts a PR-head receipt across a merge only when trunk moved by docs/tests alone', () => {
  // Lead's ruling 2026-09-24 (a'): branch B was checked by CI on its own tree; trunk moved under it before the merge.
  // Docs / *.md / tests outside fixtures on the other side -> the receipt still vouches; any other file -> run locally.
  const repo = mkdtempSync(join(tmpdir(), 'ci-trust-delta-'));
  const g = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  const put = (file: string, text: string) => { mkdirSync(join(repo, file, '..'), { recursive: true }); writeFileSync(join(repo, file), text); };
  g('init', '-q', '-b', 'trunk'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  put('src/a.ts', '1\n'); g('add', '.'); g('commit', '-qm', 'T0');
  g('checkout', '-qb', 'branch'); put('src/a.ts', '2\n'); g('commit', '-qam', 'B');
  const b = g('rev-parse', 'HEAD');
  const bTree = g('rev-parse', 'HEAD^{tree}');
  const mergeAfter = (label: string, files: string[]) => {
    g('checkout', '-q', '-B', `trunk-${label}`, `${b}~1`);
    for (const file of files) put(file, `${label}\n`);
    g('add', '.'); g('commit', '-qm', `trunk moves: ${label}`);
    g('merge', '-q', '--no-ff', '-m', `M ${label}`, 'branch');
    return g('rev-parse', 'HEAD');
  };
  const docsOnly = mergeAfter('docs', ['docs/state/deploy.md', 'README.md', 'tests/other.test.ts']);
  const code = mergeAfter('code', ['docs/note.md', 'src/b.ts']);
  const fixture = mergeAfter('fixture', ['tests/fixtures/record.json']);
  const dir = mkdtempSync(join(tmpdir(), 'ci-trust-delta-gh-'));
  const fake = join(dir, 'gh');
  writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "run list")
    for i in "$@"; do case "$prev" in --commit) commit="$i";; esac; prev="$i"; done
    if [ "$commit" = "${b}" ]; then echo '[{"databaseId":7,"headSha":"${b}","url":"https://x/runs/7","status":"completed"}]'; else echo '[]'; fi;;
  "run view") echo '[{"name":"check 23 (finisher-preview)","conclusion":"success"}]';;
  "run download")
    for i in "$@"; do case "$prev" in --dir) dir="$i";; esac; prev="$i"; done
    mkdir -p "$dir/release-check-23-receipt"
    printf '%s' '${JSON.stringify({ index: 23, status: 0, tree: bTree, sha: b })}' > "$dir/release-check-23-receipt/release-check-23.json";;
  *) exit 1;;
esac
`);
  execFileSync('chmod', ['+x', fake]);
  const resolver = join(process.cwd(), 'scripts', 'ci-trusted-checks.mjs');
  const call = (sha: string) => spawnSync(process.execPath, [resolver, sha], { cwd: repo, encoding: 'utf8', env: { ...clean(), CI_TRUST_GH: fake } });
  let r = call(docsOnly);
  assert.equal(r.stdout, '23', 'trunk moved by docs, *.md and a non-fixture test only -> the branch receipt vouches: ' + r.stderr);
  assert.match(r.stderr, /\(23:docs\/tests-only delta\)/);
  r = call(code);
  assert.equal(r.stdout, '', 'trunk moved by a src file -> run locally: ' + r.stderr);
  assert.match(r.stderr, /23:other-tree\(1 code file\(s\), e\.g\. src\/b\.ts\)/);
  r = call(fixture);
  assert.equal(r.stdout, '', 'tests/fixtures feed the replay rows -> run locally: ' + r.stderr);
  assert.match(r.stderr, /23:other-tree\(1 code file\(s\), e\.g\. tests\/fixtures\/record\.json\)/);
  r = call(b);
  assert.equal(r.stdout, '23', 'the branch head itself: same tree');
  assert.match(r.stderr, /\(23:same-tree\)/);
});

test('release_triggers: a new row joins the rules its paths already hit, never a new first rule that steals them (first match wins)', () => {
  // #865 put a double-tap rule FIRST for src/main.ts, src/input.ts, src/style.css and index.html, so each of them triggered row 43 alone
  // and lost its earlier rows on every PR. Each file keeps its earlier rows plus double-tap-browser-check.
  const rowsFor = (file: string) => (JSON.parse(execFileSync('node', ['scripts/release-rows-for.mjs', '--json', file], { encoding: 'utf8' })) as { name: string }[]).map((r) => r.name).sort();
  const boot = ['roster-browser-check', 'record-replay-check', 'kill-link-check', 'finisher-preview', 'account-database-check', 'account-browser-check'];
  const page = [...boot, 'loot-smoke-check', 'worn-loot-check', 'profile-figure-check', 'difficulty-persist-check', 'sparring-browser-check'];
  for (const [file, before] of [['src/main.ts', page], ['index.html', page], ['src/input.ts', boot], ['src/style.css', [...boot, 'viewport-check', 'profile-figure-check']]] as const)
    assert.deepEqual(rowsFor(file), [...before, 'double-tap-browser-check', 'clip-send-tour-check', 'pit-exit-check', ...(file === 'src/input.ts' ? [] : ['desktop-intro-check']), ...(file === 'src/main.ts' || file === 'index.html' ? ['first-loss-browser-check'] : [])].sort(), file);   // re-pinned 2026-10-06: the first-loss row (51) joined the page rule main.ts and index.html hit, so a change to the page runs a fresh visitor's first minute
  assert.deepEqual(rowsFor('scripts/double-tap-browser-check.mjs'), ['double-tap-browser-check']);
  assert.deepEqual(rowsFor('scripts/desktop-intro-check.mjs'), ['desktop-intro-check']);
  assert.deepEqual(rowsFor('scripts/arena-audio-check.mjs'), ['arena-audio-check']);
  // The CLIP SEND row (2026-09-27) joined the same rules (main.ts's, style.css's and src/** for src/clip.ts), plus its own rule last.
  assert.deepEqual(rowsFor('src/clip.ts'), [...boot, 'double-tap-browser-check', 'clip-send-tour-check', 'pit-exit-check'].sort());
  assert.deepEqual(rowsFor('scripts/clip-send-tour-check.mjs'), ['clip-send-tour-check']);
  // The PIT EXIT row (2026-09-30, no black frame across the next-rung reload) joined the same three rules (main.ts + index.html's,
  // style.css's and src/** for src/gate-light.ts), plus its own rule last.
  assert.deepEqual(rowsFor('src/gate-light.ts'), [...boot, 'double-tap-browser-check', 'clip-send-tour-check', 'pit-exit-check'].sort());
  assert.deepEqual(rowsFor('scripts/pit-exit-check.mjs'), ['pit-exit-check']);
  // The FIRST LOSS row (2026-10-06, Lead): a brand-new visitor's first minute. It joined the page rule (main.ts, index.html) and has a rule ahead of src/**
  // for src/lessons*.ts and src/first-loss*.ts that carries src/**'s rows too (so it never steals them); its own script runs only itself.
  assert.deepEqual(rowsFor('scripts/first-loss-browser-check.mjs'), ['first-loss-browser-check']);
  for (const file of ['src/lessons.ts', 'src/first-loss.ts']) assert.deepEqual(rowsFor(file), [...boot, 'double-tap-browser-check', 'clip-send-tour-check', 'pit-exit-check', 'first-loss-browser-check'].sort(), file);
  assert.ok(!rowsFor('src/hud.ts').includes('first-loss-browser-check'), 'other src files do not run the first-loss row');
});

test('ci-trusted-checks finds a run by TREE on a branch trunk never contains; a differing tree is never looked at', () => {
  // Lead's ask 2026-09-30 (run AX): Deploy's combined-dispatch branch carried trunk's exact tree with 10 rows green, but its
  // commit is not in trunk, so a by-commit lookup missed it. Fixture: trunk T0; `combined` = empty commit on T0 (same tree,
  // not an ancestor of trunk); `other` = a src change (different tree). Runs 11/12 have local heads; 13/14 have heads only
  // the API knows (unfetched), answered by `gh api`.
  const repo = mkdtempSync(join(tmpdir(), 'ci-trust-tree-'));
  const g = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  const put = (file: string, text: string) => { mkdirSync(join(repo, file, '..'), { recursive: true }); writeFileSync(join(repo, file), text); };
  g('init', '-q', '-b', 'trunk'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  put('src/a.ts', '1\n'); g('add', '.'); g('commit', '-qm', 'T0');
  const t0 = g('rev-parse', 'HEAD'), tree = g('rev-parse', 'HEAD^{tree}');
  g('checkout', '-qb', 'combined'); g('commit', '-q', '--allow-empty', '-m', 'combined dispatch');
  const combined = g('rev-parse', 'HEAD');
  assert.equal(g('rev-parse', 'HEAD^{tree}'), tree, 'fixture: same tree');
  assert.throws(() => g('merge-base', '--is-ancestor', combined, t0), 'fixture: trunk never contains the combined commit');
  g('checkout', '-qb', 'other', t0); put('src/a.ts', '2\n'); g('commit', '-qam', 'other');
  const other = g('rev-parse', 'HEAD'), otherTree = g('rev-parse', 'HEAD^{tree}');
  g('checkout', '-q', 'trunk');
  const apiSame = 'e'.repeat(40), apiOther = 'd'.repeat(40);
  const receipt = (index: number, forTree: string) => JSON.stringify({ index, status: 0, tree: forTree, sha: 'x' });
  const dir = mkdtempSync(join(tmpdir(), 'ci-trust-tree-gh-'));
  const fake = join(dir, 'gh');
  writeFileSync(fake, `#!/bin/bash
case "$1 $2" in
  "run list")
    for i in "$@"; do case "$prev" in --commit) commit="$i";; esac; prev="$i"; done
    if [ -n "$commit" ]; then echo '[]'
    else echo '[{"databaseId":11,"headSha":"${combined}","url":"https://x/runs/11","status":"completed"},{"databaseId":12,"headSha":"${other}","url":"https://x/runs/12","status":"completed"},{"databaseId":13,"headSha":"${apiSame}","url":"https://x/runs/13","status":"completed"},{"databaseId":14,"headSha":"${apiOther}","url":"https://x/runs/14","status":"completed"}]'; fi;;
  "api "*)
    case "$2" in *${apiSame}) echo '${tree}';; *${apiOther}) echo '${otherTree}';; *) exit 1;; esac;;
  "run view")
    case "$3" in
      11) echo '[{"name":"check 5 (a)","conclusion":"success"},{"name":"check 8 (b)","conclusion":"failure"}]';;
      13) echo '[{"name":"check 7 (c)","conclusion":"success"}]';;
      *) echo '[{"name":"check 6 (z)","conclusion":"success"}]';;
    esac;;
  "run download")
    for i in "$@"; do case "$prev" in --dir) dir="$i";; esac; prev="$i"; done
    case "$3" in
      11) mkdir -p "$dir/release-check-5-receipt" "$dir/release-check-8-receipt"; printf '%s' '${receipt(5, tree)}' > "$dir/release-check-5-receipt/release-check-5.json"; printf '%s' '${receipt(8, tree)}' > "$dir/release-check-8-receipt/release-check-8.json";;
      13) mkdir -p "$dir/release-check-7-receipt"; printf '%s' '${receipt(7, tree)}' > "$dir/release-check-7-receipt/release-check-7.json";;
      *) mkdir -p "$dir/release-check-6-receipt"; printf '%s' '${receipt(6, otherTree)}' > "$dir/release-check-6-receipt/release-check-6.json";;
    esac;;
  *) exit 1;;
esac
`);
  execFileSync('chmod', ['+x', fake]);
  const resolver = join(process.cwd(), 'scripts', 'ci-trusted-checks.mjs');
  const call = (sha: string) => spawnSync(process.execPath, [resolver, sha], { cwd: repo, encoding: 'utf8', env: { ...clean(), CI_TRUST_GH: fake } });
  let r = call(t0);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '5,7', 'identical tree on a branch trunk never contains (local head 11, API-only head 13) -> trusted; 8 failed: ' + r.stderr);
  assert.match(r.stderr, /https:\/\/x\/runs\/11 https:\/\/x\/runs\/13: trusting 2 check\(s\) \[5,7\]/);
  assert.match(r.stderr, /running locally: \[8:failure\]/, 'a red job on the same tree stays local, never partial');
  assert.doesNotMatch(r.stderr, /runs\/12|runs\/14|6:/, 'runs on a differing tree are never looked at');
  r = call(other);
  assert.equal(r.stdout, '6', 'deploying `other` itself: its own tree matches run 12 by tree: ' + r.stderr);
  assert.doesNotMatch(r.stderr, /runs\/11|runs\/13/);
});

// Every row the gate has (the stance-panel row made it 52, appended at the end so the numbered rows keep their numbers): 'all rows' is read, never a literal.
const ROWS: number = JSON.parse(readFileSync(new URL('../.quality-gate.json', import.meta.url), 'utf8')).release_commands.length;
test('deploy scope: a release runs about 5 rows for what it changed, none for docs, and a changed check script runs its own rows', () => {
  // Dom 2026-10-05: "get the 50 checks down to 5"; the full 50 still run once every 24 h (deploy.sh --full-age).
  const pick = (...files: string[]) => execFileSync('node', ['scripts/release-rows-for.mjs', '--deploy-skip'], { input: files.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const kept = (...files: string[]) => { const skip = new Set(pick(...files).trim().split(',').filter(Boolean).map(Number)); return ROWS - skip.size; };
  assert.equal(kept('src/main.ts'), 7, 'any code change: the five core rows plus the first-loss row and the Stage picker row (main.ts is in both triggers)');
  assert.equal(kept('src/main.ts', 'src/pit/skulls.ts'), 8, 'the Pit adds pit-exit-check');
  assert.equal(kept('src/ai.ts'), 7, 'combat adds the browser replay (chromium) and kill-link rows');
  assert.equal(kept('docs/state/lead.md'), 0, 'docs only: no rows');
  assert.equal(kept('scripts/polearm-browser-check.mjs'), 9, 'a changed check script runs all of its rows');
  for (const file of ['package-lock.json', 'package.json', 'vite.config.mjs', 'tsconfig.json', '.quality-gate.json', 'scripts/lib/harness-clock.mjs'])
    assert.equal(kept('src/main.ts', file), ROWS, `${file} changes the build or the gate (with no base to compare): every row (Auditor B1 on #1381)`);
  assert.equal(kept('src/lessons.ts'), 6, 'the first-loss row joins the core five for the lesson files');
  assert.equal(kept('src/first-loss.ts'), 6);
  assert.equal(kept('scripts/first-loss-browser-check.mjs'), 6, 'a changed check script runs its own row');
  assert.equal(kept('src/hud.ts'), 7, 'files outside its trigger do not run it');
  assert.equal(kept('src/audio/mix.ts'), 7, 'audio adds its two rows');
  assert.equal(kept('src/hud.ts'), 7, 'the HUD adds endgame-hud and one desktop layout row');
});

test('deploy scope: the fight-boot files (first frame, scene warm-up) pick the two rows that boot to a fight', () => {
  // a2cf3529 (2026-10-06): #1420 fixed row 51 in src/first-frame.ts + src/scene.ts, yet the picker left 50 and 51 out of scope.
  const picked = (...files: string[]) => spawnSync('node', ['scripts/release-rows-for.mjs', '--deploy-skip'], { input: files.join('\n'), encoding: 'utf8' }).stderr;
  for (const file of ['src/first-frame.ts', 'src/scene.ts']) {
    assert.match(picked(file), /\b50 pit-exit-check\b/, `${file} runs row 50 pit-exit-check`);
    assert.match(picked(file), /\b51 first-loss-browser-check\b/, `${file} runs row 51 first-loss-browser-check`);
  }
  assert.match(picked('src/scene.ts'), /\barena-preview\b/, 'scene.ts keeps its arena row');
});

test('deploy scope: a public asset runs the rows of its folder, never all 51; the Stage picker row follows the arena, sparring and main files', () => {
  // Lead 2026-10-06: every arena or versus .webp ran all 51 rows (15-21 min), and row 44 had no mapping, so 17ab81e9 skipped it.
  const pick = (...files: string[]) => spawnSync('node', ['scripts/release-rows-for.mjs', '--deploy-skip'], { input: files.join('\n'), encoding: 'utf8' });
  const kept = (...files: string[]) => ROWS - new Set(pick(...files).stdout.trim().split(',').filter(Boolean)).size;
  const picked = (...files: string[]) => pick(...files).stderr;
  assert.equal(kept('public/versus/goblin.webp'), 5, 'a versus card: the core five only');
  assert.equal(kept('public/licenses/OFL.txt'), 5, 'a licence file: the core five only');
  assert.ok(kept('public/arena/3/floor.webp') < ROWS, 'an arena texture is not a full run');
  assert.match(picked('public/arena/3/floor.webp'), /\b8 arena-preview\b/, 'an arena texture runs the arena preview');
  assert.match(picked('public/arena/3/floor.webp'), /\b44 sparring-browser-check\b/, 'and the Stage picker row');
  assert.match(picked('public/pit/gate.glb'), /\b50 pit-exit-check\b/, 'a Pit asset runs the Pit exit row');
  assert.equal(kept('public/pit/gate.glb'), 6);
  assert.equal(kept('public/weapons/estoc.glb'), ROWS, 'any other public folder (GLBs many rows load) still runs every row');
  for (const file of ['src/arena-themes.ts', 'src/arena.ts', 'src/sparring.ts', 'src/stage-hide.ts', 'src/main.ts'])
    assert.match(picked(file), /\b44 sparring-browser-check\b/, `${file} runs row 44, the Stage picker`);
  assert.doesNotMatch(picked('src/hud.ts'), /\b44 sparring-browser-check\b/, 'a file outside the arena does not');
});

test('deploy scope: a changed .quality-gate.json runs only the rows it adds or changes against the live revision (--base), every row without one', async () => {
  // Lead 2026-10-06: a row-list edit ran all 51 rows. The row diff is fed in directly (deployRowsFor's second argument), so the test
  // does not depend on the runner's git history: CI's shallow clone cannot `git show` an old trunk revision, and every row is then right.
  const pick = (base: string | null, ...files: string[]) => spawnSync('node', ['scripts/release-rows-for.mjs', '--deploy-skip', ...(base ? ['--base', base] : [])], { input: files.join('\n'), encoding: 'utf8' });
  const kept = (r: ReturnType<typeof pick>) => ROWS - new Set(r.stdout.trim().split(',').filter(Boolean)).size;
  assert.equal(kept(pick(null, '.quality-gate.json')), ROWS, 'no base: every row');
  assert.equal(kept(pick('0000000000000000000000000000000000000000', '.quality-gate.json')), ROWS, 'an unreadable base: every row');
  const { deployRowsFor, rows } = await import('../scripts/release-rows-for.mjs');
  const live: string[][] = rows.map((r: { argv: string }) => JSON.parse(r.argv) as string[]);
  const names = (picked: { index: number; name: string }[]) => picked.map(r => `${r.index} ${r.name}`);
  assert.equal(deployRowsFor(['.quality-gate.json'], live).length, 5, 'identical lists: the core five only');
  const added = names(deployRowsFor(['.quality-gate.json'], live.filter((_, i) => i !== 50)));
  assert.ok(added.includes('51 first-loss-browser-check'), `a row the live gate lacks runs: ${added}`);
  assert.ok(!added.includes('44 sparring-browser-check') && added.length === 6, `rows unchanged since the base do not: ${added}`);
  const edited = live.map((command, i) => (i === 43 ? [...command, '--changed'] : command));
  assert.ok(names(deployRowsFor(['.quality-gate.json'], edited)).includes('44 sparring-browser-check'), 'a row whose argv changed runs');
  assert.equal(deployRowsFor(['.quality-gate.json'], undefined).length, ROWS, 'no previous list: every row');
});

test('deploy scope: a --base of HEAD (the same row list) runs the core five only', { skip: noGit }, () => {
  const r = spawnSync('node', ['scripts/release-rows-for.mjs', '--deploy-skip', '--base', 'HEAD'], { input: '.quality-gate.json', encoding: 'utf8' });
  assert.equal(ROWS - new Set(r.stdout.trim().split(',').filter(Boolean)).size, 5, 'the same row list as the base: the core five only');
});

test('the unit gate ignores the deploy shell\'s own DEPLOY_* exports: a ci-trust-run still stamps a run of every row', () => {
  // Regression (Lead 2026-10-07): with DEPLOY_TRUST_ROWS inherited from deploy.sh, release-checks.mjs:159 skipped artifacts/last-full-release.json
  // and the stamp test below failed ENOENT before any row ran. The child env is built from process.env minus DEPLOY_*, so these never reach it.
  process.env.DEPLOY_TRUST_ROWS = '47'; process.env.DEPLOY_TRUST_REASON = 'test'; process.env.DEPLOY_FAST_GATE = '1';
  try {
    const root = repo([['node', 'scripts/sleep.mjs', '10']]);
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(existsSync(join(root, 'artifacts', 'last-full-release.json')), 'every row ran: the full-run stamp is written although the parent exported DEPLOY_TRUST_ROWS');
  } finally { delete process.env.DEPLOY_TRUST_ROWS; delete process.env.DEPLOY_TRUST_REASON; delete process.env.DEPLOY_FAST_GATE; }
});

test('deploy scope: a run of every row writes the full-run stamp even behind the fast unit gate; a scoped run never does', () => {
  // Lead 2026-10-06: deploy.sh exports DEPLOY_FAST_GATE on every scoped release, so a 51/51 run was never stamped and the daily full stayed due.
  const root = repo([['node', 'scripts/sleep.mjs', '10'], ['node', 'scripts/sleep.mjs', '10']]);
  let result = run(root, { DEPLOY_FAST_GATE: '1', RELEASE_CHECKS_OUT_OF_SCOPE: '2' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(!existsSync(join(root, 'artifacts', 'last-full-release.json')), 'a row out of scope: not a full run');
  result = run(root, { DEPLOY_FAST_GATE: '1' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const stamp = JSON.parse(readFileSync(join(root, 'artifacts', 'last-full-release.json'), 'utf8'));
  assert.equal(stamp.fast_gate, true, 'every row ran: stamped full, and the stamp says the fast unit gate was on');
  assert.ok(Date.now() - Date.parse(stamp.at) < 60_000);
});

test('deploy scope: the last full run is read from the stamp, else from a receipt with every row run, else unknown (-1)', () => {
  const root = mkdtempSync(join(tmpdir(), 'full-age-'));
  const age = () => Number(execFileSync('node', [join(process.cwd(), 'scripts/release-rows-for.mjs'), '--full-age', root], { encoding: 'utf8' }));
  assert.equal(age(), -1);
  mkdirSync(join(root, 'artifacts'));
  writeFileSync(join(root, 'artifacts/release-checks.json'), JSON.stringify({ passed: true, checks: 2, checks_detail: [{ index: 1 }, { index: 2, trusted: 'scope' }] }));
  assert.equal(age(), -1, 'a scoped receipt is not a full run');
  writeFileSync(join(root, 'artifacts/release-checks.json'), JSON.stringify({ passed: true, checks: 2, checks_detail: [{ index: 1 }, { index: 2, out_of_scope: true }] }));
  assert.equal(age(), -1, 'nor is one with an out-of-scope row');
  writeFileSync(join(root, 'artifacts/release-checks.json'), JSON.stringify({ passed: true, checks: 2, checks_detail: [{ index: 1 }, { index: 2 }] }));
  assert.ok(age() >= 0 && age() < 60, 'a full receipt counts by its mtime');
  writeFileSync(join(root, 'artifacts/last-full-release.json'), JSON.stringify({ at: new Date(Date.now() - 90_000_000).toISOString() }));
  assert.ok(age() > 86_400, 'the stamp wins: over 24 h means the next release runs all 50');
  writeFileSync(join(root, 'artifacts/last-full-release.json'), JSON.stringify({ at: 'not a date' }));
  assert.equal(age(), -1, 'a bad stamp date is unknown, so the release runs all 50 (Auditor S2)');
});

// The release train (scripts/release-train.mjs cutter + scripts/release-train-publish.sh publisher, Lead 2026-10-12): the plan's order and stacking,
// a conflict skipped without blocking the rest, the push retry, the publisher's pick, its no-double-publish lock and its stop on failure.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { mergeAll, passAt, pushWithRetry } from '../scripts/cut-release.mjs';
import { browserRowsMissing, checksGreen, missingRows, pickPublish, planTrain, readOrder, trainName } from '../scripts/release-train.mjs';

const TRUNK = 'codex/01a09a76/task-1';
const OK = [
  { __typename: 'CheckRun', workflowName: 'unit-ci', name: 'receipt', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', workflowName: 'quality', name: 'quality', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', workflowName: 'release-checks', name: 'summary', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', workflowName: 'gpu-checks', name: 'gpu', status: 'COMPLETED', conclusion: 'SKIPPED' },
];
const pr = (number: number, over: Record<string, unknown> = {}) => ({ number, head: `${number}`.padEnd(40, 'a'), headRef: `lane/${number}`, baseRef: TRUNK, labels: ['release:go'], green: true, passedAt: `2026-10-12T10:${String(number % 60).padStart(2, '0')}:00Z`, ...over });

const own = (body: string) => ({ body, authorAssociation: 'OWNER' });
test('readOrder, checksGreen and the train name', () => {
  assert.deepEqual(readOrder('# Lead-owned\n2322\n\n2313  # stacked\nx\n'), [2322, 2313]);
  assert.equal(checksGreen(OK), true);
  assert.equal(checksGreen([...OK, { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' }]), false, 'pending is not green');
  assert.equal(checksGreen([...OK, { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }]), false);
  assert.equal(checksGreen([{ __typename: 'StatusContext', state: 'SUCCESS' }]), true);
  assert.equal(checksGreen([]), false, 'no checks at all is not green');
  assert.equal(trainName(new Date('2026-10-12T17:40:05Z'), '38251416111'), 'T1012174005r38251416111', 'seconds + run id: a label event and a cron tick in one minute get two names');
  assert.notEqual(trainName(new Date('2026-10-12T17:40:05Z'), '1'), trainName(new Date('2026-10-12T17:40:05Z'), '2'));
});

test('checksGreen: a feature head under the new quality.yml needs the browser-rows status SUCCESS; missing or pending is not green; release-* and old heads are exempt (#2359 (d))', () => {
  const REPORTER = { __typename: 'CheckRun', workflowName: 'quality', name: 'browser-rows (status)', status: 'COMPLETED', conclusion: 'SKIPPED' };
  const status = (state: string) => ({ __typename: 'StatusContext', context: 'browser-rows', state });
  const fresh = [...OK, REPORTER];   // the new quality.yml ran on this head: its plan always sets browser-rows on a feature PR
  assert.equal(checksGreen(fresh, 'lane/x'), false, 'a game-diff feature PR whose browser jobs were skipped and that has no browser-rows status is not green');
  assert.equal(browserRowsMissing(fresh, 'lane/x'), true);
  assert.equal(checksGreen([...fresh, status('PENDING')], 'lane/x'), false, 'pending (waiting for auditor:ready) is not green');
  assert.equal(checksGreen([...fresh, status('FAILURE')], 'lane/x'), false);
  assert.equal(checksGreen([...fresh, status('SUCCESS')], 'lane/x'), true);
  assert.equal(checksGreen([...fresh, { ...status('SUCCESS'), context: 'other' }], 'lane/x'), false, 'another context is not browser-rows');
  assert.equal(checksGreen(fresh, 'release-T1012191800r1'), true, 'a release-* candidate gets no status (it always runs the browser jobs)');
  assert.equal(checksGreen(OK, 'lane/x'), true, 'a head the old quality.yml ran on (no reporter check) is not held');
  assert.equal(checksGreen(fresh), false, 'no head ref: the rule applies (fail closed)');
  assert.equal(pickPublish([{ headRefName: 'release-CV', baseRefName: TRUNK, headRefOid: 'c'.repeat(40), labels: ['candidate:pass'], comments: [{ body: `Lead: PASS @${'c'.repeat(9)}`, authorAssociation: 'OWNER' }], statusCheckRollup: fresh, createdAt: 'x' }])?.headRefName, 'release-CV', 'the publish gate passes a candidate');
});

test('checksGreen: per check on the head, the latest attempt that is not SKIPPED decides: a superseded CANCELLED is ignored; a later SKIPPED never hides a red (Lead, #2359)', () => {
  const run = (wf: string, name: string, conclusion: string, startedAt: string, status = 'COMPLETED') => ({ __typename: 'CheckRun', workflowName: wf, name, status, conclusion, startedAt, completedAt: startedAt });
  // #2359's live shape at 8700061b6: wording cancelled by the concurrency group, then green; quality green, then three inert (skipped) runs
  const live = [...OK.filter(c => c.name !== 'quality'), run('pr-wording', 'wording', 'CANCELLED', '2026-10-12T14:40:23Z'), run('pr-wording', 'wording', 'SUCCESS', '2026-10-12T14:44:20Z'),
    run('quality', 'quality', 'SKIPPED', '2026-10-12T14:40:33Z'), run('quality', 'quality', 'SUCCESS', '2026-10-12T14:48:36Z'), run('quality', 'quality', 'SKIPPED', '2026-10-12T15:18:46Z')];
  assert.equal(checksGreen(live), true, 'a superseded CANCELLED with a newer SUCCESS of the same check is ignored');
  assert.equal(checksGreen([...OK, run('pr-wording', 'wording', 'CANCELLED', '2026-10-12T14:40:23Z')]), false, 'a CANCELLED with no newer run stays not green');
  assert.equal(checksGreen([...OK, run('pr-wording', 'wording', 'SUCCESS', '2026-10-12T14:40:23Z'), run('pr-wording', 'wording', 'CANCELLED', '2026-10-12T14:50:00Z')]), false, 'the latest attempt decides: a later cancel is not green');
  assert.equal(checksGreen([...OK, run('x', 'job', 'FAILURE', '2026-10-12T14:00:00Z'), run('x', 'job', 'SKIPPED', '2026-10-12T15:00:00Z')]), false, 'a later skipped (inert) run never hides a red');
  assert.equal(checksGreen([...OK, run('x', 'job', 'SUCCESS', '2026-10-12T14:00:00Z'), run('x', 'job', '', '2026-10-12T15:00:00Z', 'IN_PROGRESS')]), false, 'a newer attempt still running is not green');
  assert.equal(checksGreen([...OK, run('x', 'job', 'FAILURE', '2026-10-12T14:00:00Z'), run('x', 'job', 'SUCCESS', '2026-10-12T15:00:00Z')]), true, 'a re-run that passed decides');
  assert.equal(checksGreen([...OK, run('x', 'job', 'FAILURE', '2026-10-12T14:00:00Z'), run('y', 'job', 'SUCCESS', '2026-10-12T15:00:00Z')]), false, 'another workflow\'s check of the same name does not supersede');
  assert.equal(checksGreen([...OK, run('x', 'job', 'SKIPPED', '2026-10-12T14:00:00Z'), run('x', 'job', 'SKIPPED', '2026-10-12T15:00:00Z')]), true, 'all skipped is green');
});

test('checksGreen: a CANCELLED row no later run reuses (a matrix placeholder, a renamed job) is ignored once its workflow\'s verdict job passed later; FAILURE stays strict (release-DC #2406)', () => {
  const run = (wf: string, name: string, conclusion: string, startedAt: string) => ({ __typename: 'CheckRun', workflowName: wf, name, status: 'COMPLETED', conclusion, startedAt, completedAt: startedAt });
  // #2406's shape: the first unit-ci / release-checks runs were cancelled before their matrices expanded; the re-runs named every row afresh
  const cancelled = [run('unit-ci', 'shard', 'CANCELLED', '2026-10-12T17:57:48Z'), run('unit-ci', 'receipt', 'CANCELLED', '2026-10-12T17:57:48Z'),
    run('release-checks', 'check ${{ matrix.check.index }} (${{ matrix.check.name }})', 'CANCELLED', '2026-10-12T17:57:48Z'),
    run('release-checks', 'release rows (none for this diff)', 'CANCELLED', '2026-10-12T17:57:48Z'), run('release-checks', 'summary', 'CANCELLED', '2026-10-12T17:57:48Z')];
  const later = [run('unit-ci', 'shard (1)', 'SUCCESS', '2026-10-12T18:05:00Z'), run('unit-ci', 'shard (8)', 'SUCCESS', '2026-10-12T18:05:00Z'), run('unit-ci', 'receipt', 'SUCCESS', '2026-10-12T18:20:00Z'),
    run('release-checks', 'check 12 (polearm)', 'SUCCESS', '2026-10-12T18:06:00Z'), run('release-checks', 'release rows', 'SUCCESS', '2026-10-12T18:06:00Z'), run('release-checks', 'summary', 'SUCCESS', '2026-10-12T18:25:00Z')];
  const base = OK.filter(c => c.workflowName !== 'unit-ci' && c.workflowName !== 'release-checks');
  assert.equal(checksGreen([...base, ...cancelled, ...later]), true, 'cancelled placeholders + a later green run of each workflow are green');
  assert.equal(checksGreen([...base, ...cancelled, ...later, run('release-checks', 'check 3 (combat)', 'FAILURE', '2026-10-12T18:06:00Z')]), false, 'a later run with one failure is not green');
  assert.equal(checksGreen([...base, ...cancelled, ...later.filter(c => c.workflowName !== 'unit-ci')]), false, 'no later unit-ci run: its cancelled rows stay red');
  assert.equal(checksGreen([...OK, run('pr-wording', 'wording', 'CANCELLED', '2026-10-12T19:00:00Z')]), false, 'a plain cancelled run with no later run is not green');
  assert.equal(checksGreen([...OK, run('unit-ci', 'shard', 'CANCELLED', '2026-10-12T19:00:00Z')]), false, 'a verdict that passed BEFORE the cancel does not clear it');
  assert.equal(checksGreen([...OK, run('release-checks', 'check ${{ matrix.check.index }} (${{ matrix.check.name }})', 'CANCELLED', '2026-10-12T19:00:00Z')]), true, 'an unexpanded matrix placeholder is never a real row');
  assert.equal(checksGreen([...OK, run('release-checks', 'check ${{ matrix.check.index }} (${{ matrix.check.name }})', 'FAILURE', '2026-10-12T19:00:00Z')]), false, 'a placeholder that FAILED still blocks');
});

test('checksGreen: a run cancelled at the cut before it started is no verdict once a later attempt of that check exists, a skip included (DL #2431 never published)', () => {
  const run = (wf: string, name: string, conclusion: string, startedAt: string, completedAt = startedAt) => ({ __typename: 'CheckRun', workflowName: wf, name, status: 'COMPLETED', conclusion, startedAt, completedAt });
  // DL #2431's live shape: the cut's first run of each workflow CANCELLED in its first second under the unexpanded matrix names, later runs SKIPPED;
  // the real run passed under the expanded names (shard (1..8), check N (row)). It read red forever, so no tick could publish it.
  const dl = [...OK,
    run('unit-ci', 'shard', 'CANCELLED', '2026-10-12T19:13:23Z'), run('unit-ci', 'shard', 'SKIPPED', '2026-10-12T19:13:23Z'), run('unit-ci', 'shard', 'SKIPPED', '2026-10-13T00:29:11Z'),
    run('unit-ci', 'shard (1)', 'SUCCESS', '2026-10-12T19:18:25Z', '2026-10-12T19:21:00Z'),
    run('release-checks', 'release rows (none for this diff)', 'CANCELLED', '2026-10-12T19:13:23Z'), run('release-checks', 'release rows (none for this diff)', 'SKIPPED', '2026-10-13T00:29:10Z'),
    run('release-checks', 'check ${{ matrix.check.index }} (${{ matrix.check.name }})', 'CANCELLED', '2026-10-12T19:13:23Z'), run('release-checks', 'check ${{ matrix.check.index }} (${{ matrix.check.name }})', 'SKIPPED', '2026-10-12T19:13:24Z'),
    run('release-checks', 'check 10 (polearm-browser-check)', 'SUCCESS', '2026-10-12T19:20:00Z', '2026-10-12T19:25:00Z')];
  assert.equal(checksGreen(dl), true, 'a cancel-at-cut followed by later skips no longer pins the candidate red');
  assert.equal(checksGreen([...OK, run('x', 'job', 'CANCELLED', '2026-10-12T14:00:00Z')]), false, 'a cancel with nothing after it still is not green');
  assert.equal(checksGreen([...OK, run('x', 'job', 'CANCELLED', '2026-10-12T14:00:00Z', '2026-10-12T14:10:00Z'), run('x', 'job', 'SKIPPED', '2026-10-12T15:00:00Z')]), false, 'a cancel that RAN (10 min: a timeout) is a verdict: a later skip never hides it');
  assert.equal(checksGreen([...OK, run('x', 'job', 'FAILURE', '2026-10-12T14:00:00Z'), run('x', 'job', 'CANCELLED', '2026-10-12T14:05:00Z'), run('x', 'job', 'SKIPPED', '2026-10-12T15:00:00Z')]), false, 'dropping a never-ran cancel uncovers the red before it, never a green');
});

test('planTrain: release-order.txt first, then oldest PASS; only release:go + PASS at head + green; a PR already in the base is dropped silently', () => {
  const prs = [pr(5, { passedAt: '2026-10-12T09:00:00Z' }), pr(6, { passedAt: '2026-10-12T08:00:00Z' }), pr(7), pr(8, { passedAt: null }), pr(9, { green: false }), pr(10, { labels: [] }), pr(11), pr(12, { headRef: 'release-CO' })];
  const { pick, skipped } = planTrain({ prs, order: [7, 99], inBase: (h: string) => h.startsWith('11') });
  assert.deepEqual(pick.map((p) => p.pr), [7, 6, 5], 'listed 7 first, then 6 (older PASS) before 5');
  assert.deepEqual(skipped.map((s) => s.pr).sort(), [8, 9]);
  assert.match(skipped.find((s) => s.pr === 8)!.why, /no "<reviewer>: PASS @8aaaaaaaa" \(Auditor, Lead, Combat A, Combat B or Deploy B\) at its current head/);
  assert.ok(passAt([own('Lead: PASS @8aaaaaaaa (independent platform review)')], '8'.padEnd(40, 'a')) && passAt([own('Auditor: PASS @8aaaaaaaa')], '8'.padEnd(40, 'a')), 'Lead or the Auditor');
  assert.ok(!passAt([own('Lead: PASS @9aaaaaaaa'), own('Strategy: PASS @8aaaaaaaa')], '8'.padEnd(40, 'a')), 'another head, or another name, is not a PASS');
});

test('planTrain stacking: a stacked PR listed before its base rides right after it; one whose base is not in waits, named', () => {
  const prs = [pr(2318), pr(2319, { baseRef: 'lane/2318' }), pr(2328, { baseRef: 'lane/2322' }), pr(2400, { baseRef: 'lane/2401' })];
  const extra = [pr(2401, { labels: [] }), pr(2322, { labels: [] })];   // open base PRs without release:go: 2401 is not in the base, 2322 already is
  const { pick, skipped } = planTrain({ prs: [...prs, ...extra], order: [2319, 2318, 2328], inBase: (h: string) => h.startsWith('2322') });
  assert.deepEqual(pick.map((p) => p.pr), [2318, 2319, 2328], '2319 waits for 2318; 2328 rides because its base (2322) is already in the candidate');
  assert.deepEqual(skipped, [{ pr: 2400, why: 'stacked on lane/2401, which is not in yet' }]);
});

const mkGit = (cwd: string) => (args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });

test('a conflicting PR is skipped and the train goes on: the plan merged in order on a candidate tip (N+1 on N)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'train-'));
  try {
    const git = mkGit(dir), ok = (a: string[]) => { const r = git(a); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
    ok(['init', '-q', '-b', 'main']); writeFileSync(join(dir, 'a.txt'), 'one\n'); ok(['add', '-A']); ok(['commit', '-q', '-m', 'base']);
    const branch = (name: string, file: string, text: string, from = 'main') => { ok(['switch', '-q', '-c', name, from]); writeFileSync(join(dir, file), text); ok(['add', '-A']); ok(['commit', '-q', '-m', name]); const sha = ok(['rev-parse', 'HEAD']); ok(['switch', '-q', 'main']); return sha; };
    const n = branch('release-N', 'n.txt', 'n\n'), good = branch('good', 'b.txt', 'b\n'), clash = branch('clash', 'n.txt', 'other\n'), late = branch('late', 'c.txt', 'c\n');
    const prs = [pr(1, { head: good }), pr(2, { head: clash }), pr(3, { head: late })];
    const inBase = (h: string) => git(['merge-base', '--is-ancestor', h, n]).status === 0;
    const { pick } = planTrain({ prs, order: [2, 1, 3], inBase });
    ok(['switch', '-q', '-c', 'release-N1', n]);
    const out = mergeAll(git, 'N1', pick);
    assert.deepEqual(out.merged, [1, 3], 'the conflict (2, listed first) never blocked 1 and 3');
    assert.deepEqual(out.skipped.map((s) => s.pr), [2]);
    assert.match(out.skipped[0].why, /conflicts in n\.txt/);
    assert.equal(git(['merge-base', '--is-ancestor', n, 'HEAD']).status, 0, 'N+1 carries N');
    assert.equal(ok(['status', '--porcelain']), '', 'the aborted merge left nothing behind');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pushWithRetry: a transient reject is retried with backoff (2 s, 4 s); three rejects fail with the error', () => {
  const slept: number[] = [];
  let n = 0;
  const flaky = () => (++n < 3 ? { status: 1, stderr: '! [remote rejected] (internal error)' } : { status: 0, stderr: '' });
  assert.deepEqual(pushWithRetry(flaky as Parameters<typeof pushWithRetry>[0], 'release-X', { sleep: (s: number) => slept.push(s) }), { ok: true, tries: 3 });
  assert.deepEqual(slept, [2, 4]);
  const r = pushWithRetry((() => ({ status: 1, stderr: 'remote rejected' })) as Parameters<typeof pushWithRetry>[0], 'release-X', { sleep: () => 0 });
  assert.deepEqual(r, { ok: false, tries: 3, err: 'remote rejected' });
  const src = readFileSync('scripts/cut-release.mjs', 'utf8');
  assert.match(src, /const pushed = pushWithRetry\(git, `release-\$\{name\}`\);/);
  const train = readFileSync('scripts/release-train.mjs', 'utf8');
  assert.match(train, /pushWithRetry\(git, `release-\$\{name\}`, \{ extra: \[`--force-with-lease=refs\/heads\/release-\$\{name\}:`\] \}\)/, 'the cutter only CREATES its branch: a lease on absent');
  assert.match(train, /if \(d\.status !== 0\) throw new Error\(`release-\$\{name\} \(#\$\{pr\}\) opened but dispatching/, 'a failed dispatch fails the cut');
  assert.match(train, /const inFlight = cands\.length \+ notLive\.length;/, 'merged-but-not-live counts as in flight');
  assert.match(src, /const from = `origin\/\$\{base \|\| TRUNK\}`/, 'cut-release --base builds N+1 on N');
});

test('passAt is anchored at a line start: "waiting for Auditor: PASS @…" is not a PASS', () => {
  const h = 'abcdef123'.padEnd(40, '0');
  assert.ok(passAt([own('**Auditor: PASS @abcdef123** (x)')], h) && passAt([own('notes\nLead: PASS @abcdef123')], h));
  assert.ok(!passAt([own('waiting for Auditor: PASS @abcdef123')], h) && !passAt([own('> Auditor: PASS @abcdef123')], h));
});

test('pickPublish (Strategy\'s gate): candidate:pass label AND a PASS comment at the head AND unit-ci/quality/release-checks present and green; oldest first', () => {
  const head = 'f'.repeat(40), pass = [{ body: '**Auditor: PASS @fffffffff** (candidate)', authorAssociation: 'OWNER' }];
  const c = (number: number, createdAt: string, over: Record<string, unknown> = {}) => ({ number, headRefName: `release-T${number}`, baseRefName: TRUNK, headRefOid: head, createdAt, isDraft: true, labels: [{ name: 'candidate:pass' }], comments: pass, statusCheckRollup: OK, ...over });
  const prs = [c(3, '2026-10-12T12:00:00Z'), c(2, '2026-10-12T11:00:00Z'), c(1, '2026-10-12T10:00:00Z', { statusCheckRollup: [...OK, { __typename: 'CheckRun', workflowName: 'quality', name: 'load-time', status: 'QUEUED' }] }), c(4, '2026-10-12T09:00:00Z', { labels: [] }), c(5, '2026-10-12T08:00:00Z', { headRefName: 'lane/x' })];
  assert.equal(pickPublish(prs)?.number, 2);
  assert.equal(pickPublish([c(6, 'a', { comments: [] })]), null, 'the label alone is not a gate');
  assert.equal(pickPublish([c(7, 'a', { comments: [{ body: 'Auditor: PASS @eeeeeeeee', authorAssociation: 'OWNER' }] })]), null, 'a PASS for another head (the label survived a head move) is not a gate');
  assert.equal(pickPublish([c(8, 'a', { labels: [] })]), null, 'the PASS alone is not a gate');
  for (const a of ['NONE', 'CONTRIBUTOR']) assert.equal(pickPublish([c(10, 'a', { comments: [{ body: 'Auditor: PASS @fffffffff', authorAssociation: a }] })]), null, `a PASS from an ${a} outsider (public repo) is not a gate`);
  assert.equal(pickPublish([c(9, 'a', { statusCheckRollup: OK.filter((r) => r.workflowName !== 'unit-ci') })]), null, 'a rollup without unit-ci (failed dispatch) is not green');
  assert.deepEqual(missingRows(OK.slice(1)), ['unit-ci/receipt']);
  assert.equal(pickPublish([]), null);
});

const runEnv = (p: { env: Record<string, string> }) => p.env;

// The publisher with gh, git and the deploy stubbed: nothing here touches GitHub, this checkout or a box.
function publisher() {
  const dir = mkdtempSync(join(tmpdir(), 'pub-')), bin = join(dir, 'bin'), state = join(dir, 'state'), repo = join(dir, 'repo'), log = join(dir, 'calls');
  mkdirSync(bin); mkdirSync(state); mkdirSync(join(repo, 'scripts'), { recursive: true });
  for (const f of ['release-train.mjs', 'cut-release.mjs']) copyFileSync(join('scripts', f), join(repo, 'scripts', f));   // copies: node resolves a symlinked main module and its CLI guard would not fire
  const sh = (name: string, body: string) => { writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`); chmodSync(join(bin, name), 0o755); };
  sh('gh', `echo "gh $*" >> "${log}"; jq_expr=""; prev=""; for a in "$@"; do [ "$prev" = --jq ] && jq_expr="$a"; prev="$a"; done
case "$1 $2" in "pr list") { [ -n "\${PRS:-}" ] && cat "$PRS" || echo '[]'; } | if [ -n "$jq_expr" ]; then jq -r "$jq_expr"; else cat; fi ;; "pr view") if [ -n "\${VIEW:-}" ]; then cat "$VIEW"; else node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.env.PRS, "utf8"))[0]))'; fi ;; "pr merge") exit "\${MERGE_RC:-0}" ;; esac; exit 0`);
  sh('git', `echo "git $*" >> "${log}"; case "$1" in rev-parse) case "$2" in origin/*) echo "\${TRUNK_SHA:-$CAND}" ;; *) echo 1234567 ;; esac ;; push) exit "\${PUSH_RC:-0}" ;; esac; exit 0`);
  sh('fake-deploy', `echo "deploy FRANKENDOM_RELEASE=$FRANKENDOM_RELEASE" >> "${log}"; [ "\${DEPLOY_RC:-0}" = 0 ] || { echo 'row 12 failed'; exit "$DEPLOY_RC"; }; printf 'rows ok\\nPublished %s\\nall green\\n' "$CAND"`);
  sh('fake-worktree', `echo "${dir}"`);
  sh('fake-mac-rows', `echo "mac-rows $1" >> "${log}"`);
  const cand = 'c'.repeat(40);
  writeFileSync(join(dir, 'prs.json'), JSON.stringify([{ number: 2400, headRefName: 'release-T10121740', baseRefName: TRUNK, headRefOid: cand, createdAt: '2026-10-12T17:40:00Z', isDraft: true, labels: [{ name: 'candidate:pass' }], comments: [{ body: '**Auditor: PASS @ccccccccc** (candidate)', authorAssociation: 'OWNER' }], statusCheckRollup: OK }]));
  const run = (env: Record<string, string> = {}) => spawnSync('bash', ['scripts/release-train-publish.sh'], { encoding: 'utf8', timeout: 60_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RELEASE_TRAIN_STATE: state, RELEASE_TRAIN_REPO: repo, RELEASE_TRAIN_DEPLOY: join(bin, 'fake-deploy'), RELEASE_TRAIN_WORKTREE: join(bin, 'fake-worktree'), RELEASE_TRAIN_NOTIFY: 'true', RELEASE_TRAIN_MAC_ROWS: join(bin, 'fake-mac-rows'), PRS: join(dir, 'prs.json'), CAND: cand, ...env } });
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8') : '');
  const env = { PATH: `${bin}:${process.env.PATH}`, RELEASE_TRAIN_STATE: state, RELEASE_TRAIN_REPO: repo, RELEASE_TRAIN_DEPLOY: join(bin, 'fake-deploy'), RELEASE_TRAIN_WORKTREE: join(bin, 'fake-worktree'), RELEASE_TRAIN_NOTIFY: 'true', RELEASE_TRAIN_MAC_ROWS: join(bin, 'fake-mac-rows'), PRS: join(dir, 'prs.json'), CAND: cand };
  return { dir, state, run, calls, cand, env, reset: () => writeFileSync(log, '') };
}

test('publisher: FAST-FORWARDS trunk to the audited candidate sha (never a merge commit), deploys with FRANKENDOM_RELEASE=1, removes deploy_hold and comments the Published line', () => {
  const p = publisher();
  try {
    const r = p.run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(p.calls(), new RegExp(`gh pr ready 2400\\ngit push -q origin ${p.cand}:refs/heads/${TRUNK}\\n`));
    assert.doesNotMatch(p.calls(), /pr merge/, 'no merge commit: N+1, cut on N, still contains trunk');
    assert.match(p.calls(), /deploy FRANKENDOM_RELEASE=1/);
    assert.match(p.calls(), /gh pr comment 2400 --body release-train: published #2400/);
    assert.equal(existsSync(join(p.state, 'deploy_hold')), false, 'hold removed after Published');
    assert.equal(existsSync(join(p.state, 'release-train.lock')), false, 'lock released');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher: a candidate is judged on its FULL check list (`gh pr view`), not the 100 checks `gh pr list` returns (DL #2431: 169 checks, never picked)', () => {
  const p = publisher();
  try {
    const full = JSON.parse(readFileSync(p.env.PRS, 'utf8'))[0];
    writeFileSync(join(p.dir, 'view.json'), JSON.stringify(full));
    // the list's cut: the rows past the 100th, here quality/quality and release-checks/summary, are missing from what `gh pr list` returns
    const cut = { ...full, statusCheckRollup: full.statusCheckRollup.filter((c: { workflowName?: string; name?: string }) => !(c.workflowName === 'quality' && c.name === 'quality') && !(c.workflowName === 'release-checks' && c.name === 'summary')) };
    writeFileSync(p.env.PRS, JSON.stringify([cut]));
    assert.ok(missingRows(cut.statusCheckRollup).length, 'the cut list alone fails the gate');
    const r = p.run({ VIEW: join(p.dir, 'view.json') });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(p.calls(), new RegExp(`gh pr view 2400 --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments`), 'the candidate is read in full');
    assert.match(p.calls(), new RegExp(`git push -q origin ${p.cand}:refs/heads/${TRUNK}`), 'and published');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher: no double publish: a live lock holder or deploy_hold means the tick does nothing; a dead holder is broken', () => {
  const p = publisher();
  try {
    mkdirSync(join(p.state, 'release-train.lock')); writeFileSync(join(p.state, 'release-train.lock', 'pid'), String(process.pid));
    let r = p.run();
    assert.equal(r.status, 0); assert.match(r.stdout, /a publish is in flight \(pid \d+\)/);
    assert.doesNotMatch(p.calls(), /git push|deploy/);
    rmSync(join(p.state, 'release-train.lock'), { recursive: true });
    writeFileSync(join(p.state, 'deploy_hold'), '');
    r = p.run();
    assert.match(r.stdout, /deploy_hold present/); assert.doesNotMatch(p.calls(), /git push|deploy/);
    writeFileSync(join(p.state, 'deploy_hold'), String(process.pid));   // a live publisher's hold
    r = p.run(); assert.match(r.stdout, /deploy_hold present/);
    rmSync(join(p.state, 'deploy_hold'));
    mkdirSync(join(p.state, 'release-train.lock')); writeFileSync(join(p.state, 'release-train.lock', 'pid'), '999999');
    r = p.run();
    assert.match(r.stdout, /breaking a dead lock \(pid 999999\)/); assert.match(p.calls(), /git push -q origin c+:refs\/heads/);
    assert.match(readFileSync('scripts/release-train-publish.sh', 'utf8'), /^\{$/m, 'the body is one block: parsed whole before the tick moves its own checkout');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher: a failed deploy STOPS the train: deploy_hold kept, the reason filed, one comment; the next tick does nothing', () => {
  const p = publisher();
  try {
    let r = p.run({ DEPLOY_RC: '3' });
    assert.equal(r.status, 1);
    assert.match(readFileSync(join(p.state, 'release-train.stopped'), 'utf8'), /STOPPED at #2400 @ccccccccc: deploy\.sh exit 3 \(row 12 failed\)/);
    assert.ok(existsSync(join(p.state, 'deploy_hold')), 'deploy_hold stays');
    assert.equal(p.calls().match(/gh pr comment 2400/g)?.length, 1, 'one comment');
    p.reset();
    r = p.run();
    assert.equal(r.status, 0); assert.match(r.stdout, /stopped \(release-train STOPPED/);
    assert.equal(p.calls(), '', 'a stopped train calls nothing');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher: trunk not at the audited sha after the fast-forward stops before deploy.sh', () => {
  const p = publisher();
  try {
    const r = p.run({ TRUNK_SHA: 'd'.repeat(40) });
    assert.equal(r.status, 1);
    assert.match(readFileSync(join(p.state, 'release-train.stopped'), 'utf8'), /trunk is d+ after the fast-forward, not the audited c+/);
    assert.doesNotMatch(p.calls(), /deploy FRANKENDOM/);
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher (Lead #2336 finding 5): a live hand-run deploy.sh blocks the tick; a hold whose publisher pid is dead is reported STALE once; no PASS comment, no publish', () => {
  const p = publisher();
  try {
    mkdirSync(join(p.state, 'deploy_runs'));
    writeFileSync(join(p.state, 'deploy_runs', '1.json'), `{"revision":"x","pid":${process.pid},"cwd":"/d"}`);
    let r = p.run();
    assert.equal(r.status, 0); assert.match(r.stdout, /deploy\.sh is running \(pid \d+\)/); assert.doesNotMatch(p.calls(), /git push/);
    rmSync(join(p.state, 'deploy_runs'), { recursive: true });
    writeFileSync(join(p.state, 'deploy_hold'), '999999\n');
    r = p.run();
    assert.match(r.stdout, /STALE deploy_hold: publisher pid 999999 is dead/); assert.doesNotMatch(p.calls(), /git push/);
    assert.ok(existsSync(join(p.state, 'deploy_hold.stale-told')), 'told once');
    rmSync(join(p.state, 'deploy_hold')); rmSync(join(p.state, 'deploy_hold.stale-told'));
    const prs = JSON.parse(readFileSync(join(p.dir, 'prs.json'), 'utf8')); prs[0].comments = [{ body: 'waiting for Auditor: PASS @ccccccccc', authorAssociation: 'OWNER' }];
    writeFileSync(join(p.dir, 'prs.json'), JSON.stringify(prs));
    r = p.run();
    assert.match(r.stdout, /no candidate with candidate:pass, a PASS at its head/); assert.doesNotMatch(p.calls(), /git push/);
    const src = readFileSync('scripts/release-train-publish.sh', 'utf8');
    assert.match(src, /\( set -o noclobber; echo "\$\$" > "\$hold" \)/, 'the hold is created atomically, holding the pid');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher (Lead on #2336): the gate is re-checked on the FULL rollup: gh pr list stops at 100 checks, a red row at index 120 blocks the publish', () => {
  const p = publisher();
  try {
    const green = (i: number) => ({ __typename: 'CheckRun', workflowName: 'release-checks', name: `check ${i} (row)`, status: 'COMPLETED', conclusion: 'SUCCESS' });
    const full = [...OK, ...Array.from({ length: 130 }, (_, i) => green(i))];
    full[120] = { ...full[120], conclusion: 'FAILURE' };
    const listed = JSON.parse(readFileSync(join(p.dir, 'prs.json'), 'utf8'));
    writeFileSync(join(p.dir, 'view.json'), JSON.stringify({ ...listed[0], statusCheckRollup: full }));
    listed[0].statusCheckRollup = full.slice(0, 100);   // what `gh pr list` returns: the first 100, all green
    writeFileSync(join(p.dir, 'prs.json'), JSON.stringify(listed));
    const r = p.run({ VIEW: join(p.dir, 'view.json') });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /#2400 @ccccccccc not publishable on its full check list: gate not met on the full check list \(134 checks; missing\/red: release-checks\/check 116 \(row\)/);
    assert.doesNotMatch(p.calls(), /git push|deploy FRANKENDOM/);
    const moved = { ...listed[0], headRefOid: 'e'.repeat(40), statusCheckRollup: OK };
    writeFileSync(join(p.dir, 'view.json'), JSON.stringify(moved));
    assert.match(p.run({ VIEW: join(p.dir, 'view.json') }).stdout, /head moved to eeeeeeeee/);
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher: starts the Mac-only rows at the cut for the OLDEST open candidate without a receipt (Strategy + Lead 2026-10-12)', async () => {
  const p = publisher();
  try {
    const listed = JSON.parse(readFileSync(join(p.dir, 'prs.json'), 'utf8'));
    const newer = { ...listed[0], number: 2401, headRefName: 'release-T2', headRefOid: 'd'.repeat(40), createdAt: '2026-10-12T18:00:00Z', labels: [] };
    writeFileSync(join(p.dir, 'prs.json'), JSON.stringify([newer, listed[0]]));
    writeFileSync(join(p.state, 'deploy_hold'), '');   // held: no publish this tick, but the early rows still start
    let r = p.run();
    assert.match(r.stdout, /mac rows \(early\) for ccccccccc: started/);
    await new Promise((done) => setTimeout(done, 300));
    assert.match(p.calls(), new RegExp(`mac-rows ${'c'.repeat(40)}`), 'the oldest candidate (it publishes first)');
    mkdirSync(join(p.state, 'pre-launch'), { recursive: true });
    writeFileSync(join(p.state, 'pre-launch', `${'c'.repeat(40)}.macrows.json`), '{}');
    p.reset(); r = p.run();
    assert.match(r.stdout, /mac rows \(early\) for ddddddddd: started/, 'next: the newer one, once the oldest has a receipt');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher under launchd (Lead 2026-10-12): a Desktop-backed repo or release slot is refused BEFORE any git call, hold or push; the train never runs from one', () => {
  const p = publisher();
  try {
    const home = join(p.dir, 'home'), deskRepo = join(p.dir, 'deskrepo');
    mkdirSync(join(deskRepo, 'scripts'), { recursive: true });
    for (const f of ['release-train.mjs', 'cut-release.mjs']) copyFileSync(join('scripts', f), join(deskRepo, 'scripts', f));
    writeFileSync(join(deskRepo, '.git'), `gitdir: ${join(home, 'Desktop/Business/frankendom/.git/worktrees/frankendom-train')}\n`);
    const r = p.run({ HOME: home, RELEASE_TRAIN_REPO: deskRepo });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /refusing to run: .*deskrepo: a worktree of a repo under ~\/Desktop/);
    assert.doesNotMatch(p.calls(), /^git /m, 'no git call: under launchd it would only fail with "not a git repository"');
    assert.equal(existsSync(join(p.state, 'deploy_hold')), false);
    p.reset();
    const slot = join(p.dir, 'slot'); mkdirSync(slot); writeFileSync(join(slot, '.git'), `gitdir: ${join(home, 'Desktop/x/.git/worktrees/slot')}\n`);
    const s = p.run({ HOME: home, RELEASE_SLOTS: slot });
    assert.equal(s.status, 1);
    assert.match(s.stdout, /refusing to run: .*slot: a worktree of a repo under ~\/Desktop/);
    assert.doesNotMatch(p.calls(), /git push|deploy FRANKENDOM/, 'nothing pushed, nothing deployed');
    assert.equal(existsSync(join(p.state, 'deploy_hold')), false);
    assert.match(readFileSync('scripts/release-train-publish.sh', 'utf8'), /RELEASE_SLOTS="\$\{RELEASE_SLOTS:-\$HOME\/Developer\/frankendom-train-deploy\}"/, 'its own release slot, a worktree of the train clone');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher dry run (--dry-run or the release-train.dry-run file): the tick reads, picks and verifies, logs what it would publish, and writes nothing', () => {
  const p = publisher();
  try {
    for (const how of ['arg', 'file']) {
      p.reset();
      if (how === 'file') writeFileSync(join(p.state, 'release-train.dry-run'), '');
      writeFileSync(join(p.state, 'deploy_hold'), 'Deploy by hand\n');   // a held box: a dry run still reports, never waits
      const r = how === 'arg' ? spawnSync('bash', ['scripts/release-train-publish.sh', '--dry-run'], { encoding: 'utf8', env: { ...process.env, ...runEnv(p) } }) : p.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /DRY RUN: deploy_hold present/);
      assert.match(r.stdout, new RegExp(`DRY RUN: would start mac rows \\(early\\) for ${p.cand.slice(0, 9)} in .*frankendom-train-macrows`), 'the early rows are only named');
      assert.doesNotMatch(p.calls(), /mac-rows /, 'and not started');
      assert.match(r.stdout, new RegExp(`DRY RUN: would publish #2400 @${p.cand.slice(0, 9)}`));
      assert.match(p.calls(), /git fetch -q origin/, 'the tick still reads git: that is what launchd must prove');
      assert.doesNotMatch(p.calls(), /git push|gh pr ready|gh pr comment|deploy FRANKENDOM/, `${how}: nothing written`);
      assert.equal(readFileSync(join(p.state, 'deploy_hold'), 'utf8'), 'Deploy by hand\n', 'the hold is untouched');
      rmSync(join(p.state, 'deploy_hold'));
    }
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('the cutter workflow: schedule 10 min + release:go label, trunk checkout only, one at a time, dispatches the receipts without a PAT', () => {
  const wf = readFileSync('.github/workflows/release-train.yml', 'utf8');
  assert.match(wf, /cron: '\*\/10 \* \* \* \*'/);
  assert.match(wf, /pull_request_target:\n {4}types: \[labeled\]/);
  assert.match(wf, /github\.event\.label\.name == 'release:go'/);
  assert.match(wf, /ref: codex\/01a09a76\/task-1/, 'never checks out PR code');
  assert.match(wf, /group: release-train\n {2}cancel-in-progress: false/);
  assert.match(wf, /node scripts\/release-train\.mjs cut/);
  assert.match(readFileSync('.github/workflows/quality.yml', 'utf8'), /\n {2}workflow_dispatch:\n/, 'quality can be dispatched on a candidate');
  assert.deepEqual(readOrder(readFileSync('docs/release-order.txt', 'utf8')).slice(0, 3), [2322, 2313, 2326]);
});

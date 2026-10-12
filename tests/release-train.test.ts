// The release train (scripts/release-train.mjs cutter + scripts/release-train-publish.sh publisher, Lead 2026-10-12): the plan's order and stacking,
// a conflict skipped without blocking the rest, the push retry, the publisher's pick, its no-double-publish lock and its stop on failure.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { mergeAll, passAt, pushWithRetry } from '../scripts/cut-release.mjs';
import { checksGreen, pickPublish, planTrain, readOrder, trainName } from '../scripts/release-train.mjs';

const TRUNK = 'codex/01a09a76/task-1';
const OK = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }, { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SKIPPED' }];
const pr = (number: number, over: Record<string, unknown> = {}) => ({ number, head: `${number}`.padEnd(40, 'a'), headRef: `lane/${number}`, baseRef: TRUNK, labels: ['release:go'], green: true, passedAt: `2026-10-12T10:${String(number % 60).padStart(2, '0')}:00Z`, ...over });

test('readOrder, checksGreen and the train name', () => {
  assert.deepEqual(readOrder('# Lead-owned\n2322\n\n2313  # stacked\nx\n'), [2322, 2313]);
  assert.equal(checksGreen(OK), true);
  assert.equal(checksGreen([...OK, { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' }]), false, 'pending is not green');
  assert.equal(checksGreen([...OK, { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }]), false);
  assert.equal(checksGreen([{ __typename: 'StatusContext', state: 'SUCCESS' }]), true);
  assert.equal(checksGreen([]), false, 'no checks at all is not green');
  assert.equal(trainName(new Date('2026-10-12T17:40:05Z')), 'T10121740');
});

test('planTrain: release-order.txt first, then oldest PASS; only release:go + PASS at head + green; a PR already in the base is dropped silently', () => {
  const prs = [pr(5, { passedAt: '2026-10-12T09:00:00Z' }), pr(6, { passedAt: '2026-10-12T08:00:00Z' }), pr(7), pr(8, { passedAt: null }), pr(9, { green: false }), pr(10, { labels: [] }), pr(11), pr(12, { headRef: 'release-CO' })];
  const { pick, skipped } = planTrain({ prs, order: [7, 99], inBase: (h: string) => h.startsWith('11') });
  assert.deepEqual(pick.map((p) => p.pr), [7, 6, 5], 'listed 7 first, then 6 (older PASS) before 5');
  assert.deepEqual(skipped.map((s) => s.pr).sort(), [8, 9]);
  assert.match(skipped.find((s) => s.pr === 8)!.why, /no "Auditor: PASS @" or "Lead: PASS @8aaaaaaaa" at its current head/);
  assert.ok(passAt(['Lead: PASS @8aaaaaaaa (independent platform review)'], '8'.padEnd(40, 'a')) && passAt(['Auditor: PASS @8aaaaaaaa'], '8'.padEnd(40, 'a')), 'Lead or the Auditor');
  assert.ok(!passAt(['Lead: PASS @9aaaaaaaa', 'Strategy: PASS @8aaaaaaaa'], '8'.padEnd(40, 'a')), 'another head, or another name, is not a PASS');
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
  assert.match(src, /const from = `origin\/\$\{base \|\| TRUNK\}`/, 'cut-release --base builds N+1 on N');
  assert.match(readFileSync('scripts/release-train.mjs', 'utf8'), /pushWithRetry\(git, `release-\$\{name\}`\)/);
});

test('pickPublish: the OLDEST release-* candidate with candidate:pass and all checks green', () => {
  const c = (number: number, createdAt: string, over: Record<string, unknown> = {}) => ({ number, headRefName: `release-T${number}`, baseRefName: TRUNK, headRefOid: 'f'.repeat(40), createdAt, isDraft: true, labels: [{ name: 'candidate:pass' }], statusCheckRollup: OK, ...over });
  const prs = [c(3, '2026-10-12T12:00:00Z'), c(2, '2026-10-12T11:00:00Z'), c(1, '2026-10-12T10:00:00Z', { statusCheckRollup: [{ __typename: 'CheckRun', status: 'QUEUED' }] }), c(4, '2026-10-12T09:00:00Z', { labels: [] }), c(5, '2026-10-12T08:00:00Z', { headRefName: 'lane/x' })];
  assert.equal(pickPublish(prs)?.number, 2);
  assert.equal(pickPublish([]), null);
});

// The publisher with gh, git and the deploy stubbed: nothing here touches GitHub, this checkout or a box.
function publisher() {
  const dir = mkdtempSync(join(tmpdir(), 'pub-')), bin = join(dir, 'bin'), state = join(dir, 'state'), repo = join(dir, 'repo'), log = join(dir, 'calls');
  mkdirSync(bin); mkdirSync(state); mkdirSync(join(repo, 'scripts'), { recursive: true });
  for (const f of ['release-train.mjs', 'cut-release.mjs']) copyFileSync(join('scripts', f), join(repo, 'scripts', f));   // copies: node resolves a symlinked main module and its CLI guard would not fire
  const sh = (name: string, body: string) => { writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`); chmodSync(join(bin, name), 0o755); };
  sh('gh', `echo "gh $*" >> "${log}"; case "$1 $2" in "pr list") [ -n "\${PRS:-}" ] && cat "$PRS" || echo '[]' ;; "pr merge") exit "\${MERGE_RC:-0}" ;; esac; exit 0`);
  sh('git', `echo "git $*" >> "${log}"; case "$1" in status) ;; rev-parse) case "$2" in *'^{tree}') [ "\${2%^\\{tree\\}}" = "\${CAND:-}" ] && echo T1 || echo "\${TRUNK_TREE:-T1}" ;; *) echo "${'b'.repeat(40)}" ;; esac ;; esac; exit 0`);
  sh('fake-deploy', `echo "deploy FRANKENDOM_RELEASE=$FRANKENDOM_RELEASE" >> "${log}"; [ "\${DEPLOY_RC:-0}" = 0 ] || { echo 'row 12 failed'; exit "$DEPLOY_RC"; }; printf 'rows ok\\nPublished ${'b'.repeat(40)}\\nall green\\n'`);
  sh('fake-worktree', `echo "${dir}"`);
  const cand = 'c'.repeat(40);
  writeFileSync(join(dir, 'prs.json'), JSON.stringify([{ number: 2400, headRefName: 'release-T10121740', baseRefName: TRUNK, headRefOid: cand, createdAt: '2026-10-12T17:40:00Z', isDraft: true, labels: [{ name: 'candidate:pass' }], statusCheckRollup: OK }]));
  const run = (env: Record<string, string> = {}) => spawnSync('bash', ['scripts/release-train-publish.sh'], { encoding: 'utf8', timeout: 60_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RELEASE_TRAIN_STATE: state, RELEASE_TRAIN_REPO: repo, RELEASE_TRAIN_DEPLOY: join(bin, 'fake-deploy'), RELEASE_TRAIN_WORKTREE: join(bin, 'fake-worktree'), RELEASE_TRAIN_NOTIFY: 'true', PRS: join(dir, 'prs.json'), CAND: cand, ...env } });
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8') : '');
  return { dir, state, run, calls, cand, reset: () => writeFileSync(log, '') };
}

test('publisher: merges the candidate pinned to its head, deploys with FRANKENDOM_RELEASE=1, removes deploy_hold and comments the Published line', () => {
  const p = publisher();
  try {
    const r = p.run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(p.calls(), new RegExp(`gh pr ready 2400\\ngh pr merge 2400 --merge --match-head-commit ${p.cand}`));
    assert.match(p.calls(), /deploy FRANKENDOM_RELEASE=1/);
    assert.match(p.calls(), /gh pr comment 2400 --body release-train: published #2400/);
    assert.equal(existsSync(join(p.state, 'deploy_hold')), false, 'hold removed after Published');
    assert.equal(existsSync(join(p.state, 'release-train.lock')), false, 'lock released');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('publisher: no double publish: a live lock holder or deploy_hold means the tick does nothing; a dead holder is broken', () => {
  const p = publisher();
  try {
    mkdirSync(join(p.state, 'release-train.lock')); writeFileSync(join(p.state, 'release-train.lock', 'pid'), String(process.pid));
    let r = p.run();
    assert.equal(r.status, 0); assert.match(r.stdout, /a publish is in flight \(pid \d+\)/);
    assert.doesNotMatch(p.calls(), /pr merge|deploy/);
    rmSync(join(p.state, 'release-train.lock'), { recursive: true });
    writeFileSync(join(p.state, 'deploy_hold'), '');
    r = p.run();
    assert.match(r.stdout, /deploy_hold present/); assert.doesNotMatch(p.calls(), /pr merge|deploy/);
    rmSync(join(p.state, 'deploy_hold'));
    mkdirSync(join(p.state, 'release-train.lock')); writeFileSync(join(p.state, 'release-train.lock', 'pid'), '999999');
    r = p.run();
    assert.match(r.stdout, /breaking a dead lock \(pid 999999\)/); assert.match(p.calls(), /gh pr merge 2400/);
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

test('publisher: a trunk tree that differs from the candidate (something else landed) stops before deploy.sh', () => {
  const p = publisher();
  try {
    const r = p.run({ TRUNK_TREE: 'T2' });
    assert.equal(r.status, 1);
    assert.match(readFileSync(join(p.state, 'release-train.stopped'), 'utf8'), /tree differs from the candidate/);
    assert.doesNotMatch(p.calls(), /deploy FRANKENDOM/);
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

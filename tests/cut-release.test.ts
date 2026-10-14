// scripts/cut-release.mjs: the release cut in one command. mergeAll runs on a fixture repo (clean merge, a conflicting PR is aborted and named while the others still merge,
// an unknown sha is skipped); parseSpec/passAt are the pure parts; the workflow keeps release-* candidates in the CI row matrix (drafts included) at 20 wide.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { LABELS, mergeAll, parseSpec, passAt } from '../scripts/cut-release.mjs';

const own = (body: string) => ({ body, authorAssociation: 'OWNER' });
const mkGit = (cwd: string) => (args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'cut-'));
  const git = mkGit(dir), ok = (args: string[]) => { const r = git(args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  ok(['init', '-q', '-b', 'main']);
  writeFileSync(join(dir, 'a.txt'), 'one\n'); ok(['add', '-A']); ok(['commit', '-q', '-m', 'base']);
  const branch = (name: string, file: string, text: string) => { ok(['switch', '-q', '-c', name, 'main']); writeFileSync(join(dir, file), text); ok(['add', '-A']); ok(['commit', '-q', '-m', name]); const sha = ok(['rev-parse', 'HEAD']); ok(['switch', '-q', 'main']); return sha; };
  const good = branch('good', 'b.txt', 'b\n'), other = branch('other', 'c.txt', 'c\n'), clash = branch('clash', 'a.txt', 'two\n');
  writeFileSync(join(dir, 'a.txt'), 'three\n'); ok(['add', '-A']); ok(['commit', '-q', '-m', 'trunk moves']);
  ok(['switch', '-q', '-c', 'release-X', 'main']);
  return { dir, git, good, other, clash };
}

test('mergeAll merges clean PRs in order, aborts and names a conflicting one, still merges the rest, and skips an unknown sha', () => {
  const f = fixture();
  try {
    const out = mergeAll(f.git, 'X', [{ pr: 1, head: f.good }, { pr: 2, head: f.clash }, { pr: 3, head: f.other }, { pr: 4, head: 'deadbeef' }]);
    assert.deepEqual(out.merged, [1, 3]);
    assert.equal(out.skipped.length, 2);
    assert.deepEqual(out.skipped.map(s => s.pr), [2, 4]);
    assert.match(out.skipped[0].why, /conflicts in a\.txt/);
    assert.equal(f.git(['status', '--porcelain']).stdout.trim(), '', 'the aborted merge leaves a clean tree');
    const subjects = f.git(['log', '--merges', '--format=%s']).stdout.trim().split('\n');
    assert.deepEqual(subjects, ['Merge pull request #3 (release-X candidate)', 'Merge pull request #1 (release-X candidate)']);
    assert.ok(f.git(['merge-base', '--is-ancestor', f.good, 'HEAD']).status === 0 && f.git(['merge-base', '--is-ancestor', f.clash, 'HEAD']).status !== 0);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('parseSpec reads PR@sha and refuses anything else; passAt wants the Auditor PASS for exactly that head', () => {
  assert.deepEqual(parseSpec('2291@23b4f51e0'), { pr: 2291, head: '23b4f51e0' });
  assert.deepEqual(parseSpec('#7@' + 'a'.repeat(40)), { pr: 7, head: 'a'.repeat(40) });
  for (const bad of ['2291', '2291@', '@abc1234', 'x@23b4f51e0', '2291@zzzzzzz']) assert.throws(() => parseSpec(bad), /bad PR spec/);
  assert.equal(passAt([own('**Auditor: PASS @23b4f51e0** (looks good)')], '23b4f51e0aaaa'), true);
  assert.equal(passAt([own('**Auditor: PASS @11111111a**')], '23b4f51e0'), false);
  assert.equal(passAt([own('Auditor: HOLD @23b4f51e0')], '23b4f51e0'), false);
});

test('passAt reads the Auditor\'s mid-line bold "Auditor: **PASS @sha**" (DI #2459, 2026-10-13) and still refuses "not PASS" and a PASS for another head', () => {
  const head = 'bac7e84f4'.padEnd(40, 'a');
  assert.ok(passAt([own('Auditor: **PASS @bac7e84f4** (release-DI). `candidate:pass` added.')], head), 'bold only around PASS @sha');
  assert.ok(passAt([own('Lead: **PASS** @bac7e84f4')], head), 'bold only around PASS');
  assert.ok(!passAt([own('Auditor: **not PASS @bac7e84f4**')], head), 'not PASS');
  assert.ok(!passAt([own('Auditor: **PASS @11111111a**')], head), 'another head');
  assert.ok(!passAt([own('Auditor: **contents OK @bac7e84f4** (not a PASS yet)')], head), 'contents OK is not a PASS');
});

test('passAt takes the six full reviewers (Auditor, Lead, Combat A, Combat B, Deploy B; Strategy 2026-10-12; Hooks, the CI/workflow/scripts reviewer, Lead 2026-10-13) at the exact head, 9-char prefix, trailing text allowed', () => {
  const head = '23b4f51e0'.padEnd(40, 'a');
  for (const who of ['Auditor', 'Lead', 'Combat A', 'Combat B', 'Deploy B', 'Hooks']) {
    assert.ok(passAt([own(`${who}: PASS @23b4f51e0`)], head), `${who} at the head`);
    assert.ok(passAt([own(`**${who}: PASS @23b4f51e0** (notes)`)], head), `${who} bold, trailing text`);
    assert.ok(!passAt([own(`${who}: PASS @11111111a`)], head), `${who} at another head is not a PASS`);
  }
  assert.ok(passAt([own('Deploy B: PASS @23b4f51e0 (VPS receipt; as-data batch candidate CI is the gate)')], head), 'the #2406 Deploy B verdict');
  assert.ok(passAt([own('**Combat B: PASS @96c9e1a8e** (named review)')], '96c9e1a8e'.padEnd(40, 'b')), 'the #2412 Combat B verdict');
  for (const no of ['Combat C: PASS @23b4f51e0', 'Deploy A: PASS @23b4f51e0', 'Strategy: PASS @23b4f51e0', 'Combat: PASS @23b4f51e0', 'waiting for Combat A: PASS @23b4f51e0'])
    assert.ok(!passAt([own(no)], head), `${no} is not a PASS`);
});

test('passAt trusts only OWNER, MEMBER or COLLABORATOR comments: the repo is public, so anyone can type "Auditor: PASS @sha"', () => {
  const head = '23b4f51e0'.padEnd(40, 'a'), body = 'Auditor: PASS @23b4f51e0';
  for (const a of ['OWNER', 'MEMBER', 'COLLABORATOR']) assert.ok(passAt([{ body, authorAssociation: a }], head), `${a} is trusted`);
  for (const a of ['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'MANNEQUIN', '', undefined])
    assert.ok(!passAt([{ body, authorAssociation: a }], head), `${a} is not trusted`);
  assert.ok(!passAt([body], head), 'a bare body (no author) is not trusted');
  assert.ok(passAt([{ body, authorAssociation: 'NONE' }, own(body)], head), 'an outsider copy does not hide the owner PASS');
});

test('cut-release asks gh for each comment\'s authorAssociation, not bodies alone', () => {
  const src = readFileSync('scripts/cut-release.mjs', 'utf8');
  assert.match(src, /\.comments\[\]\s*\|\s*\{body,\s*authorAssociation\}/);
  assert.doesNotMatch(src, /\[\.comments\[\]\.body\]/);
});

test('the cut labels every candidate ci:release-checks, and release-checks.yml runs release-* candidates (drafts included) 20 wide', () => {
  assert.ok(LABELS.includes('ci:release-checks') && LABELS.includes('auditor:ready'));
  const wf = readFileSync('.github/workflows/release-checks.yml', 'utf8');
  assert.match(wf, /max-parallel: 40/);
  assert.match(wf, /if: github\.event_name != 'pull_request' \|\| \(startsWith\(github\.head_ref, 'release-'\) && github\.event\.action != 'opened' && \(github\.event\.action != 'labeled' \|\| github\.event\.label\.name == 'ci:release-checks'\)\)\n/, 'a release-* candidate runs, drafts included, on its ci:release-checks label event (`opened` runs nothing since #2599: the cut always labels right after, gh or the REST fallback, and a missing run is caught by missingRows); a feature PR schedules nothing (tests/ci-static-first.test.ts)');
  assert.match(wf, /HEAD_REF\.startsWith\("release-"\)/);
});

test('a failed git push or gh pr create exits non-zero before any background job launches', () => {
  const src = readFileSync(new URL('../scripts/cut-release.mjs', import.meta.url), 'utf8');
  const launch = src.indexOf("bg('prelaunch.log'");
  for (const guard of ['!pushed.ok', 'created.status !== 0']) {
    const at = src.indexOf(guard);
    assert.ok(at > 0 && at < launch, `${guard} must be checked before the background launch`);
  }
});

test('the cut launches no Hugging Face unit job: unit-ci.yml on the candidate is the unit receipt (Lead 2026-10-12)', () => {
  const src = readFileSync(new URL('../scripts/cut-release.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /launch\.mjs['"], ['"]unit/);
  assert.doesNotMatch(src, /bg\('unit\.log'/);
});

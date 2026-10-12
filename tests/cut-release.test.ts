// scripts/cut-release.mjs: the release cut in one command. mergeAll runs on a fixture repo (clean merge, a conflicting PR is aborted and named while the others still merge,
// an unknown sha is skipped); parseSpec/passAt are the pure parts; the workflow keeps release-* candidates in the CI row matrix (drafts included) at 20 wide.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { LABELS, mergeAll, parseSpec, passAt } from '../scripts/cut-release.mjs';

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
  assert.equal(passAt(['**Auditor: PASS @23b4f51e0** (looks good)'], '23b4f51e0aaaa'), true);
  assert.equal(passAt(['**Auditor: PASS @11111111a**'], '23b4f51e0'), false);
  assert.equal(passAt(['Auditor: HOLD @23b4f51e0'], '23b4f51e0'), false);
});

test('the cut labels every candidate ci:release-checks, and release-checks.yml runs release-* candidates (drafts included) 20 wide', () => {
  assert.ok(LABELS.includes('ci:release-checks') && LABELS.includes('auditor:ready'));
  const wf = readFileSync('.github/workflows/release-checks.yml', 'utf8');
  assert.match(wf, /max-parallel: 20/);
  assert.match(wf, /if: github\.event_name != 'pull_request' \|\| startsWith\(github\.head_ref, 'release-'\)\n/, 'a release-* candidate runs, drafts included; a feature PR schedules nothing (tests/ci-static-first.test.ts)');
  assert.match(wf, /HEAD_REF\.startsWith\("release-"\)/);
});

test('a failed git push or gh pr create exits non-zero before any background job launches', () => {
  const src = readFileSync(new URL('../scripts/cut-release.mjs', import.meta.url), 'utf8');
  const launch = src.indexOf("bg('prelaunch.log'");
  for (const guard of ['pushed.status !== 0', 'created.status !== 0']) {
    const at = src.indexOf(guard);
    assert.ok(at > 0 && at < launch, `${guard} must be checked before the background launch`);
  }
});

test('the cut launches no Hugging Face unit job: unit-ci.yml on the candidate is the unit receipt (Lead 2026-10-12)', () => {
  const src = readFileSync(new URL('../scripts/cut-release.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /launch\.mjs['"], ['"]unit/);
  assert.doesNotMatch(src, /bg\('unit\.log'/);
});

// scripts/candidate-contents-check.mjs: a deterministic read of a candidate's contents. Fixture repos are built with the cutter's own mergeAll, so the check verifies exactly what a cut produces.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const { mergeAll } = await import('../scripts/cut-release.mjs');
const { rebuildTree, verifyCandidate } = await import('../scripts/candidate-contents-check.mjs');

const mkGit = (cwd: string) => (args: string[], input?: string) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, input, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ccc-'));
  const git = mkGit(dir), ok = (args: string[]) => { const r = git(args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  ok(['init', '-q', '-b', 'main']);
  writeFileSync(join(dir, 'a.txt'), 'one\n'); ok(['add', '-A']); ok(['commit', '-q', '-m', 'base']);
  const base = ok(['rev-parse', 'HEAD']);
  const branch = (name: string, file: string, text: string) => { ok(['switch', '-q', '-c', name, 'main']); writeFileSync(join(dir, file), text); ok(['add', '-A']); ok(['commit', '-q', '-m', name]); return ok(['rev-parse', 'HEAD']); };
  const p1 = branch('p1', 'b.txt', 'b\n'), p2 = branch('p2', 'c.txt', 'c\n'), p3 = branch('p3', 'd.txt', 'd\n');
  const cut = (name: string, from: string, specs: { pr: number; head: string }[]) => { ok(['switch', '-q', '-c', `release-${name}`, from]); mergeAll(git, name, specs); return ok(['rev-parse', 'HEAD']); };
  return { dir, git, ok, base, p1, p2, p3, cut };
}
const allPass = () => true;

test('a clean cut verifies: the chain is only candidate merges, every head has a PASS, and the rebuilt tree equals the candidate tree', () => {
  const f = fixture();
  try {
    const cand = f.cut('X', f.base, [{ pr: 1, head: f.p1 }, { pr: 2, head: f.p2 }]);
    const v = verifyCandidate({ git: f.git, candidate: cand, base: f.base, passes: allPass });
    assert.equal(v.ok, true, JSON.stringify(v.problems));
    assert.deepEqual(v.prs.map(p => p.pr), [1, 2], 'oldest merge first');
    assert.equal(v.treeEqual, true);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a candidate stacked on the previous candidate verifies against that candidate as its base', () => {
  const f = fixture();
  try {
    const first = f.cut('X', f.base, [{ pr: 1, head: f.p1 }]);
    const second = f.cut('Y', first, [{ pr: 2, head: f.p2 }, { pr: 3, head: f.p3 }]);
    assert.equal(verifyCandidate({ git: f.git, candidate: second, base: first, passes: allPass }).ok, true);
    const wrong = verifyCandidate({ git: f.git, candidate: second, base: f.base, passes: allPass });
    assert.equal(wrong.ok, true, 'against the older base the chain simply includes the first candidate merge too');
    assert.deepEqual(wrong.prs.map(p => p.pr), [1, 2, 3]);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a PR head without a canonical PASS fails the verdict and names it', () => {
  const f = fixture();
  try {
    const cand = f.cut('X', f.base, [{ pr: 1, head: f.p1 }, { pr: 2, head: f.p2 }]);
    const v = verifyCandidate({ git: f.git, candidate: cand, base: f.base, passes: (pr: number) => pr !== 2 });
    assert.equal(v.ok, false);
    assert.match(v.problems.join('\n'), /#2 @[0-9a-f]{9} has no canonical PASS/);
    assert.equal(v.treeEqual, true, 'the tree is still reported');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('extra work on the branch (a commit on top of the merges) is refused', () => {
  const f = fixture();
  try {
    f.cut('X', f.base, [{ pr: 1, head: f.p1 }]);
    writeFileSync(join(f.dir, 'sneaky.txt'), 'x\n'); f.ok(['add', '-A']); f.ok(['commit', '-q', '-m', 'hand fix']);
    const v = verifyCandidate({ git: f.git, candidate: 'HEAD', base: f.base, passes: allPass });
    assert.equal(v.ok, false);
    assert.match(v.problems.join('\n'), /not a candidate merge.*extra work on the branch/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a hand-edited merge (the tree differs from the rebuild) is refused even though the subjects and parents look right', () => {
  const f = fixture();
  try {
    f.cut('X', f.base, [{ pr: 1, head: f.p1 }, { pr: 2, head: f.p2 }]);
    writeFileSync(join(f.dir, 'sneaky.txt'), 'x\n'); f.ok(['add', '-A']); f.ok(['commit', '-q', '--amend', '--no-edit']);
    const v = verifyCandidate({ git: f.git, candidate: 'HEAD', base: f.base, passes: allPass });
    assert.equal(v.ok, false);
    assert.equal(v.treeEqual, false);
    assert.match(v.problems.join('\n'), /differs from the candidate's/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a base the candidate was not cut on, an unresolvable ref and an empty candidate are all refused with a reason', () => {
  const f = fixture();
  try {
    const cand = f.cut('X', f.base, [{ pr: 1, head: f.p1 }]);
    const unrelated = verifyCandidate({ git: f.git, candidate: cand, base: f.p3, passes: allPass });
    assert.equal(unrelated.ok, false);
    assert.ok(unrelated.problems.length > 0);
    assert.match(verifyCandidate({ git: f.git, candidate: cand, base: 'no-such-ref', passes: allPass }).problems.join(), /does not resolve/);
    assert.match(verifyCandidate({ git: f.git, candidate: f.base, base: f.base, passes: allPass }).problems.join(), /merges nothing/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('rebuildTree reports the PR where a re-merge conflicts', () => {
  const f = fixture();
  try {
    f.ok(['switch', '-q', '-c', 'clash', 'main']); writeFileSync(join(f.dir, 'a.txt'), 'two\n'); f.ok(['add', '-A']); f.ok(['commit', '-q', '-m', 'clash']);
    const clash = f.ok(['rev-parse', 'HEAD']);
    f.ok(['switch', '-q', '-c', 'clash2', 'main']); writeFileSync(join(f.dir, 'a.txt'), 'three\n'); f.ok(['add', '-A']); f.ok(['commit', '-q', '-m', 'clash2']);
    const clash2 = f.ok(['rev-parse', 'HEAD']);
    assert.deepEqual(rebuildTree(f.git, f.base, [{ pr: 7, head: clash }, { pr: 8, head: clash2 }]), { conflictAt: 8 });
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('it works in a repo with NO git identity configured (the VPS and CI clones have none): commit-tree gets its own', () => {
  const f = fixture();
  try {
    const cand = f.cut('X', f.base, [{ pr: 1, head: f.p1 }]);
    const bare = (args: string[]) => spawnSync('git', args, { cwd: f.dir, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL', env: { PATH: process.env.PATH ?? '', HOME: f.dir, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
    const v = verifyCandidate({ git: bare, candidate: cand, base: f.base, passes: allPass });
    assert.equal(v.ok, true, JSON.stringify(v.problems));
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

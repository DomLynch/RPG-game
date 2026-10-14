// The contents-check must rebuild a cut that the allow-list merge driver resolved (scripts/as-data/merge-allow.mjs, PR #2725; cut-release passes it per call, PR #2728).
// Plain `git merge-tree` conflicts on two PRs that add allow entries side by side, so without the driver the first such candidate would read as not treeEqual.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const { driverArgs, mergeAll } = await import('../scripts/cut-release.mjs');
const { rebuildTree, verifyCandidate } = await import('../scripts/candidate-contents-check.mjs');
const { serialize } = await import('../scripts/as-data/merge-allow.mjs');

const REPO = new URL('..', import.meta.url).pathname;
const ALLOW = 'scripts/as-data/allow/src.json';
const row = (name: string, reason = 'r') => ({ file: `${name.toLowerCase()}.ts`, name, kind: 'debt', reason });
const doc = (...names: string[]) => serialize({ tunables: names.map((n) => row(n)) });
const mkGit = (cwd: string) => (args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });

// An OLD commit (no script, no .gitattributes: what a stale checkout of the checker looks like), then the base that adds the driver and one allow list, then PR branches.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ccc-driver-')), git = mkGit(dir);
  const ok = (args: string[]) => { const r = git(args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  ok(['init', '-q', '-b', 'main']); writeFileSync(join(dir, 'readme'), 'old\n'); ok(['add', '-A']); ok(['commit', '-q', '-m', 'old']);
  const old = ok(['rev-parse', 'HEAD']);
  mkdirSync(join(dir, 'scripts/as-data/allow'), { recursive: true });
  copyFileSync(join(REPO, 'scripts/as-data/merge-allow.mjs'), join(dir, 'scripts/as-data/merge-allow.mjs')); copyFileSync(join(REPO, '.gitattributes'), join(dir, '.gitattributes'));
  writeFileSync(join(dir, ALLOW), doc('A', 'Z')); ok(['add', '-A']); ok(['commit', '-q', '-m', 'base']);
  const base = ok(['rev-parse', 'HEAD']);
  const pr = (name: string, text: string) => { ok(['switch', '-q', '-c', name, base]); writeFileSync(join(dir, ALLOW), text); ok(['commit', '-qam', name]); return ok(['rev-parse', 'HEAD']); };
  return { dir, git, ok, old, base, pr };
}

test('a candidate whose allow lists the driver resolved is treeEqual, from the release checkout and from a stale one with no script or attributes', () => {
  const f = fixture();
  try {
    const p1 = f.pr('p1', doc('A', 'B', 'Z')), p2 = f.pr('p2', doc('A', 'C', 'Z'));   // both add after A: a plain line merge conflicts
    f.ok(['switch', '-q', '-c', 'release-X', f.base]);
    const cut = mergeAll(f.git, 'X', [{ pr: 1, head: p1 }, { pr: 2, head: p2 }]);
    assert.deepEqual(cut.merged, [1, 2]); assert.deepEqual(cut.driverResolved, { 2: [ALLOW] });
    const cand = f.ok(['rev-parse', 'HEAD']), passes = () => true;
    const v = verifyCandidate({ git: f.git, candidate: cand, base: f.base, passes });
    assert.equal(v.ok, true, JSON.stringify(v.problems)); assert.equal(v.treeEqual, true);
    // The same check run from a checkout that is on the OLD commit (no merge-allow.mjs, no .gitattributes on disk): the rebuild must not depend on where it runs.
    f.ok(['worktree', 'add', '-q', '--detach', join(f.dir, 'stale'), f.old]);
    assert.deepEqual(readdirSync(join(f.dir, 'stale')).filter((n) => n !== '.git'), ['readme']);
    const stale = verifyCandidate({ git: mkGit(join(f.dir, 'stale')), candidate: cand, base: f.base, passes });
    assert.equal(stale.ok, true, JSON.stringify(stale.problems)); assert.equal(stale.treeEqual, true);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a hand-resolved allow list is still caught: the rebuilt tree differs from a candidate someone edited', () => {
  const f = fixture();
  try {
    const p1 = f.pr('p1', doc('A', 'B', 'Z')), p2 = f.pr('p2', doc('A', 'C', 'Z'));
    f.ok(['switch', '-q', '-c', 'release-X', f.base]); mergeAll(f.git, 'X', [{ pr: 1, head: p1 }, { pr: 2, head: p2 }]);
    writeFileSync(join(f.dir, ALLOW), doc('A', 'B', 'C', 'Y', 'Z')); f.ok(['commit', '-q', '-a', '--amend', '--no-edit']);   // someone adds an entry inside the merge commit
    const v = verifyCandidate({ git: f.git, candidate: 'HEAD', base: f.base, passes: () => true });
    assert.equal(v.treeEqual, false, JSON.stringify(v.problems)); assert.equal(v.ok, false);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a true clash still reports the PR (the driver exits 1); a base without the script gets plain merge-tree arguments', () => {
  const f = fixture();
  try {
    const p3 = f.pr('p3', serialize({ tunables: [{ ...row('A'), reason: 'one' }, row('Z')] })), p4 = f.pr('p4', serialize({ tunables: [{ ...row('A'), reason: 'two' }, row('Z')] }));
    assert.deepEqual(rebuildTree(f.git, f.base, [{ pr: 3, head: p3 }, { pr: 4, head: p4 }]), { conflictAt: 4 });
    const none = driverArgs(f.git, f.old); assert.deepEqual(none.args, []); none.dispose();
    const some = driverArgs(f.git, f.base); assert.equal(some.args[0], '--attr-source'); assert.equal(some.args[1], f.base); assert.match(some.args[3], /^merge\.as-data-allow\.driver=node ".+merge-allow\.mjs" %O %A %B %P$/); some.dispose();
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('the driver the rebuild runs is the script of the tree being merged onto, not the checkout\'s; it leaves no file behind and writes no git config', () => {
  const f = fixture();
  try {
    const p1 = f.pr('p1', doc('A', 'B', 'Z')), p2 = f.pr('p2', doc('A', 'C', 'Z'));
    // A second base whose merge-allow.mjs differs from the checkout's copy by one comment line: the temp file must carry the TREE's bytes.
    f.ok(['switch', '-q', '-c', 'marked', f.base]); writeFileSync(join(f.dir, 'scripts/as-data/merge-allow.mjs'), `// marker\n${readFileSync(join(f.dir, 'scripts/as-data/merge-allow.mjs'), 'utf8')}`);
    f.ok(['commit', '-qam', 'marker']); const marked = f.ok(['rev-parse', 'HEAD']);
    f.ok(['switch', '-q', 'main']); f.ok(['checkout', '-q', '--detach', f.old]);   // the working tree now has NO script at all
    let seen = '', file = '';
    const spy = (args: string[]) => {
      const i = args.indexOf('merge-tree');
      if (i >= 0) { const m = /node "(.+)" %O/.exec(args.join(' ')); file = m![1]!; seen = readFileSync(file, 'utf8'); }
      return f.git(args);
    };
    const r = rebuildTree(spy, marked, [{ pr: 1, head: p1 }]);
    assert.ok('tree' in r, JSON.stringify(r));
    assert.ok(seen.startsWith('// marker\n'), 'the driver file carries the bytes of the tree being merged onto');
    assert.equal(existsSync(file), false, 'the temp driver is removed after the call'); assert.equal(existsSync(join(file, '..')), false);
    assert.notEqual(f.git(['config', '--get', 'merge.as-data-allow.driver']).status, 0, 'nothing is written to git config');
    void p2;
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('mutation check: without the driver arguments the same rebuild conflicts, so the treeEqual tests above are not passing by accident', () => {
  const f = fixture();
  try {
    const p1 = f.pr('p1', doc('A', 'B', 'Z')), p2 = f.pr('p2', doc('A', 'C', 'Z'));
    const strip = (args: string[]) => { const out = [...args], i = out.indexOf('--attr-source'); if (i >= 0) out.splice(i, 4); return f.git(out); };   // drop --attr-source <tree> -c <driver>
    assert.deepEqual(rebuildTree(strip, f.base, [{ pr: 1, head: p1 }, { pr: 2, head: p2 }]), { conflictAt: 2 });
    assert.ok('tree' in rebuildTree(f.git, f.base, [{ pr: 1, head: p1 }, { pr: 2, head: p2 }]), 'with the driver the same two PRs rebuild');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

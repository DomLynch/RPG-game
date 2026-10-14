import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ALLOW_DRIVER, mergeAll } from '../scripts/cut-release.mjs';
import { serialize } from '../scripts/as-data/merge-allow.mjs';

const REPO = new URL('..', import.meta.url).pathname;
const entry = (name: string, reason = 'r') => ({ file: 'x.ts', name, kind: 'debt', reason });
const doc = (...e: object[]) => serialize({ tunables: e });
const ALLOW = 'scripts/as-data/allow/src.json';

// A release worktree: the real script and .gitattributes on the base (or not), one allow list, PR branches cut from the base.
function fixture(withDriver: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'cut-driver-'));
  const git = (args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', timeout: 30_000 });
  const ok = (args: string[]) => { const r = git(args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  mkdirSync(join(dir, 'scripts/as-data/allow'), { recursive: true });
  if (withDriver) { copyFileSync(join(REPO, '.gitattributes'), join(dir, '.gitattributes')); copyFileSync(join(REPO, 'scripts/as-data/merge-allow.mjs'), join(dir, 'scripts/as-data/merge-allow.mjs')); }
  writeFileSync(join(dir, ALLOW), doc(entry('A'), entry('Z')));
  ok(['init', '-q', '-b', 'main']); ok(['add', '-A']); ok(['commit', '-q', '-m', 'base']);
  const pr = (name: string, ...rows: object[]) => { ok(['switch', '-q', '-c', name, 'main']); writeFileSync(join(dir, ALLOW), doc(...rows)); ok(['commit', '-qam', name]); return ok(['rev-parse', 'HEAD']); };
  return { dir, git, ok, pr, release: () => ok(['switch', '-q', '-c', 'release-X', 'main']) };
}

test('the cut merges allow-list PRs through the driver: adjacent additions merge, a true clash is still aborted and skipped, nothing is half merged', () => {
  const f = fixture(true);
  try {
    const p1 = f.pr('p1', entry('A'), entry('B'), entry('Z')), p2 = f.pr('p2', entry('A'), entry('C'), entry('Z'));
    const p3 = f.pr('p3', entry('A', 'one'), entry('Z')), p4 = f.pr('p4', entry('A', 'two'), entry('Z'));
    f.release();
    const out = mergeAll(f.git, 'X', [{ pr: 1, head: p1 }, { pr: 2, head: p2 }, { pr: 3, head: p3 }, { pr: 4, head: p4 }]);
    assert.deepEqual(out.merged, [1, 2, 3]);
    assert.deepEqual(out.skipped.map(s => s.pr), [4]);
    assert.match(out.skipped[0].why, /conflicts in scripts\/as-data\/allow\/src\.json/);
    assert.deepEqual(out.driverResolved, { 2: [ALLOW], 3: [ALLOW] }, 'the files the driver resolved are named per PR, for the contents-check');
    assert.equal(f.git(['status', '--porcelain']).stdout.trim(), '', 'the aborted clash leaves a clean tree');
    const text = readFileSync(join(f.dir, ALLOW), 'utf8');
    assert.ok(!text.includes('<<<<<<<'));
    assert.deepEqual((JSON.parse(text).tunables as { name: string; reason: string }[]).map(e => `${e.name}:${e.reason}`), ['A:one', 'B:r', 'C:r', 'Z:r']);
    assert.notEqual(f.git(['config', '--get', 'merge.as-data-allow.driver']).status, 0, 'the driver is passed per call, never written to the shared git config');
    assert.match(ALLOW_DRIVER, /^merge\.as-data-allow\.driver=node scripts\/as-data\/merge-allow\.mjs %O %A %B %P$/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a base that does not carry the script merges as before (git\'s line merge): the same adjacent additions conflict and are skipped', () => {
  const f = fixture(false);
  try {
    const p1 = f.pr('p1', entry('A'), entry('B'), entry('Z')), p2 = f.pr('p2', entry('A'), entry('C'), entry('Z'));
    f.release();
    const out = mergeAll(f.git, 'X', [{ pr: 1, head: p1 }, { pr: 2, head: p2 }]);
    assert.deepEqual(out.merged, [1]); assert.deepEqual(out.skipped.map(s => s.pr), [2]);
    assert.deepEqual(out.driverResolved, {});
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

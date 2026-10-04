// scripts/lib/prune-releases.sh: keep KEEP releases in total, current and previous always among them; --dry-run removes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, utimesSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'lib', 'prune-releases.sh');
const sha = (i: number) => i.toString(16).padStart(40, '0');

// 30 releases, release i one minute newer than i-1; current -> newest, previous -> the oldest (a rollback target far back).
function fixture(opts: { current?: number; previous?: number } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'prune-'));
  const t0 = Date.now() / 1000 - 3600;
  for (let i = 1; i <= 30; i++) {
    const dir = join(root, 'releases', sha(i));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), `release ${i}`);
    utimesSync(dir, t0 + i * 60, t0 + i * 60);
  }
  mkdirSync(join(root, 'releases', 'not-a-sha'));
  symlinkSync(join(root, 'releases', sha(opts.current ?? 30)), join(root, 'current'));
  symlinkSync(join(root, 'releases', sha(opts.previous ?? 1)), join(root, 'previous'));
  return root;
}
const run = (root: string, ...args: string[]) => spawnSync('bash', [script, root, ...args], { encoding: 'utf8' });
const left = (root: string) => readdirSync(join(root, 'releases')).sort();

test('KEEP=5 keeps current, previous and the 3 newest others (5 in total), leaves non-sha dirs alone', () => {
  const root = fixture();
  const r = run(root, '5');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /5 kept .* 25 to remove/);
  assert.deepEqual(left(root), [sha(1), sha(27), sha(28), sha(29), sha(30), 'not-a-sha'].sort());
  rmSync(root, { recursive: true });
});

test('previous == current counts once: KEEP=5 keeps current and the 4 newest others', () => {
  const root = fixture({ previous: 30 });
  assert.equal(run(root, '5').status, 0);
  assert.deepEqual(left(root), [sha(26), sha(27), sha(28), sha(29), sha(30), 'not-a-sha'].sort());
  rmSync(root, { recursive: true });
});

test('--dry-run lists what it would remove and removes nothing', () => {
  const root = fixture();
  const before = left(root);
  const r = run(root, '5', '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.equal((r.stdout.match(/would remove releases\//g) || []).length, 25);
  assert.deepEqual(left(root), before);
  rmSync(root, { recursive: true });
});

test('current is kept even when it is not among the newest (after a rollback)', () => {
  const root = fixture({ current: 3, previous: 30 });
  assert.equal(run(root, '5').status, 0);
  assert.deepEqual(left(root), [sha(3), sha(28), sha(29), sha(30), sha(27), 'not-a-sha'].sort());
  rmSync(root, { recursive: true });
});

test('a symlinked release dir is never a candidate, so current through it cannot dangle', () => {
  const root = fixture();
  // releases/<sha 99> -> releases/<sha 2> (old, outside the newest 20); current goes through the link.
  symlinkSync(join(root, 'releases', sha(2)), join(root, 'releases', sha(99)));
  spawnSync('touch', ['-h', '-t', '200001010000', join(root, 'releases', sha(99))]);  // the link itself is the oldest entry
  rmSync(join(root, 'current'));
  symlinkSync(join(root, 'releases', sha(99)), join(root, 'current'));
  const r = run(root, '5');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(left(root).includes(sha(99)), 'the symlink itself is left alone');
  assert.ok(existsSync(join(root, 'current', 'index.html')), 'current still resolves');
  rmSync(root, { recursive: true });
});

test('refuses a KEEP below 2 and a current outside releases/', () => {
  const root = fixture();
  assert.equal(run(root, '1').status, 2);
  assert.equal(run(root, 'x').status, 2);
  rmSync(join(root, 'current'));
  symlinkSync(tmpdir(), join(root, 'current'));
  assert.equal(run(root, '5').status, 3);
  assert.equal(left(root).length, 31);
  rmSync(root, { recursive: true });
});

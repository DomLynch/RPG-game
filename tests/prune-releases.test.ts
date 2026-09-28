// scripts/lib/prune-releases.sh: keep the newest KEEP releases plus whatever current/previous point to; --dry-run removes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, utimesSync, readdirSync, rmSync } from 'node:fs';
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

test('keeps the newest 20 plus previous, removes the other 9, leaves non-sha dirs alone', () => {
  const root = fixture();
  const r = run(root, '20');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /21 kept .* 9 to remove/);
  const expected = [sha(1), ...Array.from({ length: 20 }, (_, k) => sha(11 + k)), 'not-a-sha'].sort();
  assert.deepEqual(left(root), expected);
  rmSync(root, { recursive: true });
});

test('--dry-run lists what it would remove and removes nothing', () => {
  const root = fixture();
  const before = left(root);
  const r = run(root, '20', '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.equal((r.stdout.match(/would remove releases\//g) || []).length, 9);
  assert.deepEqual(left(root), before);
  rmSync(root, { recursive: true });
});

test('current is kept even when it is not among the newest (after a rollback)', () => {
  const root = fixture({ current: 3, previous: 30 });
  assert.equal(run(root, '20').status, 0);
  assert.ok(left(root).includes(sha(3)));
  assert.ok(left(root).includes(sha(30)));
  rmSync(root, { recursive: true });
});

test('refuses a KEEP below 2 and a current outside releases/', () => {
  const root = fixture();
  assert.equal(run(root, '1').status, 2);
  assert.equal(run(root, 'x').status, 2);
  rmSync(join(root, 'current'));
  symlinkSync(tmpdir(), join(root, 'current'));
  assert.equal(run(root, '20').status, 3);
  assert.equal(left(root).length, 31);
  rmSync(root, { recursive: true });
});

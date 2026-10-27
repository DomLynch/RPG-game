// scripts/lib/prune-releases.sh: keep KEEP releases in total, current and previous always among them; --dry-run removes nothing.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
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

// The writer's install layout since 2026-10-20: /opt/frankendom-origins/<40 hex> (the full sha), `current` and `previous` beside them. The origins match was 8 hex only, so it matched none of these
// and the installer's keep-5 prune never removed a tree (55 dirs, 20 GB by 2026-10-21). 8 hex (old names) and exactly 40 both prune; 9..39 or 41 hex, upper case and non-hex names are never touched.
test('origins layout: 40-hex and 8-hex installs are pruned, current/previous are kept even when oldest, other names are never touched', () => {
  const root = mkdtempSync(join(tmpdir(), 'prune-origins40-'));
  const t0 = Date.now() / 1000 - 3600;
  const full = (i: number) => sha(i);                 // 40 hex
  const short = (i: number) => sha(i).slice(-8);      // 8 hex
  const mk = (name: string, age: number) => { const d = join(root, name); mkdirSync(d); writeFileSync(join(d, 'f'), name); utimesSync(d, t0 + age * 60, t0 + age * 60); };
  for (let i = 1; i <= 10; i++) mk(full(i), i);         // 10 full-sha installs, 1 oldest
  for (let i = 11; i <= 13; i++) mk(short(i), i);       // 3 old 8-hex installs, newer than the full ones
  const odd = ['abcdef012', sha(5).slice(-39), sha(5) + '0', 'ABCDEF01', 'keep-me', 'zzzzzzzz'];   // 9 hex, 39 hex, 41 hex, upper case, words, 8 non-hex
  for (const name of odd) mkdir(name);
  symlinkSync(join(root, short(13)), join(root, 'current'));
  symlinkSync(join(root, full(1)), join(root, 'previous'));   // the rollback target is the OLDEST install
  const dry = run(root, '5', '--dry-run', 'origins');
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /5 kept .* 8 to remove/);
  const before = readdirSync(root).sort();
  const real = run(root, '5', '', 'origins');
  assert.equal(real.status, 0, real.stdout + real.stderr);
  // kept: current (13), previous (the oldest full, 1), then the 3 newest others (12, 11, 10); everything else hex is gone; odd names and both symlinks stay.
  assert.deepEqual(readdirSync(root).sort(), [short(13), full(1), short(12), short(11), full(10), 'current', 'previous', ...odd].sort());
  assert.ok(before.length > readdirSync(root).length);
  rmSync(root, { recursive: true });
  function mkdir(name: string) { mkdirSync(join(root, name)); }
});

// Older layout: /opt/frankendom-origins/<8 hex>, `current` beside them, no `previous`.
test('origins layout: KEEP=5 keeps current and the 4 newest others, leaves other names alone, --dry-run removes nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'prune-origins-'));
  const t0 = Date.now() / 1000 - 3600;
  for (let i = 1; i <= 12; i++) { const d = join(root, sha(i).slice(-8)); mkdirSync(d); writeFileSync(join(d, 'f'), String(i)); utimesSync(d, t0 + i * 60, t0 + i * 60); }
  mkdirSync(join(root, 'keep-me'));
  symlinkSync(join(root, sha(12).slice(-8)), join(root, 'current'));
  const before = readdirSync(root).sort();
  const dry = run(root, '5', '--dry-run', 'origins');
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /5 kept .* 7 to remove/);
  assert.deepEqual(readdirSync(root).sort(), before);
  const real = run(root, '5', '', 'origins');
  assert.equal(real.status, 0, real.stdout + real.stderr);
  assert.deepEqual(readdirSync(root).sort(), [...[8, 9, 10, 11, 12].map((i) => sha(i).slice(-8)), 'current', 'keep-me'].sort());
  rmSync(root, { recursive: true });
});

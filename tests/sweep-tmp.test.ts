// ops/sweep-tmp.sh against a throwaway root: only old, unopened top-level dirs go; claude-*, dot-dirs, systemd-private-*, files, symlinks, fresh and open dirs stay; /opt, /mnt and friends are refused.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const script = resolve(import.meta.dirname, '..', 'ops', 'sweep-tmp.sh');

function scratch() {
  // Under /tmp on every host: macOS's tmpdir() is /var/folders/..., a protected root the script refuses (as it should); /tmp is /private/tmp there, which it allows.
  const base = mkdtempSync(join('/tmp', 'sweep-tmp-'));
  const root = join(base, 'tmp');
  const outside = join(base, 'outside');
  mkdirSync(root); mkdirSync(outside);
  writeFileSync(join(outside, 'keep.txt'), 'x');
  for (const d of ['ci-trust-old', 'ci-trust-open', 'claude-1003', '.hidden', 'systemd-private-abc', 'ci-trust-mixed', 'ci-trust-fresh', 'ci-trust-old name with spaces', 'tmux-0', 'snap-private-tmp', 'old-unlisted', 'ci-trust-linked']) {
    mkdirSync(join(root, d)); writeFileSync(join(root, d, 'f.txt'), 'x');
  }
  writeFileSync(join(root, 'plain-old-file.txt'), 'x');
  for (const f of ['dist-old.tgz', 'dist-fresh.tgz', 'dist-open.tgz', 'dist-linked.tgz', 'dist-held.tgz', 'other-old.tgz']) writeFileSync(join(root, f), 'x');
  // a symlink elsewhere points at dist-linked.tgz and at the ci-trust-linked dir (SWEEP_LINK_SCAN): both are symlink targets, never swept; the capture holder file names dist-held.tgz
  mkdirSync(join(base, 'links'));
  symlinkSync(join(root, 'dist-linked.tgz'), join(base, 'links', 'a'));
  symlinkSync(join(root, 'ci-trust-linked'), join(base, 'links', 'b'));
  writeFileSync(join(base, 'holder.1'), 'job uses dist-held.tgz\n');
  symlinkSync(outside, join(root, 'link-to-outside'));
  writeFileSync(join(root, 'ci-trust-mixed', 'new.txt'), 'x');
  // Three days old, set through node rather than GNU `touch -d '3 days ago'` (BSD touch on the Mac rejects it, so nothing aged and two tests went red there).
  // Symlinks are never touched (utimes would follow them); ci-trust-fresh and ci-trust-mixed/new.txt stay new.
  const old = (Date.now() - 3 * 24 * 3600_000) / 1000;
  const age = (path: string) => {
    if (lstatSync(path).isSymbolicLink() || path.startsWith(join(root, 'ci-trust-fresh')) || path === join(root, 'dist-fresh.tgz') || path === join(root, 'ci-trust-mixed', 'new.txt')) return;
    if (lstatSync(path).isDirectory()) for (const name of readdirSync(path)) age(join(path, name));
    utimesSync(path, old, old);
  };
  for (const name of readdirSync(root)) age(join(root, name));
  const lsof = join(base, 'lsof');
  writeFileSync(lsof, '#!/bin/bash\nprintf "p1\\nn/etc/passwd\\nn%s/ci-trust-open/f.txt\\nn%s/dist-open.tgz\\n" "$SWEEP_ROOT" "$SWEEP_ROOT"\nexit 1\n');
  chmodSync(lsof, 0o755);
  return { base, root, outside, lsof };
}
const guards = (s: ReturnType<typeof scratch>) => ({ SWEEP_MANIFEST: join(s.base, 'manifest', 'removed.txt'), SWEEP_LINK_SCAN: join(s.base, 'links'), SWEEP_HOLD_FILES: join(s.base, 'holder.*'), SWEEP_RELEASE_LOCK: join(s.base, 'no-release-lock') });
const run = (s: ReturnType<typeof scratch>, ...args: string[]) => spawnSync('bash', [script, ...args], { encoding: 'utf8', env: { ...process.env, ...guards(s), SWEEP_ROOT: s.root, LSOF: s.lsof } });

test('removes only old, unopened top-level dirs and logs df before/after and each removal', () => {
  const s = scratch();
  try {
    const r = run(s);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!existsSync(join(s.root, 'ci-trust-old')), 'old dir removed');
    assert.ok(!existsSync(join(s.root, 'ci-trust-old name with spaces')), 'old dir with spaces in its name removed');
    for (const keep of ['ci-trust-open', 'claude-1003', '.hidden', 'systemd-private-abc', 'ci-trust-mixed', 'ci-trust-fresh', 'ci-trust-linked', 'tmux-0', 'snap-private-tmp', 'old-unlisted', 'plain-old-file.txt', 'link-to-outside']) {
      assert.ok(existsSync(join(s.root, keep)), `${keep} stays`);
    }
    assert.ok(existsSync(join(s.outside, 'keep.txt')), 'a symlink is never followed');
    assert.match(r.stdout, /df before:/); assert.match(r.stdout, /df after:/);
    assert.match(r.stdout, /removed ci-trust-old/); assert.match(r.stdout, /keep ci-trust-open \(open handle\)/);
    assert.match(r.stdout, /2 dir\(s\) removed/);
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

test('fails closed when lsof fails or prints nothing: nothing is removed', () => {
  const s = scratch();
  try {
    for (const bad of ['/nonexistent/lsof', 'true']) {
      const r = spawnSync('bash', [script], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: s.root, LSOF: bad } });
      assert.equal(r.status, 3, `${bad}: ${r.stdout}`);
      assert.ok(existsSync(join(s.root, 'ci-trust-old')), 'nothing removed');
    }
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

test('--dry-run removes nothing', () => {
  const s = scratch();
  try {
    const r = run(s, '--dry-run');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(s.root, 'ci-trust-old')));
    assert.match(r.stdout, /would remove ci-trust-old/);
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

test('refuses /opt, /mnt, home and a symlink that resolves into them', () => {
  const s = scratch();
  try {
    symlinkSync('/opt', join(s.base, 'via-link'));
    // macOS has no /mnt (a missing root exits 1, not the refusal): check only the protected roots this host has. Linux has all of them.
    for (const root of ['/opt', '/mnt', '/home', '/', join(s.base, 'via-link')].filter((r) => existsSync(r))) {
      const r = spawnSync('bash', [script, '--dry-run'], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: root, LSOF: s.lsof } });
      assert.equal(r.status, 2, `${root} is refused`);
      assert.match(r.stdout, /refusing root/);
    }
    // The macOS spellings of the same roots (firmlinks: /home is /System/Volumes/Data/home, /var is /private/var) are refused on every host, judged as given.
    for (const root of ['/System/Volumes/Data/home', '/System/Volumes/Data/home/dom', '/private/var/folders', '/private/etc', '/Users/dom', '/home/']) {
      const r = spawnSync('bash', [script, '--dry-run'], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: root, LSOF: s.lsof } });
      assert.equal(r.status, 2, `${root} is refused`);
      assert.match(r.stdout, /refusing root/);
    }
    const bad = spawnSync('bash', [script], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: s.root, SWEEP_AGE_HOURS: '0', LSOF: s.lsof } });
    assert.equal(bad.status, 2, 'an age below 1 hour is rejected');
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

test('files: only old, unopened, unlinked, unheld *dist*.tgz go; the manifest lists each removal with size and mtime', () => {
  const s = scratch();
  try {
    const r = run(s);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!existsSync(join(s.root, 'dist-old.tgz')), 'old dist archive removed');
    for (const keep of ['dist-fresh.tgz', 'dist-open.tgz', 'dist-linked.tgz', 'dist-held.tgz', 'other-old.tgz', 'plain-old-file.txt']) assert.ok(existsSync(join(s.root, keep)), `${keep} stays`);
    assert.match(r.stdout, /removed file dist-old\.tgz/); assert.match(r.stdout, /keep dist-open\.tgz \(open handle\)/);
    assert.match(r.stdout, /keep dist-linked\.tgz \(symlink target\)/); assert.match(r.stdout, /keep dist-held\.tgz \(capture lock\)/);
    assert.match(r.stdout, /keep ci-trust-linked \(symlink target\)/); assert.match(r.stdout, /1 file\(s\) removed/);
    const lines = readFileSync(join(s.base, 'manifest', 'removed.txt'), 'utf8').trim().split('\n');
    assert.ok(lines.some((l) => /^.*\/dist-old\.tgz\t\d+K\t\d+$/.test(l)), `manifest has path, size, mtime: ${lines.join('|')}`);
    assert.ok(lines.some((l) => l.includes('/ci-trust-old\t')), 'a removed dir is in the manifest too');
    assert.ok(!lines.some((l) => l.includes('dist-open')), 'a kept file is not in the manifest');
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

test('files: --dry-run removes nothing and writes no manifest', () => {
  const s = scratch();
  try {
    const before = readdirSync(s.root).sort();
    const r = run(s, '--dry-run');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readdirSync(s.root).sort(), before, 'every entry still there');
    assert.match(r.stdout, /would remove file dist-old\.tgz/); assert.match(r.stdout, /1 file\(s\) would be removed/);
    assert.ok(!existsSync(join(s.base, 'manifest')), 'no manifest in a dry run');
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

test('removes nothing while the release lock exists', () => {
  const s = scratch();
  try {
    writeFileSync(join(s.base, 'no-release-lock'), '');
    const r = run(s);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /release lock .* present, removing nothing/);
    assert.ok(existsSync(join(s.root, 'dist-old.tgz')) && existsSync(join(s.root, 'ci-trust-old')), 'nothing removed');
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

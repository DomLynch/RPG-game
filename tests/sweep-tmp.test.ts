// ops/sweep-tmp.sh against a throwaway root: only old, unopened top-level dirs go; claude-*, dot-dirs, systemd-private-*, files, symlinks, fresh and open dirs stay; /opt, /mnt and friends are refused.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const script = resolve(import.meta.dirname, '..', 'ops', 'sweep-tmp.sh');
const sh = (cmd: string) => spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });

function scratch() {
  const base = mkdtempSync(join(tmpdir(), 'sweep-tmp-'));
  const root = join(base, 'tmp');
  const outside = join(base, 'outside');
  mkdirSync(root); mkdirSync(outside);
  writeFileSync(join(outside, 'keep.txt'), 'x');
  for (const d of ['ci-trust-old', 'ci-trust-open', 'claude-1003', '.hidden', 'systemd-private-abc', 'ci-trust-mixed', 'ci-trust-fresh', 'ci-trust-old name with spaces', 'tmux-0', 'snap-private-tmp', 'old-unlisted']) {
    mkdirSync(join(root, d)); writeFileSync(join(root, d, 'f.txt'), 'x');
  }
  writeFileSync(join(root, 'plain-old-file.txt'), 'x');
  symlinkSync(outside, join(root, 'link-to-outside'));
  writeFileSync(join(root, 'ci-trust-mixed', 'new.txt'), 'x');
  sh(`find '${root}' -mindepth 1 -not -path '${root}/ci-trust-fresh*' -not -path '${root}/ci-trust-mixed/new.txt' -not -type l -exec touch -d '3 days ago' {} +`);
  sh(`touch -d '3 days ago' '${root}/ci-trust-mixed'`);
  const lsof = join(base, 'lsof');
  writeFileSync(lsof, '#!/bin/bash\nprintf "p1\\nn/etc/passwd\\nn%s/ci-trust-open/f.txt\\n" "$SWEEP_ROOT"\nexit 1\n');
  chmodSync(lsof, 0o755);
  return { base, root, outside, lsof };
}
const run = (s: ReturnType<typeof scratch>, ...args: string[]) => spawnSync('bash', [script, ...args], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: s.root, LSOF: s.lsof } });

test('removes only old, unopened top-level dirs and logs df before/after and each removal', () => {
  const s = scratch();
  try {
    const r = run(s);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!existsSync(join(s.root, 'ci-trust-old')), 'old dir removed');
    assert.ok(!existsSync(join(s.root, 'ci-trust-old name with spaces')), 'old dir with spaces in its name removed');
    for (const keep of ['ci-trust-open', 'claude-1003', '.hidden', 'systemd-private-abc', 'ci-trust-mixed', 'ci-trust-fresh', 'tmux-0', 'snap-private-tmp', 'old-unlisted', 'plain-old-file.txt', 'link-to-outside']) {
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
    for (const root of ['/opt', '/mnt', '/home', '/', join(s.base, 'via-link')]) {
      const r = spawnSync('bash', [script, '--dry-run'], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: root, LSOF: s.lsof } });
      assert.equal(r.status, 2, `${root} is refused`);
      assert.match(r.stdout, /refusing root/);
    }
    const bad = spawnSync('bash', [script], { encoding: 'utf8', env: { ...process.env, SWEEP_ROOT: s.root, SWEEP_AGE_HOURS: '0', LSOF: s.lsof } });
    assert.equal(bad.status, 2, 'an age below 1 hour is rejected');
  } finally { rmSync(s.base, { recursive: true, force: true }); }
});

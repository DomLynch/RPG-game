// ops/vps-scratch-sweep --path (Lead 2026-10-13): which paths the named-path mode may remove. sweep_kind() is sourced with SWEEP_SOURCE_ONLY=1, so no lock, log, disk or gh is touched.
// The live tool runs on the VPS (bash 5); the file is parsed by that bash, so this test needs a Linux bash.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const kind = (path: string) => {
  const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_kind "$1"', 'x', path], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

test('sweep_kind: the lane roots keep the archive-first rule', () => {
  assert.equal(kind('/opt/frankendom-shadow/work/deploy-dl'), 'lane');
  assert.equal(kind('/srv/dev-jobs/cq-pg-1'), 'lane');
  assert.equal(kind('/opt/frankendom-shadow/scratch-retirement-20261013'), 'lane');
});

test('sweep_kind: be-*, hooks-* and cq-* are aged roots, direct children of /var/tmp or /tmp only', () => {
  for (const p of ['/var/tmp/be-eb5eba4c', '/tmp/hooks-review-2546', '/tmp/hooks-ci', '/tmp/cq-2430wt']) assert.equal(kind(p), 'aged', p);
  for (const p of ['/var/tmp/be-eb5eba4c/sub', '/tmp/hooks-x/sub', '/tmp/cq-x/y', '/tmp/be-eb5eba4c', '/var/tmp/hooks-x', '/var/tmp/cq-x']) assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: the six retired lane homes and the two /tmp one-offs, exactly; the live homes and everything else are refused', () => {
  for (const n of ['char-cd', 'deploy-b', 'char-20b', 'char-boss', 'char-lg', 'combat-b']) assert.equal(kind(`/home/lanes/frankendom-${n}`), 'home', n);
  for (const p of ['/tmp/node-compile-cache', '/tmp/lead-env-tab4']) assert.equal(kind(p), 'tmp', p);
  for (const p of ['/home/lanes/frankendom-backend', '/home/lanes/frankendom-char', '/home/lanes', '/home/lanes/.claude', '/home/lanes/.spill-tools', '/home/lanes/frankendom-char-cd/node_modules',
    '/tmp/lm', '/tmp/claude-1003', '/tmp/rank-job', '/tmp', '/var/tmp', '/root', '/etc', '/', '/opt/frankendom-shadow', '/opt/frankendom-shadow/work', '/srv/dev-jobs'])
    assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: odd paths are refused', () => {
  for (const p of ['/tmp/hooks-x/../etc', '/var/tmp/be-a b', '/srv/dev-jobs/../../etc', '/tmp/hooks-..']) assert.equal(kind(p), '', p);
});

test('the only roots in the file are the ones sweep_kind lists (a new root has to be added there, with a test)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const named = src.slice(src.indexOf('if [ -n "$PATHS" ]; then'), src.indexOf('# work/: lane scratch'));
  assert.ok(!/\/opt\/frankendom-shadow\/work\/\*\|/.test(named) && /sweep_kind "\$p"/.test(named), 'the named-path loop decides through sweep_kind, not a second inline list');
});

// Auditor on #2624 (reproduced on the VPS, coreutils 9.4): `/tmp/cq-x/` with a trailing slash passed `[ ! -L ]` (it follows the link), then `rm -rf -- "x/"` emptied the link's TARGET as root;
// /tmp and /var/tmp are world-writable, so a planted link could wipe /opt or a home. The existing lane roots had the same hole. These tests use REAL planted links in a temp dir.
// sweep_kind is stubbed to "lane" so the canonical-path logic is tested apart from which roots are allowed (that is the sweep_kind tests above).
const safe = (path: string) => spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_kind() { echo lane; }; sweep_safe_path "$1"', 'x', path], { encoding: 'utf8' });
const sandbox = () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'sweep-safe-')));
  const real = join(base, 'real'), target = join(base, 'precious-target');
  mkdirSync(real); mkdirSync(target); writeFileSync(join(target, 'keep.txt'), 'must survive');
  symlinkSync(target, join(base, 'cq-planted'));             // a link planted where a root is expected
  symlinkSync(join(base, 'does-not-exist'), join(base, 'cq-dangling'));
  symlinkSync(target, join(base, 'parent-link'));            // a link as a MIDDLE component
  mkdirSync(join(target, 'child'));
  writeFileSync(join(base, 'a-file'), 'x');
  return { base, real, target };
};

test('sweep_safe_path: a real canonical directory passes', () => {
  const { base, real } = sandbox();
  try { const r = safe(real); assert.equal(r.status, 0, r.stdout + r.stderr); } finally { rmSync(base, { recursive: true, force: true }); }
});

test('sweep_safe_path: a trailing slash, a planted symlink (also with a slash), a dangling link, a link in the middle, .., //, a relative path and a file are all refused', () => {
  const { base, real } = sandbox();
  try {
    const refused: Record<string, RegExp> = {
      [`${real}/`]: /not canonical/, [`${join(base, 'cq-planted')}/`]: /not canonical/, [join(base, 'cq-planted')]: /is a symlink/, [join(base, 'cq-dangling')]: /is a symlink/,
      [join(base, 'parent-link', 'child')]: /path component is a symlink/, [`${base}/real/../real`]: /not canonical/, [`${base}//real`]: /not canonical/,
      'relative/dir': /not an absolute path/, [join(base, 'a-file')]: /not a real directory/, [join(base, 'missing')]: /not a real directory/,
    };
    for (const [path, why] of Object.entries(refused)) {
      const r = safe(path);
      assert.equal(r.status, 1, `${path} must be refused: ${r.stdout}`);
      assert.match(r.stdout, why, path);
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('sweep_safe_path: the resolved path must stay inside an allowed root, and sweep_kind itself refuses a trailing slash', () => {
  const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_safe_path "$1"', 'x', '/etc'], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stdout, /outside the allowed roots/);
  for (const p of ['/tmp/cq-x/', '/var/tmp/be-abc/', '/tmp/hooks-x/', '/srv/dev-jobs/x/', '/opt/frankendom-shadow/work/x/', '/home/lanes/frankendom-char-cd/', '/tmp//cq-x', '/tmp/cq-x/.'])
    assert.equal(kind(p), '', `${p} is refused`);
});

// lsof +D can time out on a big tree; the old probe then fell through to "not in use". It must fail closed.
const inUse = (dir: string, lsofExit: number, lsofSleep = 0) => {
  const bin = mkdtempSync(join(tmpdir(), 'fake-lsof-')), lsof = join(bin, 'lsof');
  writeFileSync(lsof, `#!/bin/sh\n${lsofSleep ? `sleep ${lsofSleep}\n` : ''}exit ${lsofExit}\n`); chmodSync(lsof, 0o755);
  try { return spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_in_use "$1"', 'x', dir], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LSOF_TIMEOUT: '1' } }).status; }
  finally { rmSync(bin, { recursive: true, force: true }); }
};

test('sweep_in_use fails closed: only a clean "nothing open" (lsof exit 1) means not in use; a hit, a timeout and an unexpected exit all mean in use', () => {
  const { base, real } = sandbox();
  try {
    assert.equal(inUse(real, 1), 1, 'lsof exit 1 = nothing open = safe to remove');
    assert.equal(inUse(real, 0), 0, 'lsof found an open file = in use');
    assert.equal(inUse(real, 1, 5), 0, 'lsof timed out (killed after 1 s) = could not tell = in use');
    assert.equal(inUse(real, 2), 0, 'an unexpected lsof exit = could not tell = in use');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('sweep_in_use: a process whose cwd is inside the dir (or below it) makes it in use', () => {
  const { base, real } = sandbox();
  const child = spawn('sleep', ['30'], { cwd: real });
  try { assert.equal(inUse(real, 1), 0, 'a live process has its cwd there'); } finally { child.kill(); rmSync(base, { recursive: true, force: true }); }
});


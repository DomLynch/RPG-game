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
  for (const p of ['/var/tmp/be-eb5eba4c/sub', '/tmp/hooks-x/sub', '/tmp/cq-x/y', '/var/tmp/hooks-x', '/var/tmp/cq-x']) assert.equal(kind(p), '', `${p} is refused`);
});

// /tmp/rank-job left this refused list on 2026-10-14: Lead ruled it a standing aged root (see the test below), so it is pinned there now.
test('sweep_kind: the six retired lane homes and the two /tmp one-offs, exactly; the live homes and everything else are refused', () => {
  for (const n of ['char-cd', 'deploy-b', 'char-20b', 'char-boss', 'char-lg', 'combat-b']) assert.equal(kind(`/home/lanes/frankendom-${n}`), 'home', n);
  for (const p of ['/tmp/node-compile-cache', '/tmp/lead-env-tab4']) assert.equal(kind(p), 'tmp', p);
  for (const p of ['/home/lanes/frankendom-backend', '/home/lanes/frankendom-char', '/home/lanes', '/home/lanes/.claude', '/home/lanes/.spill-tools', '/home/lanes/frankendom-char-cd/node_modules',
    '/tmp', '/var/tmp', '/root', '/etc', '/', '/opt/frankendom-shadow', '/opt/frankendom-shadow/work', '/srv/dev-jobs'])
    assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: /tmp/rank-job and /root/cnNN are aged roots, exact (Lead 2026-10-14); lookalikes, children and other parents are refused', () => {
  for (const p of ['/tmp/rank-job', '/root/cn1', '/root/cn20', '/root/cn007']) assert.equal(kind(p), 'aged', p);
  for (const p of ['/tmp/rank-job/sub', '/var/tmp/rank-job', '/rank-job', '/root/cn', '/root/cnx1', '/root/cn1a', '/root/cn1x', '/root/cn1/sub', '/root/cn1/', '/root/.claude', '/root', '/home/lanes/cn1', '/root/xcn1']) assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: odd paths are refused', () => {
  for (const p of ['/tmp/hooks-x/../etc', '/var/tmp/be-a b', '/srv/dev-jobs/../../etc', '/tmp/hooks-..']) assert.equal(kind(p), '', p);
});

// Strategy 2026-10-15: finished build output in /tmp (about 20 GB) is swept by exact path as a "lane" kind (archive first, then delete). /tmp/lm and /tmp/claude-1003 were pinned as refused
// before this; they are lane scratch now, still only by an exact path and still refused while anything runs inside (sweep_in_use).
test('sweep_kind: an exact direct child of /tmp is a lane (archive first); a bare /tmp, a trailing slash, a glob, a child of a child and other parents are refused', () => {
  for (const p of ['/tmp/lm', '/tmp/claude-1003', '/tmp/finished-build-2026', '/tmp/a.b_c-1', '/tmp/be-eb5eba4c', '/tmp/rank-job2', '/tmp/rank-jobs', '/tmp/cn1']) assert.equal(kind(p), 'lane', p);   // lookalikes of the older /tmp roots are plain exact children now
  for (const p of ['/tmp', '/tmp/', '/tmp//', '/tmp/*', '/tmp/a*', '/tmp/*/x', '/tmp/a?', '/tmp/[ab]', '/tmp/x/y', '/tmp/x/', '/tmp/./x', '/tmp/../etc', '/tmp/a b', '/var/tmp/x', '/private/tmp/x', '/x/tmp/y'])
    assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_kind: the specific /tmp roots keep their own kind; the new /tmp lane arm is last and never overrides them', () => {
  for (const [p, k] of [['/tmp/hooks-ci', 'aged'], ['/tmp/cq-2430wt', 'aged'], ['/tmp/rank-job', 'aged'], ['/tmp/node-compile-cache', 'tmp'], ['/tmp/lead-env-tab4', 'tmp']]) assert.equal(kind(p), k, p);
});

// A symlink in /tmp pointing out of it is refused by sweep_safe_path with the real sweep_kind (a Linux /tmp; the live tool runs on the VPS).
test('sweep_safe_path: a symlink in /tmp that points out of /tmp is refused, with and without a trailing slash', { skip: process.platform !== 'linux' }, () => {
  const inside = mkdtempSync(join('/tmp', 'sweep-lane-')), outside = mkdtempSync(join(process.cwd(), '.sweep-outside-'));
  const link = join('/tmp', `sweep-link-${process.pid}`);
  try {
    writeFileSync(join(outside, 'keep.txt'), 'must survive');
    symlinkSync(outside, link);
    const run = (p: string) => spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_safe_path "$1"', 'x', p], { encoding: 'utf8' });
    assert.equal(run(link).status, 1); assert.match(run(link).stdout, /symlink/);
    assert.equal(run(`${link}/`).status, 1);
    assert.equal(run(inside).status, 0, 'a real exact child of /tmp passes');
  } finally { rmSync(link, { force: true }); rmSync(inside, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
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

// Lead 2026-10-13: nobody should reach the scheduled (bare) sweep, with its blanket /tmp delete, by accident. A mistyped `--help` ran the whole dry run and held the lock 6+ minutes.
// Only REFUSAL paths are executed here: they exit before the lock, the log or any disk is touched. The scheduled path is asserted from the source, never run.
const run = (args: string[], env: Record<string, string> = {}) => spawnSync('bash', ['ops/vps-scratch-sweep', ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });

test('bare mode: no arguments, --help, an unknown flag and --force alone are refused with usage (exit 2)', () => {
  for (const args of [[], ['--help'], ['-h'], ['--forse'], ['--force'], ['--apply', '--bogus']]) {
    const r = run(args);
    assert.equal(r.status, 2, `${args.join(' ') || '(no args)'} -> ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /usage|vps-scratch-sweep --path=/i);
    assert.equal(r.stdout, '', 'nothing but usage on stderr: no sweep output');
  }
  assert.match(run(['--help']).stderr, /unknown argument '--help'/);
});

test('bare mode: --apply without SWEEP_SCHEDULED=1 is refused (a hand-typed --apply can no longer reach the blanket /tmp delete)', () => {
  const r = run(['--apply']);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /bare mode is the scheduled sweep only/);
  assert.equal(run(['--apply', '--force']).status, 2);
  assert.equal(run(['--apply'], { SWEEP_SCHEDULED: '0' }).status, 2);
});

test('the guard sits before the log, the lock and the disk, and the scheduled form is exactly SWEEP_SCHEDULED=1 with --apply and no --path', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const guard = src.indexOf('the bare mode is the scheduled sweep only');
  assert.ok(guard > 0 && guard < src.indexOf('LOGDIR='), 'refusal happens before LOGDIR is created');
  assert.ok(guard < src.indexOf('flock -n 9'), 'and before the lock');
  assert.match(src, /\[ -z "\$PATHS" \] && \{ \[ "\$APPLY" != 1 \] \|\| \[ "\$\{SWEEP_SCHEDULED:-\}" != 1 \]; \}/, 'bare = no --path; allowed only with --apply AND SWEEP_SCHEDULED=1');
});

// The Auditor's HOLD on #2626: the live unit ran `--apply` WITHOUT SWEEP_SCHEDULED=1, so installing the guard alone would have made every 6-hourly run exit 2. The unit ships in the repo now.
// It also sets HOME=/root: a systemd service has no HOME, root's gh login is not found, and the scheduled sweep ABORTed "cannot read open PR list" (journal 17:56:15 2026-10-13).
test('ops/vps-scratch-sweep.service: runs exactly the scheduled form the script accepts, with SWEEP_SCHEDULED=1 and a HOME for gh', async () => {
  const { readFileSync } = await import('node:fs');
  const unit = readFileSync('ops/vps-scratch-sweep.service', 'utf8'), script = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const lines = unit.split('\n').filter(l => /^[A-Za-z]+=/.test(l));
  const get = (k: string) => lines.filter(l => l.startsWith(`${k}=`)).map(l => l.slice(k.length + 1));
  assert.deepEqual(get('ExecStart'), ['/usr/local/sbin/vps-scratch-sweep --apply'], 'exactly the bare --apply the guard allows when scheduled');
  assert.ok(get('Environment').includes('SWEEP_SCHEDULED=1'), 'the guard variable');
  assert.ok(get('Environment').includes('HOME=/root'), 'so root\'s gh login is found');
  assert.deepEqual(get('Type'), ['oneshot']);
  assert.match(script, /"\$\{SWEEP_SCHEDULED:-\}" != 1/, 'the script reads the very variable the unit sets');
  assert.ok(!/--path/.test(get('ExecStart').join(' ')) && !/--force/.test(get('ExecStart').join(' ')), 'no --path/--force in the scheduled form');
});


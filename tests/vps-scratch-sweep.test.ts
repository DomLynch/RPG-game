// ops/vps-scratch-sweep --path (Lead 2026-10-13): which paths the named-path mode may remove. sweep_kind() is sourced with SWEEP_SOURCE_ONLY=1, so no lock, log, disk or gh is touched.
// The live tool runs on the VPS (bash 5); the file is parsed by that bash, so this test needs a Linux bash.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
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
  for (const p of ['/tmp/lm', '/tmp/finished-build-2026', '/tmp/a.b_c-1', '/tmp/be-eb5eba4c', '/tmp/rank-job2', '/tmp/rank-jobs', '/tmp/cn1']) assert.equal(kind(p), 'lane', p);   // lookalikes of the older /tmp roots are plain exact children now
  for (const p of ['/tmp', '/tmp/', '/tmp//', '/tmp/*', '/tmp/a*', '/tmp/*/x', '/tmp/a?', '/tmp/[ab]', '/tmp/x/y', '/tmp/x/', '/tmp/./x', '/tmp/../etc', '/tmp/a b', '/var/tmp/x', '/private/tmp/x', '/x/tmp/y'])
    assert.equal(kind(p), '', `${p} is refused`);
});

// Lead + Auditor 2026-10-15: refuse by default for what no lane created. A Claude session's scratch is lost if it is swept between turns, and a live service's PrivateTmp is not a mount point
// from root, so neither the cwd check nor lsof +D reliably sees it in use. One wrong --path must not archive+delete the live writer's /tmp.
test('sweep_kind: system and session families under /tmp are refused outright, even by exact path (one case per family)', () => {
  for (const p of ['/tmp/claude-1003', '/tmp/claude', '/tmp/claude_x', '/tmp/claudecode-1', '/tmp/.X11-unix', '/tmp/.ICE-unix', '/tmp/.font-unix', '/tmp/.hidden',
    '/tmp/systemd-private-0f3a-frankendom-origins-writer.service-9xYz', '/tmp/systemd-private-0f3a-frankendom-duel-relay.service-1aB', '/tmp/systemd-private-0f3a-frankendom-presence.service-2cD', '/tmp/systemd-private-x',
    '/tmp/snap-private-tmp', '/tmp/pulse-PKdhtXMmr18n', '/tmp/tmux-0', '/tmp/ssh-XXXXabc123'])
    assert.equal(kind(p), '', `${p} is refused`);
  for (const p of ['/tmp/lm', '/tmp/finished-build-2026', '/tmp/systemd', '/tmp/ssh', '/tmp/pulse', '/tmp/tmux', '/tmp/cla']) assert.equal(kind(p), 'lane', `${p} is an ordinary lane child`);
});

test('sweep_safe_path: an idle systemd-private dir (a real directory, nothing running in it) is refused by the real sweep_kind', { skip: process.platform !== 'linux' }, () => {
  const dir = mkdtempSync(join('/tmp', 'systemd-private-test-'));
  try {
    const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_safe_path "$1"', 'x', dir], { encoding: 'utf8' });
    assert.equal(r.status, 1); assert.match(r.stdout, /outside the allowed roots/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Lead 2026-10-15: three regular files get an exact one-off arm (kind "file": archive first, then delete); nothing else is taught files.
test('sweep_kind: exactly /tmp/rev2354-dist.tgz, /tmp/wk.tgz and /tmp/wk2.tgz are kind file; a neighbour, a child, a lookalike and another parent are not', () => {
  for (const p of ['/tmp/rev2354-dist.tgz', '/tmp/wk.tgz', '/tmp/wk2.tgz']) assert.equal(kind(p), 'file', p);
  for (const p of ['/tmp/wk3.tgz', '/tmp/wk.tgz.bak', '/tmp/rev2355-dist.tgz', '/tmp/wk.tar']) assert.equal(kind(p), 'lane', `${p} is an ordinary /tmp child (a directory-only kind)`);
  for (const p of ['/tmp/x/wk.tgz', '/tmp/wk.tgz/', '/var/tmp/wk.tgz', '/root/wk.tgz', '/tmp/wk.tgz/sub']) assert.equal(kind(p), '', `${p} is refused`);
});

test('sweep_safe_path: a kind-file path must be a regular file (never a directory or a link); a neighbour file is refused because its kind needs a directory', { skip: process.platform !== 'linux' }, () => {
  const dir = mkdtempSync(join('/tmp', 'sweep-file-'));
  const file = join(dir, 'a.tgz'), link = join(dir, 'l.tgz'), sub = join(dir, 'd.tgz');
  const neighbour = join('/tmp', `wk3-test-${process.pid}.tgz`);
  try {
    writeFileSync(file, 'x'); symlinkSync(file, link); mkdirSync(sub); writeFileSync(neighbour, 'x');
    const asFile = (p: string) => spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_kind() { echo file; }; sweep_safe_path "$1"', 'x', p], { encoding: 'utf8' });
    assert.equal(asFile(file).status, 0, 'a real regular file passes as kind file');
    assert.equal(asFile(link).status, 1); assert.match(asFile(link).stdout, /symlink/);
    assert.equal(asFile(sub).status, 1); assert.match(asFile(sub).stdout, /not a regular file/);
    const real = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_safe_path "$1"', 'x', neighbour], { encoding: 'utf8' });
    assert.equal(real.status, 1, 'a neighbour file (kind lane) is refused'); assert.match(real.stdout, /not a real directory/);
  } finally { rmSync(neighbour, { force: true }); rmSync(dir, { recursive: true, force: true }); }
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
  const named = src.slice(src.indexOf('if [ "${#PATHS[@]}" -gt 0 ]; then'), src.indexOf('# work/: lane scratch'));
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

test('sweep_safe_path: a real canonical directory passes', { skip: process.platform !== 'linux' }, () => {
  const { base, real } = sandbox();
  try { const r = safe(real); assert.equal(r.status, 0, r.stdout + r.stderr); } finally { rmSync(base, { recursive: true, force: true }); }
});

test('sweep_safe_path: a trailing slash, a planted symlink (also with a slash), a dangling link, a link in the middle, .., //, a relative path and a file are all refused', { skip: process.platform !== 'linux' }, () => {
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

test('sweep_safe_path: the resolved path must stay inside an allowed root, and sweep_kind itself refuses a trailing slash', { skip: process.platform !== 'linux' }, () => {
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

test('sweep_in_use fails closed: only a clean "nothing open" (lsof exit 1) means not in use; a hit, a timeout and an unexpected exit all mean in use', { skip: process.platform !== 'linux' }, () => {
  const { base, real } = sandbox();
  try {
    assert.equal(inUse(real, 1), 1, 'lsof exit 1 = nothing open = safe to remove');
    assert.equal(inUse(real, 0), 0, 'lsof found an open file = in use');
    assert.equal(inUse(real, 1, 5), 0, 'lsof timed out (killed after 1 s) = could not tell = in use');
    assert.equal(inUse(real, 2), 0, 'an unexpected lsof exit = could not tell = in use');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

// Auditor on #2832 (probed on the VPS): `lsof +D <regular file>` exits 1 (clean) even while the file is open, so the new file kind would pass the in-use check under a reader.
// A file is probed with plain `lsof -- file` (0 = open, 1 = clean, anything else = could not tell = in use); a directory keeps +D.
test('sweep_in_use: a regular file is probed with `lsof -- file`, a directory with `lsof +D dir`, and both fail closed', { skip: process.platform !== 'linux' }, () => {
  const base = mkdtempSync(join(tmpdir(), 'inuse-args-')), file = join(base, 'a.tgz'), dir = join(base, 'd'), argsFile = join(base, 'args.txt'), bin = join(base, 'bin');
  mkdirSync(dir); mkdirSync(bin); writeFileSync(file, 'x'); writeFileSync(join(bin, 'lsof'), `#!/bin/sh\necho "$@" > "${argsFile}"\nexit \${FAKE_EXIT:-1}\n`); chmodSync(join(bin, 'lsof'), 0o755);
  const probe = (p: string, exit: number) => spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_in_use "$1"', 'x', p], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_EXIT: String(exit), LSOF_TIMEOUT: '5' } }).status;
  try {
    assert.equal(probe(file, 1), 1, 'a clean file is not in use'); assert.equal(readFileSync(argsFile, 'utf8').trim(), `-- ${file}`);
    assert.equal(probe(file, 0), 0, 'lsof found the file open = in use'); assert.equal(probe(file, 2), 0, 'an unexpected exit = in use');
    assert.equal(probe(dir, 1), 1); assert.equal(readFileSync(argsFile, 'utf8').trim(), `+D ${dir}`);
    assert.equal(probe(dir, 0), 0);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('sweep_in_use: a regular file with a held descriptor is in use, and not in use once it is closed (real lsof)', { skip: process.platform !== 'linux' || spawnSync('sh', ['-c', 'command -v lsof']).status !== 0 }, () => {
  const base = mkdtempSync(join(tmpdir(), 'inuse-held-')), file = join(base, 'held.tgz');
  writeFileSync(file, 'x');
  try {
    const run = (script: string) => spawnSync('bash', ['-c', `SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; ${script}`, 'x', file], { encoding: 'utf8' }).stdout.trim();
    assert.equal(run('exec 3<"$1"; sweep_in_use "$1"; echo $?'), '0', 'a file held open by a descriptor is in use');
    assert.equal(run('sweep_in_use "$1"; echo $?'), '1', 'a closed file is not in use');
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

// Found probing #2832 on the VPS: `--path=/tmp/*` was expanded by the shell (the unquoted `for p in $PATHS`) into every child of /tmp before sweep_kind could refuse the glob character. With the
// /tmp lane kind one --apply would have archived and deleted every ordinary /tmp child. Now: the --path values are a bash ARRAY (no splitting, no globbing, and no `set -f`, which would also have
// turned the /proc/[0-9]* cwd scan inside sweep_in_use into one literal word), and a glob character in a --path, as received, aborts the whole run before anything else happens (Lead + Auditor 2026-10-15).
test('a glob character in --path is refused as received (exit 2, nothing touched), even with --apply and a tree of real /tmp-style children', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glob-refuse-'));
  try {
    for (const n of ['a', 'b']) mkdirSync(join(dir, `x-${n}`));
    for (const arg of [`--path=${dir}/x-*`, '--path=/tmp/*', '--path=/tmp/?', '--path=/tmp/[ab]', `--path=${dir}/x-a*`]) {
      const r = spawnSync('bash', ['ops/vps-scratch-sweep', arg, '--apply'], { encoding: 'utf8', timeout: 20_000 });
      assert.equal(r.status, 2, `${arg}: ${r.stdout}${r.stderr}`); assert.match(r.stderr, /REFUSE\(a glob character in --path/);
    }
    assert.deepEqual(readdirSync(dir).sort(), ['x-a', 'x-b'], 'nothing was touched');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the --path values are a bash array walked with "${PATHS[@]}": no unquoted $PATHS, no set -f anywhere (it would break the /proc/[0-9]* scan in sweep_in_use)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  assert.ok(!/\$PATHS\b(?!\[)/.test(src.replace(/\$\{#?PATHS\[[@]\]\}/g, '')), 'no bare $PATHS is left');
  assert.ok(src.includes('PATHS=()') && src.includes('PATHS+=("${a#--path=}")') && src.includes('for p in "${PATHS[@]}"; do'));
  assert.ok(!/\bset -f\b/.test(src.replace(/#[^\n]*/g, '')), 'no set -f in the code');
  assert.ok(src.indexOf('REFUSE(a glob character in --path') < src.indexOf('PATHS+=("${a#--path=}")'), 'the glob refusal comes before the value is stored');
});

test('the guard sits before the log, the lock and the disk, and the scheduled form is exactly SWEEP_SCHEDULED=1 with --apply and no --path', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const guard = src.indexOf('the bare mode is the scheduled sweep only');
  assert.ok(guard > 0 && guard < src.indexOf('LOGDIR='), 'refusal happens before LOGDIR is created');
  assert.ok(guard < src.indexOf('flock -n 9'), 'and before the lock');
  assert.match(src, /\[ "\$\{#PATHS\[@\]\}" = 0 \] && \{ \[ "\$APPLY" != 1 \] \|\| \[ "\$\{SWEEP_SCHEDULED:-\}" != 1 \]; \}/, 'bare = no --path; allowed only with --apply AND SWEEP_SCHEDULED=1');
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

// Lead 2026-10-17: the VPS has no GitHub token (by design). open_pr_list reads the open PRs from the PUBLIC API when gh cannot, paginated and unauthenticated, and stays FAIL-CLOSED:
// the check protects open PRs' dirs, so a failed read, a non-list answer, an empty list or an incomplete one (10 full pages) must stop the sweep, never skip the check.
function openPrs(opts: { gh?: string; pages?: Record<number, string> }) {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-prs-')), bin = join(dir, 'bin'), log = join(dir, 'curl.log');
  mkdirSync(bin);
  const sh = (name: string, body: string) => { writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`); chmodSync(join(bin, name), 0o755); };
  sh('gh', opts.gh ?? 'exit 1');   // no token: gh refuses
  sh('curl', `echo "$*" >> "${log}"; page=$(printf '%s' "$*" | sed -n 's/.*[?&]page=\\([0-9]*\\).*/\\1/p'); f="${dir}/page-$page.json"; [ -f "$f" ] && cat "$f" || exit 22`);
  for (const [n, body] of Object.entries(opts.pages ?? {})) writeFileSync(join(dir, `page-${n}.json`), body);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: dir };
  delete (env as Record<string, string | undefined>).GH_TOKEN; delete (env as Record<string, string | undefined>).GITHUB_TOKEN;
  const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; open_pr_list'], { encoding: 'utf8', env });
  const calls = () => { try { return readFileSync(log, 'utf8'); } catch { return ''; } };
  return { r, calls, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const prs = (n: number, from = 1) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ head: { ref: `b${from + i}`, sha: `s${from + i}` } })));

test('open_pr_list: with no token gh fails and the unauthenticated public API is read (state=open, per_page=100, no Authorization header)', () => {
  const t = openPrs({ pages: { 1: prs(2) } });
  try {
    assert.equal(t.r.status, 0, t.r.stderr);
    assert.equal(t.r.stdout, 'b1\ns1\nb2\ns2\n');
    assert.match(t.calls(), /api\.github\.com\/repos\/DomLynch\/RPG-game\/pulls\?state=open&per_page=100&page=1/);
    assert.doesNotMatch(t.calls(), /authorization|token|bearer/i, 'unauthenticated');
  } finally { t.done(); }
});

test('open_pr_list: paginates (a full page of 100 asks for the next); a working gh is still used first and curl is never called', () => {
  let t = openPrs({ pages: { 1: prs(100), 2: prs(3, 101) } });
  try { assert.equal(t.r.status, 0, t.r.stderr); assert.equal(t.r.stdout.trim().split('\n').length, 206, '103 PRs, ref + sha each'); assert.match(t.calls(), /page=2/); } finally { t.done(); }
  t = openPrs({ gh: 'printf "mainb\\nmains\\n"' });
  try { assert.equal(t.r.stdout, 'mainb\nmains\n'); assert.equal(t.calls(), '', 'gh answered: no public API call'); } finally { t.done(); }
});

test('open_pr_list: FAIL CLOSED: a failed read, an HTML or rate-limit answer, an empty list and an incomplete list (10 full pages) all return 1 with nothing on stdout', () => {
  const cases: [string, Record<number, string>][] = [
    ['curl fails (no page file)', {}],
    ['not JSON', { 1: '<html>502</html>' }],
    ['a rate-limit object, not a list', { 1: '{"message":"API rate limit exceeded"}' }],
    ['an empty list: no PR at all is not trusted', { 1: '[]' }],
    ['10 full pages: 1000+ PRs, not a complete list', Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, prs(100, i * 100 + 1)]))],
    ['page 2 fails after a full page 1', { 1: prs(100) }],
  ];
  for (const [why, pages] of cases) {
    const t = openPrs({ pages });
    try { assert.equal(t.r.status, 1, `${why}: ${t.r.stdout.slice(0, 80)}`); assert.equal(t.r.stdout, '', `${why}: nothing printed`); } finally { t.done(); }
  }
});

test('the sweep aborts "cannot read open PR list" through open_pr_list, never around it', () => {
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  assert.match(src, /PRS=\$\(open_pr_list\) && \[ -n "\$PRS" \] \|\| \{ say "ABORT: cannot read open PR list"; exit 3; \}/);
  assert.doesNotMatch(src, /^PRS=\$\(gh pr list/m, 'no direct gh call that would bypass the fallback');
});

// Dom + Hooks Dev 2026-10-19: finished job copies age out after 36 h (was 48), and the archive stops carrying every copy's own .git (vps-archive/named reached 592 GB on a 1 TB box).
const sourced = (script: string, ...args: string[]) => spawnSync('bash', ['-c', `SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; ${script}`, 'x', ...args], { encoding: 'utf8' });
const git = (cwd: string, ...a: string[]) => { const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };

test('MIN_AGE_H defaults to 36 hours, and the environment still overrides it', () => {
  assert.equal(sourced('echo "$MIN_AGE_H"').stdout.trim(), '36');
  const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; echo "$MIN_AGE_H"'], { encoding: 'utf8', env: { ...process.env, MIN_AGE_H: '12' } });
  assert.equal(r.stdout.trim(), '12');
});

test('the archive copy leaves out node_modules and the checkout .git, keeps files, ignored files and a nested repo .git', () => {
  const root = mkdtempSync(join(tmpdir(), 'sweep-excl-'));
  try {
    const src = join(root, 'job'); const dst = join(root, 'arch');
    mkdirSync(join(src, '.git'), { recursive: true }); writeFileSync(join(src, '.git', 'HEAD'), 'ref: x\n');
    mkdirSync(join(src, 'node_modules', 'a'), { recursive: true }); writeFileSync(join(src, 'node_modules', 'a', 'i.js'), '1');
    mkdirSync(join(src, 'vendor', 'lib', '.git'), { recursive: true }); writeFileSync(join(src, 'vendor', 'lib', '.git', 'HEAD'), 'ref: y\n');
    writeFileSync(join(src, 'a.txt'), 'a'); writeFileSync(join(src, 'dirty.log'), 'untracked');
    mkdirSync(dst);
    const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; rsync -rtlJ "${SWEEP_EXCLUDES[@]}" "$1" "$2/"', 'x', src, dst], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const names = (p: string) => readdirSync(join(dst, 'job', p)).sort();
    assert.deepEqual(names('.'), ['a.txt', 'dirty.log', 'vendor']);
    assert.deepEqual(names('vendor/lib'), ['.git'], 'a nested repo keeps its .git');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sweep_unpushed_bundle: nothing unpushed writes no bundle; an unpushed commit, a stash and a detached unpushed HEAD are all bundled; no .git is skipped', { skip: process.platform !== 'linux' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'sweep-bundle-'));
  try {
    const remote = join(root, 'remote.git'); const co = join(root, 'co');
    git(root, 'init', '-q', '--bare', remote);
    git(root, 'clone', '-q', remote, co);
    writeFileSync(join(co, 'f'), '1'); git(co, 'add', '.'); git(co, 'commit', '-qm', 'one'); git(co, 'push', '-q', 'origin', 'HEAD');
    const out = join(root, 'o.bundle');
    const run = () => sourced('sweep_unpushed_bundle "$1" "$2"; echo $?', co, out).stdout.trim();
    assert.equal(run(), '10', 'clean and pushed: no bundle'); assert.equal(spawnSync('test', ['-e', out]).status, 1);
    writeFileSync(join(co, 'f'), '2'); git(co, 'commit', '-qam', 'two unpushed');
    assert.equal(run(), '0', 'an unpushed commit is bundled');
    assert.match(git(co, 'bundle', 'list-heads', out), /refs\/heads\//);
    rmSync(out); git(co, 'push', '-q', 'origin', 'HEAD');
    assert.equal(run(), '10', 'pushed again: nothing to bundle');
    writeFileSync(join(co, 'f'), '3'); git(co, 'stash', 'push', '-q'); assert.equal(run(), '0', 'a stash is bundled'); assert.match(git(co, 'bundle', 'list-heads', out), /refs\/stash/);
    rmSync(out); git(co, 'stash', 'drop', '-q');
    git(co, 'checkout', '-q', '--detach'); writeFileSync(join(co, 'f'), '4'); git(co, 'commit', '-qam', 'detached unpushed');
    assert.equal(run(), '0', 'a detached HEAD with an unpushed commit is bundled');
    assert.equal(sourced('sweep_unpushed_bundle "$1" "$2"; echo $?', join(root, 'nogit'), out).stdout.trim(), '10', 'a dir without .git has nothing to bundle');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sweep_box_has_room: fits only when the copy (without node_modules and .git) plus the reserve is free; unreadable paths say no', { skip: process.platform !== 'linux' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'sweep-room-'));
  try {
    const src = join(root, 'job'); mkdirSync(join(src, '.git'), { recursive: true }); mkdirSync(join(src, 'node_modules'));
    writeFileSync(join(src, 'a.bin'), Buffer.alloc(1024 * 1024)); writeFileSync(join(src, '.git', 'big'), Buffer.alloc(8 * 1024 * 1024)); writeFileSync(join(src, 'node_modules', 'n'), Buffer.alloc(8 * 1024 * 1024));
    const room = (reserveKib: number, dir = root) => sourced('sweep_box_has_room "$1" "$2" "$3"; echo $?', src, dir, String(reserveKib)).stdout.trim();
    assert.equal(room(0), '0', 'a tmpfs-sized copy fits with no reserve');
    assert.equal(room(1e12), '1', 'a reserve larger than the disk is never met: the copy is kept');
    assert.equal(room(0, join(root, 'missing')), '1', 'an archive path df cannot read says no');
    assert.equal(sourced('sweep_box_has_room "$1" "$2" 0; echo $?', join(root, 'nope'), root).stdout.trim(), '1', 'a source du cannot read says no');
    assert.equal(sourced('echo "$BOX_RESERVE_GIB"').stdout.trim(), '30');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Strategy 2026-10-19 guardrail 2: the never-touch set is pinned, not implied. None of these is under a root the sweep may remove, and bn-trunk is on the EXCLUDE list that named-path and scheduled modes both read.
test('never-touch: the origins, the live and release trees, databases and the donor mounts are refused by sweep_kind; bn-trunk is excluded', () => {
  for (const p of ['/opt/frankendom-origins', '/opt/frankendom-origins/x', '/var/www/frankendom', '/var/www/frankendom/releases/20261018-1200', '/var/lib/postgresql', '/var/lib/postgresql/16/main',
    '/mnt/frankendom-donors', '/mnt/frankendom-donors/vps-archive', '/mnt/armagedom-backups', '/opt/frankendom-reference.git', '/opt/frankendom.git', '/opt/deploy-backups'])
    assert.equal(kind(p), '', `${p} is refused`);
  assert.match(sourced('echo " $EXCLUDE "').stdout, / bn-trunk /);
});

// Strategy 2026-10-19: a 40 GB cap on work/, oldest idle first, same keep-set, a copy younger than 6 h is never a victim.
test('sweep_cap_order: oldest idle first, with sizes; skips never-touch names, symlinks, files and anything changed within the age window', { skip: process.platform !== 'linux' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'sweep-cap-'));
  try {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
    const mk = (name: string, h: number, kib: number) => {
      const d = join(root, name); mkdirSync(d); const f = join(d, 'blob'); writeFileSync(f, Buffer.alloc(kib * 1024)); utimesSync(f, hoursAgo(h), hoursAgo(h)); return d;
    };
    mk('mid', 20, 8); mk('oldest', 30, 16); mk('young', 2, 4); mk('bn-trunk', 40, 4);
    symlinkSync(join(root, 'mid'), join(root, 'a-link')); writeFileSync(join(root, 'a-file'), 'x');
    const r = spawnSync('bash', ['-c', 'SWEEP_SOURCE_ONLY=1 source ops/vps-scratch-sweep; sweep_cap_order "$1" 6', 'x', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const rows = r.stdout.trim().split('\n').map(l => l.split(' '));
    assert.deepEqual(rows.map(c => c[2]), [join(root, 'oldest'), join(root, 'mid')], 'oldest first; young (2 h), bn-trunk, the symlink and the file are left out');
    assert.ok(Number(rows[0][1]) >= 16 && Number(rows[1][1]) >= 8, 'sizes in KiB');
    assert.ok(Number(rows[0][0]) < Number(rows[1][0]), 'sorted by the newest change, ascending');
    assert.equal(sourced('echo "$WORK_CAP_GIB $CAP_MIN_AGE_H"').stdout.trim(), '40 6');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the cap pass runs after the age pass, stops at the cap, and applies the same keep-set; a dry run counts a would-be removal', () => {
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const cap = src.slice(src.indexOf('# work/ cap:'), src.indexOf('# dev-jobs: finished jobs'));
  assert.ok(src.indexOf('# work/ cap:') > src.indexOf('# work/: lane scratch'), 'after the work/ age pass');
  for (const keep of ['cap keep(in-use)', 'cap keep(symlink target)', 'cap keep(open-PR)']) assert.ok(cap.includes(keep), keep);
  assert.match(cap, /\[ "\$total_kib" -gt "\$cap_kib" \] \|\| break/);
  assert.match(cap, /sweep_cap_order "\$WORK" "\$CAP_MIN_AGE_H"/);
  assert.match(cap, /archive_then_delete "\$d" work/, 'archive first, like every other work/ removal');
  assert.match(cap, /\[ "\$APPLY" = 0 \] \|\| \[ ! -d "\$d" \]/);
  assert.doesNotMatch(cap, /rm -rf/, 'the cap never removes anything itself, only through archive_then_delete');
});

test('a bundle that fails git bundle verify falls back to archiving the whole .git, and a failed .git copy keeps the source (Lead 2026-10-19)', () => {
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const fn = src.slice(src.indexOf('archive_then_delete(){'), src.indexOf('delete_only(){'));
  assert.match(fn, /git -C "\$s" bundle verify -q "\$bundle"/);
  assert.match(fn, /rsync -rtlJ --chmod=Du\+rwx,Fu\+rw --partial "\$s\/\.git"/);
  assert.match(fn, /GITCOPYFAIL \$s \(kept\)"; return/);
  assert.ok(fn.indexOf('bundle verify') < fn.indexOf('rm -rf -- "$s"'), 'verified before anything is removed');
});

test('archive_then_delete checks the box has room before it copies, and keeps the copy when it does not', () => {
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  const fn = src.slice(src.indexOf('archive_then_delete(){'), src.indexOf('delete_only(){'));
  assert.ok(fn.indexOf('sweep_box_has_room') > 0 && fn.indexOf('sweep_box_has_room') < fn.indexOf('rsync -rtlJ'), 'the room check comes before the first rsync');
  assert.match(fn, /sweep_box_has_room "\$s" "\$ARCH" \$\(\(BOX_RESERVE_GIB \* 1048576\)\) \|\| \{ say "skip\(storage box full, kept\) \$s"; return; \}/);
});

test('archive_then_delete copies with SWEEP_EXCLUDES and writes the bundle before it deletes', () => {
  const src = readFileSync('ops/vps-scratch-sweep', 'utf8');
  assert.doesNotMatch(src, /rsync [^\n]*--exclude=node_modules/, 'the two rsync calls use SWEEP_EXCLUDES, not a private exclude list');
  assert.match(src, /sweep_unpushed_bundle "\$s" "\$bundle"; brc=\$\?/);
  assert.ok(src.indexOf('sweep_unpushed_bundle "$s" "$bundle"') < src.indexOf('rm -rf -- "$s"; say "archived+deleted'), 'the bundle is written before anything is removed');
});


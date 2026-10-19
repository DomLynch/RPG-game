// scripts/vps-shadow/job-copy.sh (Dom + Hooks Dev 2026-10-19): a VPS job copy that borrows its history from one reference mirror instead of carrying its own 4 GB .git.
// Everything runs in a tmp dir against a local "GitHub" (a bare repo); the script uses flock, so this needs the Linux box.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const skip = process.platform !== 'linux';
const git = (cwd: string, ...a: string[]) => { const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };

const world = () => {
  const root = mkdtempSync(join(tmpdir(), 'job-copy-'));
  const remote = join(root, 'github.git'); const seed = join(root, 'seed');
  git(root, 'init', '-q', '--bare', remote); git(root, 'clone', '-q', remote, seed);
  writeFileSync(join(seed, 'f.txt'), 'one'); git(seed, 'add', '.'); git(seed, 'commit', '-qm', 'one'); git(seed, 'branch', '-M', 'main'); git(seed, 'push', '-q', 'origin', 'main');
  const env = { ...process.env, JOB_COPY_URL: remote, JOB_COPY_REFERENCE: join(root, 'ref.git'), JOB_COPY_ROOT: join(root, 'work') };
  const run = (...args: string[]) => spawnSync('bash', ['scripts/vps-shadow/job-copy.sh', ...args], { encoding: 'utf8', env });
  return { root, seed, remote, env, run, done: () => rmSync(root, { recursive: true, force: true }) };
};

test('--init-reference makes a mirror that never garbage-collects, and refuses to run twice', { skip }, () => {
  const w = world();
  try {
    const r = w.run('--init-reference'); assert.equal(r.status, 0, r.stderr);
    assert.equal(git(w.root, '--git-dir', w.env.JOB_COPY_REFERENCE, 'config', 'gc.auto'), '0');
    assert.equal(git(w.root, '--git-dir', w.env.JOB_COPY_REFERENCE, 'config', 'gc.pruneExpire'), 'never');
    const again = w.run('--init-reference'); assert.equal(again.status, 2); assert.match(again.stderr, /already exists/);
  } finally { w.done(); }
});

test('a copy borrows the history (alternates, no pack of its own), checks out the branch detached, and keeps origin = the real remote', { skip }, () => {
  const w = world();
  try {
    assert.equal(w.run('--init-reference').status, 0);
    const r = w.run('lane-job1', 'main'); assert.equal(r.status, 0, r.stderr);
    const dest = r.stdout.trim(); assert.equal(dest, join(w.env.JOB_COPY_ROOT, 'lane-job1'));
    assert.equal(readFileSync(join(dest, 'f.txt'), 'utf8'), 'one');
    assert.equal(git(dest, 'rev-parse', 'HEAD'), git(w.seed, 'rev-parse', 'HEAD'));
    assert.equal(spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: dest }).status, 1, 'HEAD is detached');
    assert.match(readFileSync(join(dest, '.git', 'objects', 'info', 'alternates'), 'utf8'), /ref\.git\/objects/);
    assert.equal(git(dest, 'remote', 'get-url', 'origin'), w.remote, 'origin is GitHub, not the mirror');
    assert.equal(git(dest, 'count-objects', '-v').split('\n').find(l => l.startsWith('packs:')), 'packs: 0', 'no pack of its own: the history is borrowed');
  } finally { w.done(); }
});

test('a later copy sees commits pushed after the mirror was made (every copy refreshes the mirror first), and a sha works as the ref', { skip }, () => {
  const w = world();
  try {
    assert.equal(w.run('--init-reference').status, 0);
    writeFileSync(join(w.seed, 'f.txt'), 'two'); git(w.seed, 'commit', '-qam', 'two'); git(w.seed, 'push', '-q', 'origin', 'main');
    const sha = git(w.seed, 'rev-parse', 'HEAD');
    const r = w.run('lane-job2', sha); assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(r.stdout.trim(), 'f.txt'), 'utf8'), 'two');
  } finally { w.done(); }
});

test('refused: bad names, an existing copy, no mirror, an unknown ref (and the half-made copy is removed), a ref that looks like an option', { skip }, () => {
  const w = world();
  try {
    const noMirror = w.run('lane-job', 'main'); assert.equal(noMirror.status, 2); assert.match(noMirror.stderr, /--init-reference/);
    assert.equal(w.run('--init-reference').status, 0);
    for (const bad of ['../x', 'A b', 'a/b', '-x', 'x', '', 'a..b', 'UPPER']) { const r = w.run(bad, 'main'); assert.equal(r.status, 2, `name ${JSON.stringify(bad)}: ${r.stderr}`); }
    assert.equal(w.run('lane-ok', 'main').status, 0);
    const dup = w.run('lane-ok', 'main'); assert.equal(dup.status, 2); assert.match(dup.stderr, /already exists/);
    const unknown = w.run('lane-nope', 'no-such-branch'); assert.equal(unknown.status, 2); assert.match(unknown.stderr, /no such branch or commit/);
    assert.equal(existsSync(join(w.env.JOB_COPY_ROOT, 'lane-nope')), false, 'the half-made copy is gone');
    const opt = w.run('lane-opt', '--upload-pack=x'); assert.equal(opt.status, 2);
  } finally { w.done(); }
});

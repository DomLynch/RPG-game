// scripts/lanejob/install-vps.sh (Lead + Strategy, Dom fast-track 2026-10-12): the VPS lanejob is a 3-line shim that execs the current release copy under /opt/frankendom/lanejob/<sha>/,
// which carries scripts/lib/waterfall.mjs next to the script, so no per-user ~/.spill-tools copy can be missing or stale. Everything runs in tmp dirs as the test user (AGENTS.md: tests never
// touch live box state); the proof is a probe through the installed shim as a non-root user.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = process.cwd();
const install = join(repo, 'scripts/lanejob/install-vps.sh');
const ok = (cmd: string, args: string[] = []) => { try { execFileSync(cmd, args, { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; } };
const skip = !existsSync('/proc/loadavg') || !ok('flock', ['-V']) || !ok('bash', ['-c', '[ "${BASH_VERSINFO[0]}" -ge 4 ]']) || !ok('mv', ['--version']) ? 'needs Linux, GNU mv, flock and bash 4+: runs on the VPS / CI' : false;
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();

function box() {
  const dir = mkdtempSync(join(tmpdir(), 'lanejob-install-'));
  const root = join(dir, 'opt'), bin = join(dir, 'bin'), slots = join(dir, 'slots'), locks = join(dir, 'locks'), log = join(dir, 'lanejob.log');
  mkdirSync(bin); mkdirSync(slots); mkdirSync(locks);
  for (let i = 1; i <= 4; i++) writeFileSync(join(slots, `slot${i}`), '');
  const shim = join(bin, 'lanejob');
  const env: NodeJS.ProcessEnv = { ...process.env, LANEJOB_LOG: log, LANEJOB_SLOTS: slots, RELEASE_LOCK_DIR: locks, LANEJOB_LOAD: '0.5', HOME: join(dir, 'no-home'), LANEJOB_TOOLS: join(dir, 'no-tools') };
  const run = (...a: string[]) => spawnSync('bash', [install, '--root', root, '--shim', shim, ...a], { env, encoding: 'utf8', timeout: 20000 });
  const probe = (load: string, ...cmd: string[]) => spawnSync(shim, ['--probe', ...cmd], { env: { ...env, LANEJOB_LOAD: load }, encoding: 'utf8', timeout: 10000 });
  return { dir, root, shim, log, run, probe, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('install publishes <root>/<sha>/scripts/{lanejob,lib}, flips current, writes a 3-line shim and logs "lanejob installed <sha>"', { skip }, () => {
  const b = box();
  try {
    const r = b.run(repo);
    assert.equal(r.status, 0, r.stderr);
    const dest = join(b.root, sha);
    assert.equal(readlinkSync(join(b.root, 'current')), sha);
    assert.equal(statSync(join(dest, 'scripts/lanejob/lanejob.sh')).mode & 0o777, 0o755);
    assert.equal(statSync(join(dest, 'scripts/lib/waterfall.mjs')).mode & 0o777, 0o644);
    assert.equal(readFileSync(join(dest, 'scripts/lib/waterfall.mjs'), 'utf8'), readFileSync(join(repo, 'scripts/lib/waterfall.mjs'), 'utf8'));
    const shim = readFileSync(b.shim, 'utf8').trimEnd().split('\n');
    assert.equal(shim.length, 3);
    assert.equal(shim[2], `exec ${b.root}/current/scripts/lanejob/lanejob.sh "$@"`);
    assert.match(readFileSync(b.log, 'utf8'), new RegExp(`lanejob installed ${sha}`));
  } finally { b.done(); }
});

test('a probe through the installed shim as a non-root user: under the gate would=vps, over it would=spill reason=load, read from the INSTALLED waterfall.mjs', { skip }, () => {
  const b = box();
  try {
    assert.equal(b.run(repo).status, 0);
    assert.equal(b.probe('0.5', 'tsc').stdout.trim(), 'would=vps');
    assert.equal(b.probe('40', 'tsc').stdout.trim(), 'would=spill reason=load');
    writeFileSync(join(b.root, sha, 'scripts/lib/waterfall.mjs'), 'export const VPS_MAX_LOAD1 = 3;\n');   // proves the number comes from the installed copy, not the repo
    assert.equal(b.probe('4', 'tsc').stdout.trim(), 'would=spill reason=load');
  } finally { b.done(); }
});

test('with the installed waterfall.mjs gone the shim REFUSES (75) instead of guessing', { skip }, () => {
  const b = box();
  try {
    assert.equal(b.run(repo).status, 0);
    rmSync(join(b.root, sha, 'scripts/lib/waterfall.mjs'));
    const p = b.probe('0.5', 'tsc');
    assert.equal(p.status, 75);
    assert.equal(p.stdout.trim(), 'would=refuse reason=router-unreadable');
  } finally { b.done(); }
});

test('a second install flips current to the new sha and keeps the old release dir; a changed old shim is backed up', { skip }, () => {
  const b = box();
  try {
    writeFileSync(b.shim, '#!/bin/sh\necho old lanejob\n'); execFileSync('chmod', ['755', b.shim]);
    assert.equal(b.run(repo).status, 0);
    const baks = execFileSync('ls', [join(b.shim, '..')], { encoding: 'utf8' }).split('\n').filter(f => f.startsWith('lanejob.bak-'));
    assert.equal(baks.length, 1);
    assert.match(readFileSync(join(b.shim, '..', baks[0]), 'utf8'), /old lanejob/);
    mkdirSync(join(b.root, 'oldsha0000'));
    assert.equal(b.run(repo).status, 0);
    assert.ok(lstatSync(join(b.root, 'current')).isSymbolicLink());
    assert.ok(existsSync(join(b.root, 'oldsha0000')) && existsSync(join(b.root, sha)));
    assert.equal(execFileSync('ls', [join(b.shim, '..')], { encoding: 'utf8' }).split('\n').filter(f => f.startsWith('lanejob.bak-')).length, 1, 'an identical shim is not backed up again');
  } finally { b.done(); }
});

test('install refuses a repo whose waterfall.mjs has no VPS_MAX_LOAD1 line, and installs nothing', { skip }, () => {
  const b = box();
  try {
    const fake = mkdtempSync(join(tmpdir(), 'lanejob-fakerepo-'));
    execFileSync('git', ['init', '-q'], { cwd: fake });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: fake });
    mkdirSync(join(fake, 'scripts/lanejob'), { recursive: true }); mkdirSync(join(fake, 'scripts/lib'), { recursive: true });
    writeFileSync(join(fake, 'scripts/lanejob/lanejob.sh'), '#!/bin/bash\n'); writeFileSync(join(fake, 'scripts/lib/waterfall.mjs'), 'export const OTHER = 1;\n');
    const r = b.run(fake);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /no VPS_MAX_LOAD1 line/);
    assert.equal(existsSync(b.root), false);
    rmSync(fake, { recursive: true, force: true });
  } finally { b.done(); }
});

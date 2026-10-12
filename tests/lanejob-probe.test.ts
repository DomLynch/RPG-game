// scripts/lanejob/lanejob.sh --probe (Strategy + Dom 2026-10-12, the Mac middle tier): says where a job WOULD go, runs nothing, takes no slot,
// writes no log. A Mac caller asks it over ssh and considers its own slot only on would=spill. Real bash 4+, flock; the slot dir, the release
// lock dir and the log are tmp dirs (AGENTS.md: tests never read live box state). The probe answers would=vps for root (root bypasses the limits).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/lanejob/lanejob.sh');
const ok = (cmd: string, args: string[] = []) => { try { execFileSync(cmd, args, { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; } };
const bash4 = ok('bash', ['-c', '[ "${BASH_VERSINFO[0]}" -ge 4 ]']);
const skip = (process.getuid?.() === 0) ? 'root bypasses lanejob limits'
  : !existsSync('/proc/loadavg') || !ok('flock', ['-V']) || !bash4 ? 'needs Linux, flock and bash 4+: runs on the VPS / CI' : false;

function box() {
  const dir = mkdtempSync(join(tmpdir(), 'lanejob-probe-'));
  const slots = join(dir, 'slots'), locks = join(dir, 'release'), log = join(dir, 'lanejob.log');
  mkdirSync(slots); mkdirSync(locks);
  for (let i = 1; i <= 4; i++) writeFileSync(join(slots, `slot${i}`), '');
  const holders: ChildProcess[] = [];
  const hold = (...ns: number[]) => { for (const n of ns) holders.push(spawn('flock', [join(slots, `slot${n}`), 'sleep', '30'], { stdio: 'ignore' })); };
  const env = { ...process.env, LANEJOB_SLOTS: slots, RELEASE_LOCK_DIR: locks, LANEJOB_LOG: log };
  const probe = async (...cmd: string[]) => {
    await new Promise(r => setTimeout(r, 300));   // let the flock holders take their locks
    return execFileSync('bash', [script, '--probe', ...cmd], { env, encoding: 'utf8', timeout: 10000 }).trim();
  };
  return { dir, slots, locks, log, env, hold, probe, done: () => holders.forEach(h => h.kill()) };
}

test('probe: free slots -> would=vps, and one free slot among busy ones is still would=vps', { skip }, async () => {
  const b = box();
  try {
    assert.equal(await b.probe('tsc', '--noEmit'), 'would=vps');
    b.hold(1, 2, 3);
    assert.equal(await b.probe('tsc', '--noEmit'), 'would=vps');
  } finally { b.done(); }
});

test('probe: all four slots busy -> would=spill reason=slots', { skip }, async () => {
  const b = box();
  try {
    b.hold(1, 2, 3, 4);
    assert.equal(await b.probe('node', '--test', 'tests/a.test.ts'), 'would=spill reason=slots');
  } finally { b.done(); }
});

test('probe: a fresh release marker -> would=spill reason=release-lock; a marker older than 90 min is ignored', { skip }, async () => {
  const b = box();
  try {
    const marker = join(b.locks, 'deploy-1');
    writeFileSync(marker, '');
    assert.equal(await b.probe('tsc'), 'would=spill reason=release-lock');
    const old = new Date(Date.now() - 2 * 3600_000);
    utimesSync(marker, old, old);
    assert.equal(await b.probe('tsc'), 'would=vps');
  } finally { b.done(); }
});

test('probe: a full suite is refused exactly like a real run (would=refuse)', { skip }, async () => {
  const b = box();
  try {
    assert.equal(await b.probe('npm', 'run', 'test:all'), 'would=refuse');
    assert.equal(await b.probe('npm', 'run', 'quality'), 'would=refuse');
  } finally { b.done(); }
});

test('probe: runs nothing, takes no slot, writes no log', { skip }, async () => {
  const b = box();
  try {
    const out = await b.probe('touch', join(b.dir, 'must-not-exist'));
    assert.equal(out, 'would=vps');
    assert.equal(existsSync(join(b.dir, 'must-not-exist')), false);
    assert.equal(existsSync(b.log), false);
    for (let i = 1; i <= 4; i++) execFileSync('flock', ['-n', join(b.slots, `slot${i}`), 'true'], { timeout: 5000 });   // every slot is still free
  } finally { b.done(); }
});

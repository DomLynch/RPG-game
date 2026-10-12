// scripts/lanejob/lanejob.sh --probe (Strategy + Dom 2026-10-12, the Mac middle tier): says where a job WOULD go, runs nothing, takes no slot,
// writes no log. A Mac caller asks it over ssh and considers its own slot only on would=spill. Real bash 4+, flock; the slot dir, the release
// lock dir and the log are tmp dirs (AGENTS.md: tests never read live box state). 2026-10-12 (Lead): the probe and a real run gate on load1 < VPS_MAX_LOAD1
// (read from scripts/lib/waterfall.mjs); root is no longer exempt (it takes a slot and the load gate); over the gate a real run spills to hf-cpu at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VPS_MAX_LOAD1 } from '../scripts/lib/waterfall.mjs';

const script = join(process.cwd(), 'scripts/lanejob/lanejob.sh');
const ok = (cmd: string, args: string[] = []) => { try { execFileSync(cmd, args, { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; } };
const bash4 = ok('bash', ['-c', '[ "${BASH_VERSINFO[0]}" -ge 4 ]']);
const skip = !existsSync('/proc/loadavg') || !ok('flock', ['-V']) || !bash4 ? 'needs Linux, flock and bash 4+: runs on the VPS / CI' : false;

function box() {
  const dir = mkdtempSync(join(tmpdir(), 'lanejob-probe-'));
  const slots = join(dir, 'slots'), locks = join(dir, 'release'), log = join(dir, 'lanejob.log');
  mkdirSync(slots); mkdirSync(locks);
  for (let i = 1; i <= 4; i++) writeFileSync(join(slots, `slot${i}`), '');
  const holders: ChildProcess[] = [];
  const hold = (...ns: number[]) => { for (const n of ns) holders.push(spawn('flock', [join(slots, `slot${n}`), 'sleep', '30'], { stdio: 'ignore' })); };
  const env: NodeJS.ProcessEnv = { ...process.env, LANEJOB_SLOTS: slots, RELEASE_LOCK_DIR: locks, LANEJOB_LOG: log, LANEJOB_LOAD: '0.5' };
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

// A fake `id` (uid 0) and a fake `systemd-run` (drops its --flags, runs the command) let a non-root test box play root without touching the live box.
function asRoot(b: ReturnType<typeof box>) {
  const bin = join(b.dir, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'id'), '#!/bin/sh\n[ "$1" = "-u" ] && { echo 0; exit 0; }\nexec /usr/bin/id "$@"\n');
  writeFileSync(join(bin, 'systemd-run'), '#!/bin/sh\nwhile [ "${1#--}" != "$1" ]; do shift; done\nexec "$@"\n');
  chmodSync(join(bin, 'id'), 0o755); chmodSync(join(bin, 'systemd-run'), 0o755);
  b.env.PATH = `${bin}:${process.env.PATH}`;
}
const git = (args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) => execFileSync('git', args, { cwd, env, stdio: 'ignore', timeout: 10000 });
function pushedRepoWithSpillTools(b: ReturnType<typeof box>) {
  const origin = join(b.dir, 'origin.git'), work = join(b.dir, 'work'), tools = join(b.dir, 'tools');
  const genv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  git(['init', '-q', '--bare', origin], b.dir); git(['clone', '-q', origin, work], b.dir);
  writeFileSync(join(work, 'f'), 'x');
  git(['add', 'f'], work, genv); git(['commit', '-q', '-m', 'x'], work, genv); git(['push', '-q', 'origin', 'HEAD'], work, genv);
  mkdirSync(join(tools, 'scripts/vps-shadow'), { recursive: true });
  writeFileSync(join(tools, 'scripts/vps-shadow/launch.mjs'), "console.log('tier=hf-cpu slot=1 queued=0s'); console.log('Job started with ID: ' + 'a'.repeat(24));\n");
  b.env.LANEJOB_TOOLS = tools;
  return work;
}
const freeSlots = (b: ReturnType<typeof box>) => { for (let i = 1; i <= 4; i++) execFileSync('flock', ['-n', join(b.slots, `slot${i}`), 'true'], { timeout: 5000 }); };

test('probe: load1 at or over VPS_MAX_LOAD1 -> would=spill reason=load, under it -> would=vps, even with free slots', { skip }, async () => {
  const b = box();
  try {
    b.env.LANEJOB_LOAD = String(VPS_MAX_LOAD1 - 0.1);
    assert.equal(await b.probe('tsc'), 'would=vps');
    b.env.LANEJOB_LOAD = String(VPS_MAX_LOAD1);
    assert.equal(await b.probe('tsc'), 'would=spill reason=load');
    b.env.LANEJOB_LOAD = '40';
    assert.equal(await b.probe('tsc'), 'would=spill reason=load');
  } finally { b.done(); }
});

test('the max load is READ from waterfall.mjs (LANEJOB_WATERFALL), not copied into the script', { skip }, async () => {
  const b = box();
  try {
    const wf = join(b.dir, 'waterfall.mjs');
    writeFileSync(wf, 'export const VPS_MAX_LOAD1 = 3;\n');
    b.env.LANEJOB_WATERFALL = wf;
    b.env.LANEJOB_LOAD = '4';
    assert.equal(await b.probe('tsc'), 'would=spill reason=load');
    b.env.LANEJOB_LOAD = '2';
    assert.equal(await b.probe('tsc'), 'would=vps');
    assert.doesNotMatch(readFileSync(script, 'utf8'), /VPS_MAX_LOAD1\s*=\s*\d/);
  } finally { b.done(); }
});

test('an unreadable waterfall.mjs fails CLOSED: the probe answers spill, writes no log', { skip }, async () => {
  const b = box();
  try {
    const lone = join(b.dir, 'inst/bin'); mkdirSync(lone, { recursive: true });
    copyFileSync(script, join(lone, 'lanejob.sh'));   // no ../lib/waterfall.mjs next to it, LANEJOB_TOOLS has none either
    b.env.LANEJOB_TOOLS = join(b.dir, 'no-tools'); b.env.HOME = join(b.dir, 'no-home');
    const out = execFileSync('bash', [join(lone, 'lanejob.sh'), '--probe', 'tsc'], { env: b.env, encoding: 'utf8', timeout: 10000 }).trim();
    assert.equal(out, 'would=spill reason=load');
    assert.equal(existsSync(b.log), false);
  } finally { b.done(); }
});

test('probe: root is no longer exempt (a fake uid 0 still hits the load, refuse and slots gates)', { skip }, async () => {
  const b = box();
  try {
    asRoot(b);
    b.env.LANEJOB_LOAD = '40';
    assert.equal(await b.probe('tsc'), 'would=spill reason=load');
    b.env.LANEJOB_LOAD = '0.5';
    assert.equal(await b.probe('npm', 'run', 'test:all'), 'would=refuse');
    b.hold(1, 2, 3, 4);
    assert.equal(await b.probe('tsc'), 'would=spill reason=slots');
  } finally { b.done(); }
});

test('real run over the load gate: spills to hf-cpu at once (no 120 s wait), runs nothing here, takes no slot', { skip }, () => {
  const b = box();
  try {
    const work = pushedRepoWithSpillTools(b), marker = join(b.dir, 'must-not-run'), t0 = Date.now();
    const r = spawnSync('bash', [script, 'touch', marker], { cwd: work, env: { ...b.env, LANEJOB_LOAD: '40' }, encoding: 'utf8', timeout: 20000 });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /tier=hf-cpu .*job=a{24}/);
    assert.ok(Date.now() - t0 < 15000, 'spilled at once, not after the 120 s wait');
    assert.equal(existsSync(marker), false);
    assert.match(readFileSync(b.log, 'utf8'), /tier=hf-cpu/);
    freeSlots(b);
  } finally { b.done(); }
});

test('real run as root: over the load gate it spills too (root is not exempt)', { skip }, () => {
  const b = box();
  try {
    asRoot(b);
    const work = pushedRepoWithSpillTools(b), marker = join(b.dir, 'must-not-run');
    const r = spawnSync('bash', [script, 'touch', marker], { cwd: work, env: { ...b.env, LANEJOB_LOAD: '40' }, encoding: 'utf8', timeout: 20000 });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /tier=hf-cpu/);
    assert.equal(existsSync(marker), false);
    freeSlots(b);
  } finally { b.done(); }
});

test('real run as root under the gate: takes a slot (tier=vps line), runs the job in the scope, releases the slot', { skip }, () => {
  const b = box();
  try {
    asRoot(b);
    const marker = join(b.dir, 'ran');
    const r = spawnSync('bash', [script, 'touch', marker], { env: { ...b.env, LANEJOB_LOAD: '0.5' }, encoding: 'utf8', timeout: 20000 });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /tier=vps slot=1 queued=\ds/);
    assert.equal(existsSync(marker), true);
    freeSlots(b);
  } finally { b.done(); }
});

test('real run as root with all four slots held and no spill: waits in the queue, runs nothing', { skip }, async () => {
  const b = box();
  try {
    asRoot(b);
    b.hold(1, 2, 3, 4);
    await new Promise(r => setTimeout(r, 300));
    const marker = join(b.dir, 'must-not-run');
    const r = spawnSync('bash', [script, 'touch', marker], { env: { ...b.env, LANEJOB_NO_SPILL: '1' }, encoding: 'utf8', timeout: 3000 });
    assert.equal(existsSync(marker), false);
    assert.match(r.stderr, /queued behind/);
  } finally { b.done(); }
});

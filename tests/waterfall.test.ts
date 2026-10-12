// The work waterfall's one router (Dom 2026-10-11): Mac = coding + WebKit rows only; VPS first; Hugging Face CPU when the VPS is busy or has no room;
// the T4 only for graphics. scripts/lib/waterfall.mjs pickTarget decides; this file pins every branch and the boundary: no script launches a heavy job
// outside waterfall.mjs except the shrink-only KNOWN list (the entry points not yet converted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { pickTarget, routeJob, VPS_MAX_LOAD1, VPS_STATUS_CMD, parseVpsStatus } = await import('../scripts/lib/waterfall.mjs');
const { ROUTER } = await import('../scripts/lib/router-config.mjs');
const ok = { load1: 0.8, freeRamMb: 20000 };

test('pickTarget: a quiet VPS with room takes the job', () => {
  assert.equal(pickTarget({ vps: ok, mem: 4096 }), 'vps');
});
test('pickTarget: the VPS load limit is 16 (below takes it, at or above spills to Hugging Face CPU)', () => {
  assert.equal(VPS_MAX_LOAD1, 16);
  assert.equal(pickTarget({ vps: { ...ok, load1: 15.9 }, mem: 1024 }), 'vps');
  assert.equal(pickTarget({ vps: { ...ok, load1: 16 }, mem: 1024 }), 'hf-cpu');
  assert.equal(pickTarget({ vps: { ...ok, load1: 40 }, mem: 1024 }), 'hf-cpu');
});
test('pickTarget: not enough free RAM for the job spills to Hugging Face CPU', () => {
  assert.equal(pickTarget({ vps: { load1: 1, freeRamMb: 3000 }, mem: 4096 }), 'hf-cpu');
  assert.equal(pickTarget({ vps: { load1: 1, freeRamMb: 4096 }, mem: 4096 }), 'vps');
});
test('pickTarget: an unreachable or unreadable VPS (null, NaN) goes to Hugging Face CPU, never to the Mac', () => {
  assert.equal(pickTarget({ vps: null, mem: 1024 }), 'hf-cpu');
  assert.equal(pickTarget({ vps: { load1: NaN, freeRamMb: 9999 }, mem: 1024 }), 'hf-cpu');
  assert.equal(pickTarget({ vps: { load1: 1, freeRamMb: undefined as unknown as number }, mem: 1024 }), 'hf-cpu');
});
test('pickTarget: the T4 only with gfx, whatever the VPS looks like; without gfx a job never gets a T4', () => {
  assert.equal(pickTarget({ gfx: true, vps: ok, mem: 1024 }), 'hf-t4');
  assert.equal(pickTarget({ gfx: true, vps: null, mem: 1024 }), 'hf-t4');
  for (const vps of [ok, null, { load1: 99, freeRamMb: 0 }]) assert.notEqual(pickTarget({ vps, mem: 1024 }), 'hf-t4');
});
test('pickTarget: a job without a memory need still needs a readable VPS', () => {
  assert.equal(pickTarget({ vps: ok }), 'vps');
  assert.equal(pickTarget({ vps: null }), 'hf-cpu');
});
test('parseVpsStatus reads /proc/loadavg + MemAvailable (+ live release run dirs) and refuses anything else', () => {
  assert.deepEqual(parseVpsStatus('0.83 0.70 0.66 2/911 12345\n16384000'), { load1: 0.83, freeRamMb: 16000, releaseRuns: 0 });
  assert.deepEqual(parseVpsStatus('0.83 0.70 0.66 2/911 12345\n16384000\n2'), { load1: 0.83, freeRamMb: 16000, releaseRuns: 2 });
  assert.equal(parseVpsStatus('0.83 0.70 0.66 2/911 12345\n16384000\nx'), null);
  assert.equal(parseVpsStatus(''), null);
  assert.equal(parseVpsStatus('garbage'), null);
  assert.equal(parseVpsStatus('0.5 0.5 0.5 1/2 3\nnotanumber'), null);
});

// ---- the boundary: who may start a heavy job ----
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  if (name === 'node_modules' || name.startsWith('.')) return [];
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : /\.(mjs|js|sh)$/.test(name) ? [p] : [];
});
// `hf jobs run` (a Hugging Face job) or an ssh that runs a test suite / capture on the box.
const LAUNCH = /['"]jobs['"]\s*,\s*['"]run['"]|hf\s+jobs\s+run|ssh[^\n]*\b(run-unit|run-rows|capture)\b/;
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*(\/\/|#)/.test(l)).map(l => l.replace(/\s\/\/\s.*$/, '')).join('\n');
const offenders = () => walk('scripts').filter(f => f !== 'scripts/lib/waterfall.mjs' && LAUNCH.test(code(readFileSync(f, 'utf8')))).sort();

// Shrink-only (like K7's list): delete a line when its script is converted to call pickTarget; adding one fails the test below.
const KNOWN = [
  'scripts/capture-mac.sh',            // capture/stills over ssh (converted Monday)
  'scripts/gpu-run.mjs',               // GPU rows (HF GPU only for GPU rows; converted Monday)
  'scripts/hf-wall-rows.mjs',          // T4 wall rows of a release (converted with release rows)
  'scripts/vps-shadow-rows.sh',        // the older ssh rows runner
];
test('boundary: no script starts a heavy job outside waterfall.mjs except the shrink-only KNOWN list', () => {
  const found = offenders();
  const fresh = found.filter(f => !KNOWN.includes(f));
  assert.deepEqual(fresh, [], `these call hf jobs run / an ssh suite directly; route them through scripts/lib/waterfall.mjs pickTarget (never add to KNOWN): ${fresh.join(', ')}`);
});
test('boundary: KNOWN only shrinks (a converted script must be deleted from the list)', () => {
  const found = offenders();
  const stale = KNOWN.filter(f => !found.includes(f));
  assert.deepEqual(stale, [], `converted: delete from KNOWN: ${stale.join(', ')}`);
});

test('a release run owns the VPS: a lane job spills to Hugging Face CPU while a release run dir exists; a release job (not a lane) is unaffected', () => {
  const busy = { load1: 1, freeRamMb: 20000, releaseRuns: 1 };
  assert.equal(pickTarget({ lane: true, vps: busy, mem: 1024 }), 'hf-cpu', 'lane job waits out the release run on HF');
  assert.equal(pickTarget({ lane: true, vps: { ...busy, releaseRuns: 0 }, mem: 1024 }), 'vps', 'no release run: the lane may use the VPS');
  assert.equal(pickTarget({ vps: busy, mem: 1024 }), 'vps', 'a release job never waits behind the lock');
  assert.equal(pickTarget({ lane: true, gfx: true, vps: busy }), 'hf-t4', 'graphics still go to the T4');
});

test('the release lock is a run dir under /root/deploy-runs and goes stale after 90 minutes (a crashed release cannot pin lane jobs to Hugging Face forever)', () => {
  assert.match(VPS_STATUS_CMD, /find \/root\/deploy-runs -mindepth 1 -maxdepth 1 -type d -mmin -90/);
  assert.equal(parseVpsStatus('1 1 1 1/1 1\n20000000\n0')!.releaseRuns, 0, 'only stale dirs counted as zero by the find: lane jobs may use the VPS again');
  assert.equal(pickTarget({ lane: true, vps: parseVpsStatus('1 1 1 1/1 1\n20000000\n0') }), 'vps');
  assert.equal(pickTarget({ lane: true, vps: parseVpsStatus('1 1 1 1/1 1\n20000000\n1') }), 'hf-cpu');
});

// ---- Mac -> VPS -> Hugging Face (Dom 2026-10-12): the four branches, each with its one-word reason ----
const macFree = { load5: 2.1, busy: false }, macLoaded = { load5: ROUTER.macMaxLoad5, busy: false }, macBusy = { load5: 1, busy: true };
test('router branch 1: the Mac is free (5-minute load below the limit, no release Mac row) -> the Mac, even for a graphics job', () => {
  assert.deepEqual(routeJob({ mac: macFree, vps: ok, mem: 1024 }), { target: 'mac', reason: 'mac-free' });
  assert.equal(routeJob({ gfx: true, mac: macFree, vps: ok }).target, 'mac');
  assert.equal(routeJob({ mac: { load5: ROUTER.macMaxLoad5 - 0.1 }, vps: null }).target, 'mac');
});
test('router branch 2: the Mac is busy or at the limit and the VPS is free -> the VPS (a graphics job only when its result does not time a real GPU)', () => {
  for (const mac of [macLoaded, macBusy, { load5: NaN }]) assert.equal(routeJob({ mac, vps: ok, mem: 1024 }).target, 'vps');
  assert.equal(routeJob({ gfx: true, softwareGl: true, mac: macBusy, vps: ok }).target, 'vps');
});
test('router branch 3: both busy -> Hugging Face; the CPU tier for plain work, the T4 only for graphics, each with its reason word', () => {
  const busyVps = { load1: ROUTER.vpsMaxLoad1, freeRamMb: 20000 };
  assert.deepEqual(routeJob({ mac: macBusy, vps: busyVps }), { target: 'hf-cpu', reason: 'vps-saturated' });
  assert.deepEqual(routeJob({ gfx: true, softwareGl: true, mac: macBusy, vps: busyVps }), { target: 'hf-t4', reason: 'vps-saturated' });
  assert.deepEqual(routeJob({ gfx: true, mac: macBusy, vps: ok }), { target: 'hf-t4', reason: 'mac-busy' });   // a real-GPU row: the VPS cannot take it, so the Mac being busy is the reason
  assert.deepEqual(routeJob({ gfx: true, vps: ok }), { target: 'hf-t4', reason: 'gpu-only' });   // no Mac tier in play
});
test('router branch 4: a saturated or unreadable VPS never takes a job, at the limit and above, and a release run keeps lane jobs off it', () => {
  for (const vps of [{ load1: 16, freeRamMb: 9999 }, { load1: 16.5, freeRamMb: 9999 }, { load1: 40, freeRamMb: 9999 }, null]) assert.equal(routeJob({ mac: macBusy, vps }).target, 'hf-cpu');
  assert.equal(routeJob({ mac: macBusy, vps: { ...ok, releaseRuns: 1 }, lane: true }).target, 'hf-cpu');
  assert.equal(routeJob({ mac: macBusy, vps: { ...ok, releaseRuns: 1 } }).target, 'vps');   // a release's own jobs are not lane jobs
});
test('the VPS gate in scripts/lanejob/lanejob.sh is the same number as ROUTER.vpsMaxLoad1 (and the probe applies it)', () => {
  const sh = readFileSync('scripts/lanejob/lanejob.sh', 'utf8');
  assert.equal(Number(/LANEJOB_MAX_LOAD1:-(\d+)/.exec(sh)?.[1]), ROUTER.vpsMaxLoad1);
  assert.match(sh, /vps_saturated; then echo "would=spill reason=load"/);
});

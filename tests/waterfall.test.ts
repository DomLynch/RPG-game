// The work waterfall's one router (Dom 2026-10-11): Mac = coding + WebKit rows only; VPS first; Hugging Face CPU when the VPS is busy or has no room;
// the T4 only for graphics. scripts/lib/waterfall.mjs pickTarget decides; this file pins every branch and the boundary: no script launches a heavy job
// outside waterfall.mjs except the shrink-only KNOWN list (the entry points not yet converted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { pickTarget, routeProbe, MAC_MAX_LOAD5, VPS_MAX_LOAD1, VPS_STATUS_CMD, parseVpsStatus } = await import('../scripts/lib/waterfall.mjs');
const ok = { load1: 0.8, freeRamMb: 20000 };

test('pickTarget: a quiet VPS with room takes the job', () => {
  assert.equal(pickTarget({ vps: ok, mem: 4096 }), 'vps');
});
test('pickTarget: the VPS load limit is 12 (below takes it, at or above spills to Hugging Face CPU; Strategy 2026-10-12)', () => {
  assert.equal(VPS_MAX_LOAD1, 12);
  assert.equal(pickTarget({ vps: { ...ok, load1: 11.9 }, mem: 1024 }), 'vps');
  assert.equal(pickTarget({ vps: { ...ok, load1: 12 }, mem: 1024 }), 'hf-cpu');
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

// routeProbe: the four branches of Mac first (Hooks Dev's probe lines, 2026-10-12), and the refusals.
test('routeProbe branch 1: the Mac says would=mac -> mac (the VPS is not consulted)', () => {
  assert.deepEqual(routeProbe({ mac: 'would=mac', vps: 'would=vps' }), { target: 'mac', reason: 'mac-free' });
  assert.deepEqual(routeProbe({ mac: 'would=mac', gfx: true }), { target: 'mac', reason: 'mac-free' }, 'a --gpu job the Mac accepts runs on the Mac');
});
test('routeProbe branch 2: the Mac skips, the VPS takes it -> vps, with the Mac\'s reason', () => {
  assert.deepEqual(routeProbe({ mac: 'would=skip reason=load=9.4', vps: 'would=vps' }), { target: 'vps', reason: 'mac-load=9.4' });
  assert.deepEqual(routeProbe({ mac: '', vps: 'would=vps' }), { target: 'vps', reason: 'no-mac' }, 'no Mac tier (the VPS itself, a cloud lane)');
});
test('routeProbe branch 3: the Mac skips and the VPS spills -> Hugging Face CPU; an unreadable VPS spills too, never onto it', () => {
  for (const r of ['slots', 'release-lock', 'load']) assert.deepEqual(routeProbe({ mac: 'would=skip reason=slot-busy', vps: `would=spill reason=${r}` }), { target: 'hf-cpu', reason: `mac-slot-busy,vps-${r}` });
  assert.deepEqual(routeProbe({ mac: 'would=skip reason=release-in-flight', vps: '' }), { target: 'hf-cpu', reason: 'mac-release-in-flight,vps-unreadable' });
});
test('routeProbe branch 4: graphics the Mac skips go to the T4, never the VPS (no GPU there)', () => {
  assert.deepEqual(routeProbe({ mac: 'would=skip reason=mac-row-running', vps: 'would=vps', gfx: true }), { target: 'hf-t4', reason: 'gpu-only,mac-mac-row-running' });
  assert.deepEqual(routeProbe({ mac: '', gfx: true }), { target: 'hf-t4', reason: 'gpu-only,no-mac' });
});
test('routeProbe: a refusal from either tier is final', () => {
  assert.equal(routeProbe({ mac: 'would=refuse', vps: 'would=vps' }).target, 'refuse');
  assert.equal(routeProbe({ mac: 'would=skip reason=denied', vps: 'would=refuse' }).target, 'refuse');
});

test('the router\'s numbers cannot drift from the scripts that enforce them', () => {
  // After #2304, lanejob.sh reads VPS_MAX_LOAD1 with sed on this exact line shape (Hooks Dev): keep it a literal.
  const src = readFileSync('scripts/lib/waterfall.mjs', 'utf8');
  assert.match(src, new RegExp(`^export const VPS_MAX_LOAD1 = ${VPS_MAX_LOAD1};$`, 'm'));
  assert.match(src, new RegExp(`^export const MAC_MAX_LOAD5 = ${MAC_MAX_LOAD5};$`, 'm'));
  // The Mac gate lives in lanejob-mac.sh (5-minute load); the router's copy must be that number.
  const mac = readFileSync('scripts/lanejob/lanejob-mac.sh', 'utf8');
  const gate = /busy\(\) \{ awk -v l="\$\(load1\)" 'BEGIN \{ exit !\(l >= ([0-9.]+)\) \}'; \}/.exec(mac);
  assert.ok(gate, 'the Mac wrapper\'s busy() gate');
  assert.equal(Number(gate![1]), MAC_MAX_LOAD5);
  assert.equal(MAC_MAX_LOAD5, 8);
});

test('route-probe.mjs: one line from the two real probes, the VPS asked only when it can matter', async () => {
  const { mkdtempSync, writeFileSync, chmodSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'route-probe-')), log = join(dir, 'log');
  const stub = (name: string, answer: string) => { const p = join(dir, name); writeFileSync(p, `#!/bin/sh\necho "${name} $*" >> '${log}'\necho '${answer}'\n`); chmodSync(p, 0o755); return p; };
  const probe = (mac: string, vps: string, extra: string[] = []) => spawnSync(process.execPath, ['scripts/route-probe.mjs', ...extra, '--', 'npm', 'test'], { encoding: 'utf8',
    env: { ...process.env, ROUTE_MAC_PROBE: mac, ROUTE_VPS_PROBE: vps } });
  let r = probe(stub('mac', 'would=mac'), stub('vps', 'would=vps'));
  assert.equal(r.stdout, 'would=mac reason=mac-free\n');
  assert.equal(readFileSync(log, 'utf8'), 'mac --probe npm test\n', 'the Mac said yes: the VPS is not asked');
  r = probe(stub('mac2', 'would=skip reason=load=9'), stub('vps2', 'would=spill reason=slots'));
  assert.equal(r.stdout, 'would=hf-cpu reason=mac-load=9,vps-slots\n');
  r = probe(stub('mac3', 'would=skip reason=slot-busy'), stub('vps3', 'would=vps'), ['--gfx']);
  assert.equal(r.stdout, 'would=hf-t4 reason=gpu-only,mac-slot-busy\n');
  assert.match(readFileSync(log, 'utf8'), /mac3 --probe --gpu -- npm test\n$/, 'graphics: the Mac is asked in its --gpu form and the VPS is not asked');
  r = probe('off', join(dir, 'missing-binary'));
  assert.equal(r.stdout, 'would=hf-cpu reason=no-mac,vps-unreadable\n', 'a probe that cannot run answers nothing: spill, never onto an unread box');
  assert.equal(spawnSync(process.execPath, ['scripts/route-probe.mjs'], { encoding: 'utf8' }).status, 2);
});

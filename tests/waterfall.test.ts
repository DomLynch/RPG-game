// The work waterfall's one router (Dom 2026-10-11): Mac = coding + WebKit rows only; VPS first; Hugging Face CPU when the VPS is busy or has no room;
// the T4 only for graphics. scripts/lib/waterfall.mjs pickTarget decides; this file pins every branch and the boundary: no script launches a heavy job
// outside waterfall.mjs except the shrink-only KNOWN list (the entry points not yet converted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const { pickTarget, VPS_MAX_LOAD1, parseVpsStatus } = await import('../scripts/lib/waterfall.mjs');
const ok = { load1: 0.8, freeRamMb: 20000 };

test('pickTarget: a quiet VPS with room takes the job', () => {
  assert.equal(pickTarget({ vps: ok, mem: 4096 }), 'vps');
});
test('pickTarget: the VPS load limit is 12 (below takes it, at or above spills to Hugging Face CPU)', () => {
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
test('parseVpsStatus reads /proc/loadavg + MemAvailable output and refuses anything else', () => {
  assert.deepEqual(parseVpsStatus('0.83 0.70 0.66 2/911 12345\n16384000'), { load1: 0.83, freeRamMb: 16000 });
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

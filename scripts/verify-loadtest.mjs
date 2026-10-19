// The replay-verification load test (Lead 2026-10-19: "replay CPU is the real cost at scale"). The writer verifies a world kill by replaying its record in ONE worker thread
// (origins/server/world-verify-pool.ts: a bounded queue, a per-job timeout, fail closed to 'busy'/'timeout'). This measures how many verified kills per second that pool sustains,
// and what each added worker buys, with the REAL pool and the REAL verifier on an honest recorded wolf kill. No database, no network, no Supabase, nothing real: it reads no environment
// variable that names a host.
//   node scripts/verify-loadtest.mjs [--seconds=30] [--rates=0.5,1,2,4] [--workers=1] [--grid]      (--grid: the built-in sweep 1 worker 0.5-4/s, 4 workers 2-16/s, 8 workers 4-32/s)
// Output: per step the offered rate, jobs ok / busy (queue full) / timeout / other, the verified share, latency p50/p95/p99 of the jobs that were answered, the queue peak and the
// completed jobs per second. A step is "saturated" when the verified share drops under 95% or the p95 passes 5 s.
import { performance } from 'node:perf_hooks';
import { cpus, loadavg } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';
import console from 'node:console';
import { encodeWorldRecord } from '../src/fight/server.ts';
import { createWorldCombat as live } from '../src/fight/world-combat.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { defaultZoneSpawns } from '../origins/server/world-spawns.ts';
import { verifyWorldRecord } from '../origins/server/world-verify.ts';
import { createVerifyPool } from '../origins/server/world-verify-pool.ts';

const arg = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? hit.split('=')[1] : fallback; };
const SECONDS = Number(arg('seconds', 30)), LEVEL = Number(arg('level', 1)), GRID = process.argv.includes('--grid');   // --level: the wolf's level (1 = a short fight; higher = a longer fight to replay)
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null;
const r1 = n => n === null ? null : Math.round(n * 10) / 10;

const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('encounter content does not load');
const wolf = [...defaultZoneSpawns(loaded.value).values()].find(s => s.spec.character === 'character:ash-wolf');
const spawn = { ...wolf, spec: { ...wolf.spec, level: LEVEL } };   // the scripted hero kills it (the same honest kill as origins/server/world-verify.test.ts)
async function honest() {
  const fell = []; let rec = null; const at = { x: spawn.spec.home.x, z: spawn.spec.home.z };
  const spec = { id: spawn.spec.id, body: 'wolf', level: LEVEL, name: 'wolf' };
  const mobs = { within: (x, z, r) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, onKill: s => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - 1.4, facing: 0 };
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find(q => q.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); } }
  if (!rec) throw new Error('the scripted hero did not kill the wolf');
  return { rec, text: await encodeWorldRecord(rec) };
}
const { rec, text } = await honest();
const one0 = performance.now(), v0 = await verifyWorldRecord(text, spawn, 'wolf'); const oneMs = performance.now() - one0;
if (!v0.ok) throw new Error(`the honest record did not verify: ${JSON.stringify(v0)}`);
console.log(JSON.stringify({ baseline: { ticks: rec.steps.length, recordChars: text.length, verifyMsMainThreadCold: r1(oneMs), cores: cpus().length, load1: r1(loadavg()[0]) } }));

async function step(workers, rate) {
  const pools = Array.from({ length: workers }, () => createVerifyPool());   // each pool = one worker thread with its own bounded queue, as production has ONE
  const lat = [], status = {}; let peak = 0, k = 0; const pending = [], t0 = performance.now(), total = Math.round(rate * SECONDS);
  for (let n = 0; n < Math.max(1, total); n++) {
    const wait = t0 + (n / rate) * 1000 - performance.now(); if (wait > 0) await sleep(wait);
    const pool = pools[k++ % workers], s0 = performance.now();
    pending.push(pool.verify({ text, spawn: { spec: spawn.spec }, kind: 'wolf' }).then(v => { const key = v.ok ? 'ok' : v.reason; status[key] = (status[key] ?? 0) + 1; if (v.ok) lat.push(performance.now() - s0); }));
    peak = Math.max(peak, ...pools.map(p => p.stats().queued));
  }
  await Promise.all(pending); const wall = (performance.now() - t0) / 1000; pools.forEach(p => p.close());
  lat.sort((a, b) => a - b); const ok = status.ok ?? 0, offered = Math.max(1, total), share = ok / offered;
  const p95 = pct(lat, 95); const saturated = share < 0.95 || (p95 ?? 0) > 5000;
  return { workers, offeredPerSec: rate, offered, status, verifiedShare: Math.round(share * 1000) / 10, okPerSec: r1(ok / wall), wallS: r1(wall), p50: r1(pct(lat, 50)), p95: r1(p95), p99: r1(pct(lat, 99)), queuePeak: peak, saturated, load1: r1(loadavg()[0]) };
}
const grid = GRID ? [[1, [0.5, 1, 2, 4]], [4, [2, 4, 8, 16]], [8, [4, 8, 16, 32]]] : [[Number(arg('workers', 1)), String(arg('rates', '0.5,1,2,4')).split(',').map(Number)]];
for (const [workers, rates] of grid) for (const rate of rates) { const r = await step(workers, rate); console.log(JSON.stringify(r)); }
process.exit(0);

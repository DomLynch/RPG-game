// The HF half of the work waterfall (Dom/Lead 2026-10-10): Mac -> VPS -> HF CPU, and the T4 for graphics only. Every lane shares one Hugging Face account and
// one Mac, so the caps are counted from `hf jobs ps` (the truth) under a Mac-local lock, not from anything a lane remembers:
//   hf-cpu (cpu-upgrade): at most 4 live jobs in all; a lane's generic job stops at 3, so one slot is always free for the deploy lane's unit/rows jobs
//                         (the release is what waits on them).
//   hf-t4  (t4-medium)  : at most 4 live jobs; graphics work only (stills, clips, Blender, browser rows); CPU work never gets a T4.
// A launcher calls withSlot(): it waits (polling) for a slot, runs `launch()` while holding the lock (so two lanes cannot both take the last slot), and the caller
// prints tierLine(). No slot within maxWaitS => withSlot returns { ok: false } and the caller exits 75 (the submit path requeues to the VPS).
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CAPS = { 'cpu-upgrade': { total: 4, generic: 3, tier: 'hf-cpu' }, 't4-medium': { total: 4, generic: 4, tier: 'hf-t4' } };
const LIVE = /^(RUNNING|STARTING|PENDING|SCHEDULING|QUEUED)$/;
export const tierOf = flavor => CAPS[flavor]?.tier ?? null;
export const tierLine = (flavor, slot, queuedS) => `tier=${tierOf(flavor)} slot=${slot} queued=${Math.round(queuedS)}s`;

// jobs: the parsed `hf jobs ps --format json` array. generic = a lane's job (kept off the reserved slot); false = the deploy lane's unit/rows/wall-row jobs.
export function slotDecision(flavor, jobs, generic) {
  const cap = CAPS[flavor];
  if (!cap) throw new Error(`no caps for flavor ${flavor}`);
  const used = (Array.isArray(jobs) ? jobs : []).filter(j => j?.flavor === flavor && LIVE.test(String(j?.status?.stage ?? j?.status ?? ''))).length;
  const limit = generic ? cap.generic : cap.total;
  return { ok: used < limit, used, limit, slot: used + 1 };
}

const sleepMs = ms => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
const LOCK = process.env.HF_SLOT_LOCK || join(tmpdir(), 'frankendom-hf-slots.lock');
// mkdir is atomic; a lock older than 120 s belongs to a dead launcher and is broken.
function lock(maxMs) {
  const t0 = Date.now();
  for (;;) {
    try { mkdirSync(LOCK); return true; } catch { /* held */ }
    try { if (Date.now() - statSync(LOCK).mtimeMs > 120_000) rmSync(LOCK, { recursive: true, force: true }); } catch { /* gone */ }
    if (Date.now() - t0 > maxMs) return false;
    sleepMs(500);
  }
}
const unlock = () => { try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* already gone */ } };

export function livePs(hf = 'hf') {
  const r = spawnSync(hf, ['jobs', 'ps', '--format', 'json'], { encoding: 'utf8', timeout: 60_000 });
  try { const parsed = JSON.parse(r.stdout || '[]'); return r.status === 0 && Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

// Returns { ok: true, slot, queuedS, value } (value = what launch() returned) or { ok: false, used, limit, queuedS }.
// An hf that cannot list jobs (null) fails OPEN: a cap is a courtesy to the pool, never a reason to lose a job.
export function withSlot({ hf = 'hf', flavor, generic = true, maxWaitS = 600, pollS = 15, launch, ps = livePs, sleep = sleepMs, now = Date.now }) {
  const t0 = now();
  for (;;) {
    if (!lock(Math.max(5_000, maxWaitS * 1000))) return { ok: false, used: -1, limit: -1, queuedS: (now() - t0) / 1000 };
    try {
      const jobs = ps(hf), d = jobs === null ? { ok: true, used: 0, limit: 0, slot: 1 } : slotDecision(flavor, jobs, generic);
      if (d.ok) return { ok: true, slot: d.slot, queuedS: (now() - t0) / 1000, value: launch() };
      if ((now() - t0) / 1000 >= maxWaitS) return { ok: false, used: d.used, limit: d.limit, queuedS: (now() - t0) / 1000 };
    } finally { unlock(); }
    sleep(pollS * 1000);
  }
}

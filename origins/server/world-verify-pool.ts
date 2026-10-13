// BASE: replay off the request thread. ONE worker, a bounded queue, a per-job timeout (terminate + respawn). A full queue, a timeout or a dead worker is an UNVERIFIED verdict (fail closed);
// the caller decides what unverified pays. Limits: a busy legal fight replays in ~1 s, so one worker verifies about 1 kill/s. Size the pool from real kill rates before the flag ever goes on.
import { Worker } from 'node:worker_threads';
import type { Verdict, VerifyJob } from './world-verify.ts';

export type WorkerLike = { postMessage(m: unknown): void; terminate(): unknown; on(ev: 'message' | 'error' | 'exit', fn: (a: never) => void): unknown };
export type VerifyPool = { verify(job: VerifyJob): Promise<Verdict>; close(): void; stats(): { queued: number; running: boolean; respawns: number } };

export function createVerifyPool(o: { make?: () => WorkerLike; queue?: number; timeoutMs?: number } = {}): VerifyPool {
  const make = o.make ?? ((): WorkerLike => new Worker(new URL('./world-verify-worker.ts', import.meta.url)) as unknown as WorkerLike);
  const max = o.queue ?? 16, timeoutMs = o.timeoutMs ?? 3000;
  type Item = { job: VerifyJob; resolve: (v: Verdict) => void };
  const queue: Item[] = [];
  let w: WorkerLike | null = null, cur: { id: number; item: Item; timer: ReturnType<typeof setTimeout> } | null = null, seq = 0, closed = false, respawns = 0;
  const drop = (): void => { const x = w; w = null; try { void x?.terminate(); } catch { /* already gone */ } };
  const finish = (v: Verdict): void => { if (!cur) return; clearTimeout(cur.timer); const c = cur; cur = null; c.item.resolve(v); next(); };
  function start(): WorkerLike {
    const x = make(); respawns++;
    x.on('message', ((m: { id: number; v: Verdict }) => { if (x === w && cur && m.id === cur.id) finish(m.v); }) as never);
    x.on('error', (() => { if (x !== w) return; drop(); finish({ ok: false, reason: 'worker died' }); }) as never);
    x.on('exit', (() => { if (x !== w) return; w = null; finish({ ok: false, reason: 'worker died' }); }) as never);
    return x;
  }
  function next(): void {
    if (closed || cur) return;
    const item = queue.shift(); if (!item) return;
    w ??= start();
    const id = ++seq;
    cur = { id, item, timer: setTimeout(() => { drop(); finish({ ok: false, reason: 'timeout' }); }, timeoutMs) };
    try { w.postMessage({ id, ...item.job }); } catch { drop(); finish({ ok: false, reason: 'worker died' }); }
  }
  return {
    verify(job) {
      if (closed) return Promise.resolve({ ok: false, reason: 'busy' });
      if (queue.length >= max) return Promise.resolve({ ok: false, reason: 'busy' });
      return new Promise<Verdict>((resolve) => { queue.push({ job, resolve }); next(); });
    },
    close() { closed = true; for (const i of queue.splice(0)) i.resolve({ ok: false, reason: 'busy' }); if (cur) { clearTimeout(cur.timer); cur.item.resolve({ ok: false, reason: 'busy' }); cur = null; } drop(); },
    stats: () => ({ queued: queue.length, running: cur !== null, respawns }),
  };
}

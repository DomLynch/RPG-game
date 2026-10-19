// S1 load test, the duel relay half (docs/specs/origins/launch-gates.md S1; Lead's shape: 15 concurrent duel pairs). The REAL relay (scripts/duel-relay.mjs startRelay) runs in a CHILD process, so its CPU
// is its own; 15 pairs (30 sockets) join rooms minted over its real HTTP route and play as a duel does: every side sends one small binary message per sim tick (60 Hz, 40 bytes, the sender's clock inside),
// the relay forwards it to the peer, and the peer measures the ONE-WAY forward lag against that clock, in sim ticks (1 tick = 1/60 s; Lead's bound: p99 under 1 tick). Reported: lag p50/p95/p99/max
// in ms and ticks, messages sent and received per side (a gap is loss or a close), sockets closed early, the relay's CPU (share of one core, from /proc) and memory, and the box's load before and after.
// A run on a busy box is flagged UNQUIET and its numbers are not for the S1 report. Local and loopback only; no Supabase, no secret that matters (a throwaway HMAC key), no production.
//   node scripts/relay-loadtest.mjs [--pairs=15] [--seconds=30] [--warmup=3] [--hz=60]
// The per-IP caps (8 sockets, 10 mints a minute, 30 joins) are lifted IN THE CHILD ONLY: 30 sockets come from one address here, from 30 addresses in production. The per-socket (240 messages a second)
// and per-room (64 KB a second) caps stay as they are, so a duel that would trip them trips them here.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import process from 'node:process';
import console from 'node:console';
import { setTimeout as sleep } from 'node:timers/promises';
/* global WebSocket, fetch, performance */

if (process.argv[2] === '--relay') {
  const { RELAY, startRelay } = await import('./duel-relay.mjs');
  RELAY.ipSockets = 10_000; RELAY.ipMintsPerMinute = 10_000; RELAY.ipJoinsPerMinute = 10_000;
  const relay = await startRelay({ port: 0, secret: 'loadtest-secret-loadtest-secret-loadtest', admit: null, log: () => {} });
  console.log(`port ${relay.port}`);
} else {
  const arg = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? Number(hit.split('=')[1]) : fallback; };
  const PAIRS = arg('pairs', 15), SECONDS = arg('seconds', 30), WARMUP = arg('warmup', 3), HZ = arg('hz', 60), TICK_MS = 1000 / 60;
  const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null;
  const r1 = n => n === null ? null : Math.round(n * 100) / 100;
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--relay'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise((resolve, reject) => { let out = ''; child.stdout.on('data', d => { out += d; const m = /port (\d+)/.exec(out); if (m) resolve(Number(m[1])); }); child.on('exit', c => reject(Error(`relay exited ${c}`))); });
  const cpuTicks = () => { const f = readFileSync(`/proc/${child.pid}/stat`, 'utf8').split(') ')[1].split(' '); return Number(f[11]) + Number(f[12]); };   // utime + stime, in clock ticks (100/s)
  const rssKb = () => Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${child.pid}/status`, 'utf8'))?.[1] ?? 0);
  const quiet = () => loadavg()[0] <= cpus().length * 0.5;
  try {
    const sockets = [];   // { ws, pair, side, sent, got, closed }
    for (let p = 0; p < PAIRS; p++) {
      const res = await fetch(`http://127.0.0.1:${port}/duel/relay/room`, { method: 'POST' });
      const { tokens } = await res.json();
      for (const side of [0, 1]) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/duel/relay?token=${tokens[side]}`); ws.binaryType = 'arraybuffer';
        const s = { ws, pair: p, side, sent: 0, got: 0, closed: false, open: new Promise(r => { ws.onopen = r; }) };
        ws.onclose = () => { s.closed = true; };
        sockets.push(s);
      }
    }
    await Promise.all(sockets.map(s => s.open));
    await sleep(500);   // both peers are up
    const lag = [], T0 = performance.timeOrigin;
    let measuring = false;
    for (const s of sockets) s.ws.onmessage = ev => {
      if (!(ev.data instanceof ArrayBuffer) || ev.data.byteLength !== 40) return;   // peer/beat notices are text
      const sentAt = new Float64Array(ev.data.slice(0, 8))[0];
      if (measuring) { s.got++; lag.push(T0 + performance.now() - sentAt); }
    };
    const load0 = loadavg()[0];
    let cpu0 = 0, wall0 = 0;
    const loop = async () => {
      const t0 = performance.now(); let k = 0;
      for (;;) {
        const due = t0 + (k / HZ) * 1000, wait = due - performance.now(); if (wait > 0) await sleep(wait);
        const elapsed = (performance.now() - t0) / 1000;
        if (elapsed > WARMUP + SECONDS) return;
        if (!measuring && elapsed >= WARMUP) { measuring = true; cpu0 = cpuTicks(); wall0 = performance.now(); }
        for (const s of sockets) if (!s.closed && s.ws.readyState === 1) { const b = new ArrayBuffer(40); new Float64Array(b, 0, 1)[0] = T0 + performance.now(); s.ws.send(b); if (measuring) s.sent++; }
        k++;
      }
    };
    await loop();
    const wall = (performance.now() - wall0) / 1000, cpuS = (cpuTicks() - cpu0) / 100, sorted = lag.sort((a, b) => a - b);
    const sent = sockets.reduce((n, s) => n + s.sent, 0), got = sockets.reduce((n, s) => n + s.got, 0);
    const report = {
      pairs: PAIRS, sockets: sockets.length, seconds: SECONDS, hz: HZ, cores: cpus().length, quiet: quiet(), load1Before: r1(load0), load1After: r1(loadavg()[0]),
      lagMs: { p50: r1(pct(sorted, 50)), p95: r1(pct(sorted, 95)), p99: r1(pct(sorted, 99)), max: r1(sorted.at(-1) ?? null) },
      lagTicks: { p50: r1(pct(sorted, 50) / TICK_MS), p95: r1(pct(sorted, 95) / TICK_MS), p99: r1(pct(sorted, 99) / TICK_MS), max: r1((sorted.at(-1) ?? 0) / TICK_MS) },
      messagesSent: sent, messagesReceived: got, lossPct: r1(sent ? (1 - got / sent) * 100 : 0), closedEarly: sockets.filter(s => s.closed).length,
      relayCpuOfOneCorePct: r1((cpuS / wall) * 100), relayRssMb: r1(rssKb() / 1024),
    };
    console.log(JSON.stringify(report, null, 1));
    console.log(`relay-loadtest: ${quiet() ? 'quiet box' : 'UNQUIET BOX (load1 above half the cores): not for the S1 report'}; ${PAIRS} pairs, lag p99 ${report.lagMs.p99} ms = ${report.lagTicks.p99} ticks (bound: under 1), relay ${report.relayCpuOfOneCorePct}% of one core, loss ${report.lossPct}%, ${report.closedEarly} sockets closed early`);
  } finally { child.kill(); }
}

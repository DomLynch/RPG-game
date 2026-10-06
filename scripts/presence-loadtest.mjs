// The 100-bot synthetic load test for the presence service (docs/specs/origins/one-shard.md §4, §7 first build). It starts the REAL service as a child
// process (origins/presence/main.ts, test auth, loopback only) and connects N bots over real WebSockets, then reports per layer: players, packets/s and
// bytes/s down, upload messages/s, entities per packet, the server's CPU (of one core) and memory, and the longest tick. Those numbers replace the
// note's est. figures and set the "add a host at ~80% of one host's cap" trigger.
// Run it on the VPS (or any host that is not the Mac), never against production Supabase: it needs no database and no Supabase at all.
//   node scripts/presence-loadtest.mjs [--bots=100] [--seconds=30] [--warmup=5] [--crowd-m=60] [--layer-cap=100] [--max-layers=8]
// --crowd-m: the side of the square the bots wander in (60 puts everyone inside everyone's 40 m radius, the worst case; 300 spreads them over the zone).
// --layer-cap: PRESENCE_SOFT and HARD for the run (100 puts every bot in one layer; the default rules would split 100 bots 80 + 20).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import console from 'node:console';
import process from 'node:process';
import { clearInterval, setInterval, setTimeout } from 'node:timers';
/* global WebSocket, fetch */

const arg = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? Number(hit.split('=')[1]) : fallback; };
const BOTS = arg('bots', 100), SECONDS = arg('seconds', 30), WARMUP = arg('warmup', 5), CROWD_CM = arg('crowd-m', 60) * 100, CAP = arg('layer-cap', 100), PORT = arg('port', 18788), MAX_LAYERS = arg('max-layers', 8);
const ZONE = 30000, STEP_MS = 100, SPEED_CMS = 500;   // bots walk at 5 m/s, uploading at 10 Hz like a real client

const server = spawn(process.execPath, ['origins/presence/main.ts'], {
  env: { ...process.env, ORIGINS_PRESENCE: '1', ORIGINS_PRESENCE_TEST_AUTH: '1', PRESENCE_PORT: String(PORT), PRESENCE_HOST: '127.0.0.1', PRESENCE_SOFT: String(CAP), PRESENCE_HARD: String(CAP), PRESENCE_MAX_LAYERS: String(MAX_LAYERS), PRESENCE_LOG_MS: '3600000', SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => { server.stdout.on('data', d => String(d).includes('listening') && resolve()); server.on('exit', c => reject(new Error(`server exited ${c}`))); });

// Server CPU and memory from the OS: /proc on Linux, ps elsewhere.
const cpuSeconds = () => {
  try { const f = readFileSync(`/proc/${server.pid}/stat`, 'utf8').split(') ')[1].split(' '); return (Number(f[11]) + Number(f[12])) / 100; }
  catch { const t = execFileSync('ps', ['-o', 'time=', '-p', String(server.pid)]).toString().trim().split(':').map(Number); return t.reduce((a, x) => a * 60 + x, 0); }
};
const rssMb = () => { try { return Number(readFileSync(`/proc/${server.pid}/statm`, 'utf8').split(' ')[1]) * 4096 / 1048576; } catch { return Number(execFileSync('ps', ['-o', 'rss=', '-p', String(server.pid)]).toString()) / 1024; } };

const bots = [];
let measuring = false;
const up = (b) => { const m = new Uint8Array(8), v = new DataView(m.buffer); m[0] = 2; v.setUint16(1, Math.round(b.x), true); v.setUint16(3, Math.round(b.z), true); m[5] = b.heading; m[6] = 1; m[7] = 0; return m; };
const lo = (ZONE - CROWD_CM) / 2, hi = lo + CROWD_CM;
for (let i = 0; i < BOTS; i++) {
  const b = { i, x: lo + Math.random() * CROWD_CM, z: lo + Math.random() * CROWD_CM, heading: 0, tx: 0, tz: 0, layer: 0, packets: 0, bytes: 0, entities: 0, sent: 0, ws: null };
  const pick = () => { b.tx = lo + Math.random() * CROWD_CM; b.tz = lo + Math.random() * CROWD_CM; };
  pick(); bots.push(b);
  b.ws = new WebSocket(`ws://127.0.0.1:${PORT}/origins/presence`, ['frankendom.presence.v1', `token.bot-${(i + 1).toString(36)}`]);
  b.ws.binaryType = 'arraybuffer';
  b.ws.onmessage = ev => {
    if (typeof ev.data === 'string') { const m = JSON.parse(ev.data); if (m.t === 'hello') { b.layer = m.layer; b.ready = true; } return; }
    if (measuring) { b.packets++; b.bytes += ev.data.byteLength; b.entities += new Uint8Array(ev.data)[3]; }
  };
  b.ws.onerror = () => { b.failed = true; };
  b.walk = setInterval(() => {
    if (!b.ready || b.ws.readyState !== 1) return;
    const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz), step = SPEED_CMS * STEP_MS / 1000;
    if (d < step) pick(); else { b.x += dx / d * step; b.z += dz / d * step; b.heading = Math.round((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * 255); }
    b.x = Math.min(hi, Math.max(lo, b.x)); b.z = Math.min(hi, Math.max(lo, b.z));
    b.ws.send(up(b)); if (measuring) b.sent++;
  }, STEP_MS);
  if (i % 10 === 9) await new Promise(r => setTimeout(r, 50));   // a gentle ramp: no connect storm
}
await new Promise(r => setTimeout(r, 1500));
const failed = bots.filter(b => b.failed || !b.ready).length;
console.log(`connected ${BOTS - failed}/${BOTS} bots; warming up ${WARMUP}s, measuring ${SECONDS}s`);
await new Promise(r => setTimeout(r, WARMUP * 1000));

const health = async () => (await fetch(`http://127.0.0.1:${PORT}/origins/presence/health`)).json();
const cpu0 = cpuSeconds(), t0 = Date.now(), h0 = await health();
measuring = true;
await new Promise(r => setTimeout(r, SECONDS * 1000));
measuring = false;
const wall = (Date.now() - t0) / 1000, cpu = cpuSeconds() - cpu0, h1 = await health(), rss = rssMb();

const layers = new Map();
for (const b of bots) { if (!b.ready) continue; const l = layers.get(b.layer) ?? { bots: 0, packets: 0, bytes: 0, entities: 0, sent: 0 }; l.bots++; l.packets += b.packets; l.bytes += b.bytes; l.entities += b.entities; l.sent += b.sent; layers.set(b.layer, l); }
const rows = [...layers].map(([id, l]) => ({ layer: id, players: l.bots, packetsPerSec: +(l.packets / wall).toFixed(0), downKBpsTotal: +(l.bytes / wall / 1024).toFixed(1), downKBpsPerClient: +(l.bytes / wall / 1024 / l.bots).toFixed(2), downKbitPerClient: +(l.bytes / wall * 8 / 1000 / l.bots).toFixed(1), entitiesPerPacket: +(l.entities / Math.max(1, l.packets)).toFixed(1), upMsgPerSecTotal: +(l.sent / wall).toFixed(0) }));
const result = { bots: BOTS, connected: BOTS - failed, crowdM: CROWD_CM / 100, layerCap: CAP, seconds: +wall.toFixed(1), serverCpuPercentOfOneCore: +(cpu / wall * 100).toFixed(1), serverRssMb: +rss.toFixed(0), maxTickMs: +h1.maxTickMs.toFixed(2), ticks: h1.ticks - (h0.ticks ?? 0), refused: h1.refused, layers: rows };
console.log(JSON.stringify(result, null, 2));
for (const b of bots) { clearInterval(b.walk); b.ws.close(); }
server.kill(); await once(server, 'exit').catch(() => {});
process.exit(0);

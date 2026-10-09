// Position save (TOP10 row 3, Dom 2026-10-08): presence posts its own observation to the writer on leave, on a zone change and every checkpoint, through one
// bounded queue; a fresh join starts at the place `locate` serves (else presence's memory, else the spawn). origins/presence/saves.ts + origins/presence/server.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from '../origins/presence/interest.ts';
import { saveQueue, type SaveAt } from '../origins/presence/saves.ts';
import { createPresence } from '../origins/presence/server.ts';
import { encodeUp } from '../origins/presence/wire.ts';
import { zoneAt } from '../origins/presence/zones.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 1000) => { for (const end = Date.now() + ms; !ok() && Date.now() < end;) await sleep(5); assert.ok(ok(), 'timed out'); };

test('saveQueue: one post in flight, the newest place per account wins, the oldest account goes past the cap, a failure is logged and not retried', async () => {
  const posted: [string, SaveAt][] = [], logs: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  let inFlight = 0, most = 0;
  const q = saveQueue(async (a, at) => { inFlight++; most = Math.max(most, inFlight); if (!posted.length) await gate; posted.push([a, at]); inFlight--; if (a === 'b') throw new Error('writer down'); }, l => logs.push(l), 2);
  q.push('a', { x: 1, z: 1, atMs: 1 });          // in flight, held by the gate
  q.push('b', { x: 2, z: 2, atMs: 2 });
  q.push('c', { x: 3, z: 3, atMs: 3 });
  q.push('b', { x: 4, z: 4, atMs: 4 });          // b's newer place replaces its queued one and moves it behind c
  q.push('d', { x: 5, z: 5, atMs: 5 });          // past the cap of 2 queued: the oldest queued account (c) is dropped
  assert.deepEqual(q.stats(), { queued: 2, sent: 0, failed: 0 });
  release();
  await until(q.idle);
  assert.equal(most, 1, 'never two posts at once');
  assert.deepEqual(posted.map(([a, at]) => `${a}@${at.x}`), ['a@1', 'b@4', 'd@5'], 'a, then b at its NEWEST place, then d; c was dropped at the cap');
  assert.deepEqual(q.stats(), { queued: 0, sent: 2, failed: 1 });
  assert.equal(logs.length, 1); assert.match(logs[0]!, /position save .* failed \(writer down\)/);
});

test('saveQueue: drop removes an account\'s queued place (a character switch) and leaves the others', async () => {
  const posted: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const q = saveQueue(async (a) => { if (!posted.length) await gate; posted.push(a); }, () => {});
  q.push('a', { x: 1, z: 1, atMs: 1 }); q.push('b', { x: 2, z: 2, atMs: 2 }); q.push('c', { x: 3, z: 3, atMs: 3 });
  q.drop('b'); q.drop('nobody');
  release(); await until(q.idle);
  assert.deepEqual(posted, ['a', 'c'], 'b was switched: its old place is never sent');
});

// A presence with test auth (token `u<n>` = acct(n)), a fast speed cap (one pose may cross a zone edge) and a recording save.
const start = async (o: { locate?: (a: string) => Promise<{ x: number; z: number } | null>; saveEveryMs?: number } = {}) => {
  const saves: [string, SaveAt][] = [];
  const p = createPresence({ verify: async t => (/^u\d$/.test(t) ? acct(Number(t.slice(1))) : null), log: () => {}, rules: { ...RULES, maxSpeedCmS: 1e6 }, locate: o.locate, saveEveryMs: o.saveEveryMs, save: async (a, at) => { saves.push([a, at]); } });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  return { p, saves };
};
const connect = (port: number, token = 'u1') => new Promise<{ ws: WebSocket; hello: { x: number; z: number } }>((res, rej) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/origins/presence`, ['frankendom.presence.v1', `token.${token}`]);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = ev => { if (typeof ev.data === 'string') { const m = JSON.parse(ev.data); if (m.t === 'hello') res({ ws, hello: m }); } };
  ws.onerror = () => rej(new Error('refused'));
});
const pose = (ws: WebSocket, x: number, z: number) => ws.send(encodeUp({ x, z, heading: 0, anim: 0, flags: 0 }));

test('join: a fresh join starts at the located (saved) place; a locate that fails or answers nothing starts at the spawn', async () => {
  const at = await start({ locate: async a => (a === acct(1) ? { x: 5000, z: 6000 } : null) });
  try { const { ws, hello } = await connect(at.p.port()); assert.deepEqual([hello.x, hello.z], [5000, 6000], 'the hello carries the saved place'); ws.close(); } finally { await at.p.close(); }
  for (const locate of [async () => { throw new Error('writer down'); }, async () => null]) {
    const s = await start({ locate: locate as never });
    try { const { ws, hello } = await connect(s.p.port()); assert.deepEqual([hello.x, hello.z], [15000, 15000], 'the spawn, never an invented place'); ws.close(); } finally { await s.p.close(); }
  }
});

test('save: leaving saves the last accepted place; a zone change saves at once; nothing is saved while the player stays in one zone', async () => {
  const { p, saves } = await start();
  try {
    const { ws } = await connect(p.port());
    pose(ws, 15500, 15500); await sleep(60);
    assert.equal(zoneAt(15500, 15500), 'pit-yard'); assert.equal(saves.length, 0, 'still in the Pit yard: no save yet');
    pose(ws, 18500, 15500); await until(() => saves.length === 1);   // 35 m east of the yard centre: out of the yard (open square)
    assert.equal(zoneAt(18500, 15500), null);
    assert.deepEqual([saves[0]![0], saves[0]![1].x, saves[0]![1].z], [acct(1), 18500, 15500], 'the zone change saved the new place');
    pose(ws, 18600, 15500); await sleep(60);
    ws.close(); await until(() => saves.length === 2);
    assert.deepEqual([saves[1]![1].x, saves[1]![1].z], [18600, 15500], 'leaving saved the last place');
  } finally { await p.close(); }
});

test('save: the checkpoint saves a player who moved since the last save and skips one who stood still', async () => {
  const { p, saves } = await start({ saveEveryMs: 80 });
  try {
    const { ws } = await connect(p.port());
    await until(() => saves.length === 1, 500);   // first checkpoint: never saved yet
    await sleep(200);
    assert.equal(saves.length, 1, 'standing still: no repeat saves');
    pose(ws, 15100, 15000);
    await until(() => saves.length === 2, 500);
    assert.deepEqual([saves[1]![1].x, saves[1]![1].z], [15100, 15000]);
    ws.close(); await sleep(50);
  } finally { await p.close(); }
});

// The presence service (origins/presence): the wire format, layers and assignment, interest management, the movement clamp, and the real
// socket path. Numbers are the one-shard note's est. figures (80 soft / 100 hard, 40 m radius, 40 nearest, 10/5/2 Hz rings).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeDown, decodeUp, encodeDown, encodeUp, ENTITY_BYTES } from '../origins/presence/wire.ts';
import { RULES, World, type Player } from '../origins/presence/interest.ts';
import { createPresence } from '../origins/presence/server.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('wire: the up pose and the down packet round-trip, an entity is 11 bytes, and a malformed buffer is refused', () => {
  const pose = { x: 12345, z: 65535, heading: 200, anim: 3, flags: 5 };
  assert.deepEqual(decodeUp(encodeUp(pose)), pose);
  assert.equal(decodeUp(new Uint8Array(7)), null);
  assert.equal(decodeUp(Uint8Array.from([9, 0, 0, 0, 0, 0, 0, 0])), null);
  const ents = [{ id: 1, ...pose, tick: 7 }, { id: 99, x: 0, z: 1, heading: 0, anim: 0, flags: 0, tick: 65535 }];
  const packet = encodeDown(70000, ents);
  assert.equal(ENTITY_BYTES, 11);
  assert.equal(packet.length, 4 + 2 * 11);
  assert.deepEqual(decodeDown(packet), { tick: 70000 & 0xffff, entities: ents });
  assert.equal(decodeDown(packet.subarray(0, packet.length - 1)), null);
});

test('layers: fill the fullest layer under the soft cap, open a new one at 80, a friend may fill to 100, and the world can be full', () => {
  const w = new World(RULES, 2);
  const first = w.join(acct(1), 0)!;
  for (let i = 2; i <= 80; i++) assert.equal(w.join(acct(i), 0)!.layer.id, first.layer.id);
  assert.equal(w.layers.get(first.layer.id)!.players.size, 80);
  const eighty1 = w.join(acct(81), 0)!;
  assert.notEqual(eighty1.layer.id, first.layer.id, 'the 81st arrival opens a second layer');
  assert.equal(w.join(acct(82), 0)!.layer.id, eighty1.layer.id, 'then fills the fullest layer under the soft cap');
  const friendJoin = w.join(acct(200), 0, acct(1))!;
  assert.equal(friendJoin.layer.id, first.layer.id, 'a friend goes to the friend\'s layer past the soft cap');
  for (let i = 201; i <= 219; i++) assert.equal(w.join(acct(i), 0, acct(1))!.layer.id, first.layer.id);
  assert.equal(w.layers.get(first.layer.id)!.players.size, 100);
  assert.notEqual(w.join(acct(300), 0, acct(1))!.layer.id, first.layer.id, 'the hard cap holds even for a friend');
  assert.equal(w.join(acct(1), 0), null, 'an account is in once');
  for (let i = 400; i < 480; i++) w.join(acct(i), 0);
  assert.equal(w.join(acct(999), 0), null, 'both layers are at their soft cap and no third may open');
});

test('ids are small and reused, and a leaving player frees the slot; an emptied layer closes after the wait', () => {
  const w = new World();
  const a = w.join(acct(1), 0)!, b = w.join(acct(2), 0)!;
  assert.deepEqual([a.id, b.id], [1, 2]);
  w.leave(a, 10);
  assert.equal(w.join(acct(3), 20)!.id, 1);
  const lone = new World(); const p = lone.join(acct(1), 0)!; lone.leave(p, 100);
  assert.equal(lone.sweep(100 + RULES.emptyLayerMs - 1), 0);
  assert.equal(lone.sweep(100 + RULES.emptyLayerMs), 1);
  assert.equal(lone.layers.size, 0);
});

const put = (w: World, n: number, x: number, z: number): Player => w.join(acct(n), 0, undefined, { x, z })!;

test('interest: only others inside 40 m, nearest first, each ring at its own rate', () => {
  const w = new World();
  const me = put(w, 1, 15000, 15000);
  const near = put(w, 2, 15000 + 500, 15000), mid = put(w, 3, 15000 + 2000, 15000), far = put(w, 4, 15000 + 3500, 15000), out = put(w, 5, 15000 + 4500, 15000);
  const seen = (tick: number): number[] => w.seenBy(me, tick).map(e => e.id).sort((a, b) => a - b);
  void out;
  const rate = (id: number): number => { let n = 0; for (let t = 0; t < 10; t++) if (seen(t).includes(id)) n++; return n; };
  assert.equal(rate(near.id), 10, 'under 12 m: every tick (10 Hz)');
  assert.equal(rate(mid.id), 5, '12-25 m: every other tick (5 Hz)');
  assert.equal(rate(far.id), 2, '25-40 m: every fifth tick (2 Hz)');
  assert.equal(rate(5), 0, 'past 40 m: does not exist');
  assert.equal(rate(me.id), 0, 'never yourself');
});

test('interest: the 40 nearest are drawn and the rest are culled; a packet never exceeds the cap', () => {
  const w = new World(RULES, 1);
  const me = put(w, 1, 15000, 15000);
  for (let i = 2; i <= 79; i++) put(w, i, 15000 + (i % 10) * 100 + 1, 15000 + Math.floor(i / 10) * 100);   // all within 12 m, so every one is due every tick
  const seen = w.seenBy(me, 0);
  assert.equal(seen.length, RULES.nearCap);
  const dist = seen.map(e => Math.hypot(e.x - me.x, e.z - me.z));
  assert.deepEqual(dist, [...dist].sort((x, y) => x - y), 'nearest first');
  const all = [...me.layer.players.values()].filter(q => q !== me).map(q => Math.hypot(q.x - me.x, q.z - me.z)).sort((x, y) => x - y);
  assert.ok(Math.max(...dist) <= all[RULES.nearCap - 1] + 1e-9, 'and they are the 40 nearest of the 77');
});

test('movement clamp: inside the zone, no faster than sprint; a jump is snapped back and a run of them drops the player', () => {
  const w = new World();
  const p = w.join(acct(1), 0, undefined, { x: 15000, z: 15000 })!;
  const pose = (x: number, z: number) => ({ x, z, heading: 1, anim: 2, flags: 3 });
  p.movedAt = 0; p.x = p.z = 15000;
  assert.equal(w.move(p, pose(15000 + 100, 15000), 100), 'ok', '1 m in 100 ms is 10 m/s: inside the slack (7 m/s x 1.5)');
  assert.equal(p.x, 15100);
  assert.equal(w.move(p, pose(15100 + 5000, 15000), 200), 'snapped', 'a 50 m jump in 100 ms');
  assert.equal(p.x, 15100, 'and the old position stays');
  for (let i = 0; i < 4; i++) assert.equal(w.move(p, pose(20000, 15000), 300 + i * 100), 'snapped');
  assert.equal(w.move(p, pose(20000, 15000), 800), 'drop', 'the sixth strike inside the window');
  const q = w.join(acct(2), 0, undefined, { x: 100, z: 100 })!; q.movedAt = 0; q.x = q.z = 100;
  assert.equal(w.move(q, pose(-50, 99999), 1000), 'snapped', 'a pose far outside the zone is a jump too');
  const r = w.join(acct(3), 0, undefined, { x: 29900, z: 100 })!; r.movedAt = 0; r.x = 29900; r.z = 100;
  assert.equal(w.move(r, pose(30040, 100), 1000), 'ok');
  assert.equal(r.x, 30000, 'a small step past the edge is held at the edge');
});

test('a player with no known position starts at the spawn, and its first pose is clamped like every other (X2 stage 1: a first pose never places anyone)', () => {
  const w = new World();
  const p = w.join(acct(1), 0)!;
  assert.deepEqual([p.x, p.z], [15000, 15000], 'the Pit yard centre, chosen by the server');
  assert.equal(w.move(p, { x: 5000, z: 6000, heading: 0, anim: 0, flags: 0 }, 100), 'snapped', 'a first pose far from the spawn is a teleport, not a placement');
  assert.deepEqual([p.x, p.z], [15000, 15000], 'and the old position stays');
  assert.equal(w.move(p, { x: 15100, z: 15000, heading: 0, anim: 0, flags: 0 }, 200), 'ok', 'a first pose within the clamp is an ordinary move');
  assert.equal(p.layer.cells.get(Math.floor(15100 / 1600) * 4096 + Math.floor(15000 / 1600))!.has(p), true, 'and the grid holds it there');
});

// The real socket path: Node's built-in WebSocket client against the service on loopback.
const open = (port: number, token: string, extra = ''): Promise<{ ws: WebSocket; hello: { id: number; layer: number }; downs: ReturnType<typeof decodeDown>[] }> => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/origins/presence${extra ? `?${extra.replace(/^&/, '')}` : ''}`, ['frankendom.presence.v1', `token.${token}`]);
  ws.binaryType = 'arraybuffer';
  const downs: ReturnType<typeof decodeDown>[] = [];
  ws.onmessage = ev => {
    if (typeof ev.data === 'string') { const m = JSON.parse(ev.data); if (m.t === 'hello') resolve({ ws, hello: m, downs }); return; }
    downs.push(decodeDown(new Uint8Array(ev.data as ArrayBuffer)));
  };
  ws.onerror = () => reject(new Error('refused'));
});
const verify = async (t: string): Promise<string | null> => { const m = /^u(\d+)$/.exec(t); return m ? acct(Number(m[1])) : null; };

test('socket: two players in range see each other, a bad token is refused, a malformed frame closes, and leaving frees the slot', async () => {
  const p = createPresence({ verify, log: () => {} });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  const port = p.port();
  try {
    const a = await open(port, 'u1'), b = await open(port, 'u2');
    assert.equal(a.hello.layer, b.hello.layer);
    assert.notEqual(a.hello.id, b.hello.id);
    await assert.rejects(open(port, 'nobody'), /refused/);
    a.ws.send(encodeUp({ x: 15000, z: 15000, heading: 0, anim: 0, flags: 0 }));
    b.ws.send(encodeUp({ x: 15100, z: 15000, heading: 0, anim: 1, flags: 0 }));
    await new Promise(r => setTimeout(r, 400));
    const sawB = a.downs.flatMap(d => d?.entities ?? []).filter(e => e.id === b.hello.id).at(-1);
    assert.ok(sawB, 'a was told about b');
    assert.equal(sawB.x, 15100);
    assert.equal(sawB.anim, 1);
    assert.equal(a.downs.flatMap(d => d?.entities ?? []).some(e => e.id === a.hello.id), false, 'never about itself');
    assert.equal(p.world.stats().players, 2);
    a.ws.send(new Uint8Array(20));   // not a pose: the connection is closed
    await new Promise(r => a.ws.addEventListener('close', () => r(null)));
    b.ws.close();
    await new Promise(r => setTimeout(r, 100));
    assert.equal(p.world.stats().players, 0);
  } finally { await p.close(); }
});

test('socket: the world-full and already-in refusals', async () => {
  const p = createPresence({ verify, log: () => {}, rules: { ...RULES, softCap: 1, hardCap: 1 }, maxLayers: 1 });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await open(p.port(), 'u1');
    await assert.rejects(open(p.port(), 'u2'), /refused/, 'the only layer is full and no more may open');
    await assert.rejects(open(p.port(), 'u1'), /refused/, 'the same account is in once');
    a.ws.close();
  } finally { await p.close(); }
});

test('socket: the token rides the Sec-WebSocket-Protocol header, is never echoed, and a token in the URL is refused', async () => {
  const p = createPresence({ verify, log: () => {} });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  const port = p.port();
  try {
    const a = await open(port, 'u1');
    assert.equal(a.ws.protocol, 'frankendom.presence.v1', 'the server picks the plain protocol name, not the token entry');
    a.ws.close();
    const tryOpen = (url: string, protocols?: string[]) => new Promise<'open' | 'refused'>(resolve => {
      const ws = new WebSocket(url, protocols); ws.onopen = () => { ws.close(); resolve('open'); }; ws.onerror = () => resolve('refused');
    });
    assert.equal(await tryOpen(`ws://127.0.0.1:${port}/origins/presence?token=u2`, ['frankendom.presence.v1']), 'refused', 'a token in the URL is refused even when it is valid');
    assert.equal(await tryOpen(`ws://127.0.0.1:${port}/origins/presence?token=u2`, ['frankendom.presence.v1', 'token.u2']), 'refused', 'and so is a header token next to a URL token');
    assert.equal(await tryOpen(`ws://127.0.0.1:${port}/origins/presence`), 'refused', 'no subprotocol, no token');
    assert.equal(await tryOpen(`ws://127.0.0.1:${port}/origins/presence`, ['token.u2']), 'refused', 'a token without the protocol name');
    assert.equal(await tryOpen(`ws://127.0.0.1:${port}/origins/presence`, ['frankendom.presence.v1']), 'refused', 'the protocol name without a token');
    const refusedWhy = (p.stats() as { refused: Record<string, number> }).refused;
    assert.equal(refusedWhy['token-in-url'], 2);
  } finally { await p.close(); }
});

test('perIp is swept: an address with no socket and an expired join window is forgotten', async () => {
  let clock = 1_000_000;
  const p = createPresence({ verify, log: () => {}, now: () => clock, sweepEveryMs: 20 });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  const port = p.port();
  try {
    const a = await open(port, 'u1');
    assert.equal((p.stats() as { ips: number }).ips, 1, 'the address is tracked while it has a socket');
    clock += 120_000;
    await new Promise(r => setTimeout(r, 120));
    assert.equal((p.stats() as { ips: number }).ips, 1, 'a live socket keeps its entry past the window');
    a.ws.close();
    await new Promise(r => setTimeout(r, 200));
    assert.equal((p.stats() as { ips: number }).ips, 0, 'once it has left and the window has passed, the entry is gone');
  } finally { await p.close(); }
});

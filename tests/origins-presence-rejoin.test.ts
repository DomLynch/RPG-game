// X2 Stage 2, character switch: POST /internal/rejoin {account} drops the connected account's old presence and places it again where `locate` says (default placement if that
// fails), on the same socket with a fresh hello. Same key + loopback guard as /internal/where.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPresence } from '../origins/presence/server.ts';
import { presenceWhere } from '../origins/presence/where.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const KEY = 'test-internal-key-0123456789';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const post = (base: string, body: unknown, auth: string | null = `Bearer ${KEY}`) => fetch(`${base}/internal/rejoin`, { method: 'POST', headers: auth ? { authorization: auth } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) });
const start = async (locate?: (a: string) => Promise<{ x: number; z: number } | null>, internalKey: string | null = KEY) => {
  const p = createPresence({ verify: async t => (t === 'u1' ? acct(1) : null), log: () => {}, internalKey: internalKey ?? undefined, locate });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  return { p, base: `http://127.0.0.1:${p.port()}` };
};
const connect = (port: number) => new Promise<{ ws: WebSocket; hellos: { id: number; x: number; z: number }[] }>((res, rej) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/origins/presence`, ['frankendom.presence.v1', 'token.u1']), hellos: { id: number; x: number; z: number }[] = [];
  ws.onmessage = ev => { if (typeof ev.data === 'string') { const m = JSON.parse(ev.data); if (m.t === 'hello') { hellos.push(m); if (hellos.length === 1) res({ ws, hellos }); } } };
  ws.onerror = () => rej(new Error('refused'));
});

test('rejoin: guarded like /internal/where: no key configured is a 404, a wrong key or a bad body is refused, an account that is not connected is rejoined:false', async () => {
  const off = await start(undefined, null);
  try { assert.equal((await post(off.base, { account: acct(1) })).status, 404, 'no key: the route does not exist'); } finally { await off.p.close(); }
  const { p, base } = await start();
  try {
    assert.equal((await post(base, { account: acct(1) }, 'Bearer wrong')).status, 401);
    assert.equal((await post(base, { account: acct(1) }, null)).status, 401);
    assert.equal((await post(base, { account: 'nope' })).status, 400);
    assert.equal((await post(base, '{not json')).status, 400);
    assert.deepEqual(await (await post(base, { account: acct(1) })).json(), { rejoined: false }, 'nobody connected');
  } finally { await p.close(); }
});

test('rejoin: a connected account is dropped and placed again at the located spot, on the same socket with a fresh hello; one presence, not two', async () => {
  const { p, base } = await start(async a => (a === acct(1) ? { x: 5000, z: 6000 } : null));
  const where = presenceWhere(base, KEY), { ws, hellos } = await connect(p.port());
  try {
    const before = await where(acct(1));
    assert.ok(before.online && !(before.placed && before.x === 5000), 'it does not start at the saved spot');
    assert.deepEqual(await (await post(base, { account: acct(1) })).json(), { rejoined: true });
    await sleep(50);
    const after = await where(acct(1));
    assert.ok(after.online && after.placed && after.x === 5000 && after.z === 6000, 'the new character stands at its saved spot');
    assert.equal(hellos.length, 2, 'the client got a fresh hello');
    assert.deepEqual([hellos[0]!.x, hellos[0]!.z], [15000, 15000], 'the first hello says where it was placed (the spawn)');
    assert.deepEqual([hellos[1]!.x, hellos[1]!.z], [5000, 6000], 'the rejoin hello says where the new character stands, so the client adopts it before posing');
    assert.equal((p.stats() as { players: number }).players, 1, 'the old presence is gone: one player, not two');
    assert.equal(ws.readyState, WebSocket.OPEN, 'the socket stays open');
    ws.close(); await sleep(80);
    assert.deepEqual(await where(acct(1)), { online: false }, 'and leaving still removes the new presence');
  } finally { ws.close(); await p.close(); }
});

test('rejoin: a locate that fails or answers nothing places the account at the default spawn, never an invented position', async () => {
  for (const locate of [async () => { throw new Error('writer down'); }, async () => null]) {
    const { p, base } = await start(locate as never), where = presenceWhere(base, KEY), { ws } = await connect(p.port());
    try {
      assert.deepEqual(await (await post(base, { account: acct(1) })).json(), { rejoined: true });
      await sleep(50);
      const w = await where(acct(1));
      assert.ok(w.online && w.placed && w.x === 15000 && w.z === 15000, 'the default placement: the spawn, never an invented position');
    } finally { ws.close(); await p.close(); }
  }
});

test('rejoin: with no saved spot the new character starts at the spawn, not where the previous one left (the world\'s memory is dropped); the friend is passed through', async () => {
  let spot: { x: number; z: number } | null = { x: 5000, z: 6000 };
  const { p, base } = await start(async () => spot), where = presenceWhere(base, KEY), { ws } = await connect(p.port());
  try {
    assert.deepEqual(await (await post(base, { account: acct(1) })).json(), { rejoined: true });
    await sleep(50);
    const at = await where(acct(1));
    assert.ok(at.online && at.placed && at.x === 5000, 'placed at the first character\'s saved spot');
    spot = null;
    assert.deepEqual(await (await post(base, { account: acct(1) })).json(), { rejoined: true });
    await sleep(50);
    const w = await where(acct(1));
    assert.ok(w.online && w.placed && w.x === 15000 && w.z === 15000, 'the second character, nothing saved: the spawn, not (5000, 6000)');
    assert.equal(p.world.memory.has(acct(1)), false, 'and the previous character\'s remembered spot is gone');
  } finally { ws.close(); await p.close(); }
});

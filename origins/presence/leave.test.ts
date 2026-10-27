// A player who leaves (his socket closes) must vanish from every watcher at once: out of the world, out of every cell, no further entity for his id in any watcher's packets. HL (#2929, draw other
// players) saw "Bob left and is still drawn" 8 s after bob.close() on a tree with worn gear in the enter record; this pins the server half of that for every way a player can be standing when he goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { LIMITS, createPresence } from './server.ts';
import { joinBot, type Bot } from './test-client.ts';

const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };
const start = async (opts: Partial<Parameters<typeof createPresence>[0]> = {}) => {
  const p = createPresence({ verify: async (t) => (t === 'a' ? A : t === 'b' ? B : null), log: () => {}, ...opts });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  return p;
};
// After `bob` closes: the world forgets him, no cell holds him, and across the next half second NO packet to `alice` carries his id.
async function assertGone(p: Awaited<ReturnType<typeof start>>, alice: Bot, bobId: number, bobAccount: string, why: string): Promise<void> {
  await until(() => !p.world.byAccount.has(bobAccount), 3000);
  assert.equal(p.world.byAccount.has(bobAccount), false, `${why}: the world forgot him`);
  const layer = [...p.world.layers.values()][0]!;
  assert.equal(layer.players.has(bobId), false, `${why}: the layer forgot him`);
  assert.equal([...layer.cells.values()].some((c) => [...c].some((q) => q.id === bobId)), false, `${why}: no cell still holds him`);
  const leftAt = Date.now();
  for (let i = 0; i < 12; i++) { alice.pose(1 + (i % 2), 0); await wait(50); }
  const after = alice.packets().filter((q) => q.at > leftAt + 150);   // 150 ms: a packet already on the wire when the world forgot him may still land
  assert.equal(after.some((q) => q.ids.includes(bobId)), false, `${why}: a packet received after the world forgot him still carried his id (${after.length} packets since)`);
}

for (const how of ['standing still', 'after walking', 'after a warp', 'with a worn set and the refresh running', 'as a guest']) {
  test(`a player who closes his socket ${how} is gone from the world, the cells and every watcher's packets`, async () => {
    const worn: Record<string, string> = how.startsWith('with a worn') ? { head: 'veteran.Helmet' } : {};
    const p = await start({ wornOf: () => worn, readWorn: async () => worn, wornEveryMs: 60, nameOf: () => 'N' });
    try {
      const alice = await joinBot(p.port(), 'a'), bob = await joinBot(p.port(), how === 'as a guest' ? null : 'b');
      await until(() => alice.seen().length === 1 && bob.seen().length === 1);
      const bobAccount = [...p.world.byAccount.values()].find((q) => q.id !== alice.hello.id)!.account, bobId = bob.hello.id;
      if (how === 'after walking') { for (let i = 1; i <= 8; i++) { bob.pose(-72.64 + i * 3, 62.91); await wait(60); } }
      if (how === 'after a warp') { bob.warp('zone1-road-end'); await until(() => bob.hellos() === 2); bob.warp('town-respawn'); await until(() => bob.hellos() === 3); }
      if (how.startsWith('with a worn')) await wait(250);
      await until(() => alice.seen().some((e) => e.id === bobId), 2000);
      bob.close();
      await assertGone(p, alice, bobId, bobAccount, how);
      alice.close();
    } finally { await p.close(); }
  });
}

// The ghost: presence ran the leave only when the TCP socket reported 'close', which needs the PEER's FIN as well. A client that sends a close frame and then dawdles (a loaded runner, a browser
// that waits on the close handshake) kept its player in the world, and in every watcher's packets, until the FIN came. The leave must run when the close FRAME arrives, and the socket is
// destroyed after a grace if the peer never finishes (closeGraceMs, a row).
const CLOSE_FRAME = Buffer.from([0x88, 0x82, 0, 0, 0, 0, 0x03, 0xe8]);   // masked (zero key) close, code 1000
function rawJoin(port: number, token: string): Promise<{ socket: import('node:net').Socket; closed: () => boolean }> {
  return new Promise((resolve, reject) => {
    const s = connect({ port, host: '127.0.0.1', allowHalfOpen: true });   // never ends its own side unless told: the half-open peer
    let done = false, closed = false;
    s.once('error', reject); s.on('close', () => { closed = true; });
    s.write(`GET /origins/presence HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: frankendom.presence.v2, token.${token}\r\n\r\n`);
    s.on('data', (d) => { if (!done && /^HTTP\/1\.1 101/.test(d.toString('latin1'))) { done = true; resolve({ socket: s, closed: () => closed }); } });
  });
}
test('a close frame removes the player at once even when the peer never finishes the TCP close; the socket is destroyed after the grace', async () => {
  const p = await start();
  try {
    const alice = await joinBot(p.port(), 'a'), ghost = await rawJoin(p.port(), 'b');
    await until(() => p.world.byAccount.has(B) && alice.seen().length === 1, 3000);
    const bobId = p.world.byAccount.get(B)!.id;
    ghost.socket.write(CLOSE_FRAME);   // ...and nothing more: no FIN, no end()
    const t0 = Date.now();
    await until(() => !p.world.byAccount.has(B), 1500);
    assert.equal(p.world.byAccount.has(B), false, 'the world forgot him on the close frame, without waiting for the peer\'s FIN');
    assert.ok(Date.now() - t0 < 600, `and quickly (${Date.now() - t0} ms)`);
    const leftAt = Date.now(); for (let i = 0; i < 8; i++) { alice.pose(1 + (i % 2), 0); await wait(50); }
    assert.equal(alice.packets().some((q) => q.at > leftAt + 150 && q.ids.includes(bobId)), false, 'no packet after that carries his id');
    const open = (): Promise<number> => new Promise((r) => p.server.getConnections((_e, n) => r(n)));
    assert.equal(await open(), 2, 'the half-open socket is still held right after the close frame (alice + the ghost)');
    let n = 2; for (let i = 0; i < 60 && n > 1; i++) { await wait(50); n = await open(); }
    assert.equal(n, 1, 'the server destroyed the half-open socket after the grace, the peer\'s FIN or not (only alice is left)');
    ghost.socket.destroy();
    alice.close();
  } finally { await p.close(); }
});
test('the server\'s own close paths (idle timeout, a malformed frame) remove the player at once as well', async () => {
  const p = await start({ limits: { ...LIMITS, idleMs: 300 } });
  try {
    const idle = await rawJoin(p.port(), 'a');   // says nothing: the idle timer closes it, and the peer never answers
    await until(() => p.world.byAccount.has(A), 2000);
    await until(() => !p.world.byAccount.has(A), 1500);
    assert.equal(p.world.byAccount.has(A), false, 'idle: gone at the timeout, not at the peer\'s FIN');
    idle.socket.destroy();
    const bad = await rawJoin(p.port(), 'b');
    await until(() => p.world.byAccount.has(B), 2000);
    bad.socket.write(Buffer.from([0x82, 0x81, 0, 0, 0, 0, 0x01]));   // a binary frame that is not a pose
    await until(() => !p.world.byAccount.has(B), 1500);
    assert.equal(p.world.byAccount.has(B), false, 'malformed: gone at once');
    bad.socket.destroy();
  } finally { await p.close(); }
});

test('a player who closes while the writer refresh read is in flight is not brought back by it', async () => {
  let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
  const p = await start({ wornOf: () => ({}), readWorn: async (acct) => { if (acct === B) await gate; return { head: 'veteran.Helmet' }; }, wornEveryMs: 40 });
  try {
    const alice = await joinBot(p.port(), 'a'), bob = await joinBot(p.port(), 'b');
    await until(() => alice.seen().length === 1);
    const bobId = bob.hello.id;
    await wait(120);   // a refresh read for bob is now waiting on the gate
    bob.close();
    await until(() => !p.world.byAccount.has(B), 3000);
    release();
    await wait(200);
    assert.equal(p.world.byAccount.has(B), false, 'the late read did not re-add him');
    const leftAt = Date.now() - 200; await wait(300);
    assert.equal(alice.packets().some((q) => q.at > leftAt && q.ids.includes(bobId)), false, 'and no packet after he left carries his id');
    alice.close();
  } finally { release(); await p.close(); }
});

// A player who leaves (his socket closes) must vanish from every watcher at once: out of the world, out of every cell, no further entity for his id in any watcher's packets. HL (#2929, draw other
// players) saw "Bob left and is still drawn" 8 s after bob.close() on a tree with worn gear in the enter record; this pins the server half of that for every way a player can be standing when he goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresence } from './server.ts';
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
  for (let i = 0; i < 12; i++) { alice.pose(1 + (i % 2), 0); await wait(50); assert.equal(alice.seen().some((e) => e.id === bobId), false, `${why}: packet ${i} after he left still carried his id`); }
}

for (const how of ['standing still', 'after walking', 'after a warp', 'with a worn set and the refresh running', 'as a guest']) {
  test(`a player who closes his socket ${how} is gone from the world, the cells and every watcher's packets`, async () => {
    const worn = how.startsWith('with a worn') ? { head: 'veteran.Helmet' } : {};
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
    assert.equal(alice.seen().some((e) => e.id === bobId), false);
    alice.close();
  } finally { release(); await p.close(); }
});

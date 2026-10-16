// Name tags: presence tells a viewer who an id is ({id, name, guest}) ONCE when the id comes into range, before the first packet that carries it, and again after it left range and came back.
// An unnamed account arrives with name null; a v1 viewer is sent none. The names come from the writer's answer at join (main.ts) through `nameOf`; here that is a stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresence } from './server.ts';
import { CENTRE_CM, LEGACY_SHIFT_CM } from './zones.ts';
import { joinBot } from './test-client.ts';

const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2', C = '00000000-0000-4000-8000-0000000000c3';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 4000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };
const at = (x: number, z: number): { x: number; z: number } => ({ x: Math.round(CENTRE_CM + x * 100) - LEGACY_SHIFT_CM, z: Math.round(CENTRE_CM + z * 100) - LEGACY_SHIFT_CM });

test('an enter record: once per sighting, before the first packet, null name for an unnamed account, again after the id left range and came back', async () => {
  const who: Record<string, string> = { a: A, b: B, c: C }, names: Record<string, string | null> = { [A]: 'Alice', [B]: 'Bob', [C]: null };
  const spots: Record<string, { x: number; z: number }> = { [A]: at(-100, 40), [B]: at(-62, 40), [C]: at(-100, 45) };   // a Frontier field: B 38 m east of A (inside the 40 m range), C 5 m north of A
  const p = createPresence({ verify: async (t) => who[t] ?? null, log: () => {}, locate: async (acc) => spots[acc]!, nameOf: (acc) => names[acc] ?? null });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await joinBot(p.port(), 'a'), b = await joinBot(p.port(), 'b');
    await until(() => a.entered().length === 1 && b.entered().length === 1);
    assert.deepEqual(a.entered(), [{ id: p.world.byAccount.get(B)!.id, name: 'Bob', guest: false }]);
    assert.deepEqual(b.entered(), [{ id: p.world.byAccount.get(A)!.id, name: 'Alice', guest: false }]);
    await wait(600);
    assert.equal(a.entered().length, 1, 'many packets later, still one enter record');
    assert.equal(a.enteredLate(), false, 'the record came before the id\'s first packet');
    const c = await joinBot(p.port(), 'c');   // an account with no name known
    await until(() => a.entered().length === 2);
    assert.deepEqual(a.entered()[1], { id: p.world.byAccount.get(C)!.id, name: null, guest: false });
    // B walks east out of A's 40 m range (honest 1.5 m steps), then back: A is introduced to B a second time.
    const aP = p.world.byAccount.get(A)!, bId = p.world.byAccount.get(B)!.id;
    for (let i = 1; i <= 8; i++) { b.pose(-62 + i * 1.5, 40); await wait(150); }
    await until(() => !aP.sees.has(bId), 2500);
    assert.equal(aP.sees.has(bId), false, 'B is out of A\'s range');
    for (let i = 7; i >= 0; i--) { b.pose(-62 + i * 1.5, 40); await wait(150); }
    await until(() => a.entered().filter((e) => e.name === 'Bob').length === 2, 4000);
    assert.equal(a.entered().filter((e) => e.name === 'Bob').length, 2, 'introduced again when it re-entered range');
    a.close(); b.close(); c.close();
  } finally { await p.close(); }
});

test('a v1 viewer is sent no enter records', async () => {
  const p = createPresence({ verify: async (t) => ({ a: A, b: B } as Record<string, string>)[t] ?? null, log: () => {}, nameOf: (acc) => (acc === B ? 'Bob' : null) });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const old = await joinBot(p.port(), 'a', { v1: true }), fresh = await joinBot(p.port(), 'b');
    await until(() => old.seen().length === 1 && fresh.entered().length === 1);
    assert.equal(old.entered().length, 0); assert.equal(fresh.entered()[0]!.name, null, 'the v1 account has no name tag');
    old.close(); fresh.close();
  } finally { await p.close(); }
});

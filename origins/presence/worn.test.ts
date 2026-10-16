// What other players see a player wear (Web's dressing): the `enter` record carries {slot: lootId}, read by the writer from the ledger; a guest wears nothing; a changed set reaches the
// players who see it as a fresh `enter`; a failed refresh keeps the last set; nothing is sent per tick. The set is never read from a client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresence } from './server.ts';
import { sameWorn, wornQueue } from './worn.ts';
import { joinBot } from './test-client.ts';

const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };
const HELM = { head: 'veteran.Helmet' }, HELM_AND_BODY = { body: 'veteran.Body', head: 'veteran.Helmet' };

test('the enter record carries the worn set the writer read at the join; a guest and an empty ledger send {}; the set is never taken from the client', async () => {
  const table: Record<string, Record<string, string>> = { [A]: {}, [B]: HELM };
  const p = createPresence({ verify: async (t) => (t === 'a' ? A : t === 'b' ? B : null), log: () => {}, wornOf: (acct) => table[acct] ?? {}, nameOf: () => 'N' });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await joinBot(p.port(), 'a'), b = await joinBot(p.port(), 'b'), g = await joinBot(p.port(), null);
    await until(() => a.entered().length === 2 && b.entered().length === 2 && g.entered().length === 2);
    const byId = (bot: typeof a, acct: string) => bot.entered().find((e) => e.id === p.world.byAccount.get(acct)!.id)!;
    assert.deepEqual(byId(a, B).worn, HELM, 'A sees what B wears');
    assert.deepEqual(byId(b, A).worn, {}, 'B sees A bare');
    assert.deepEqual(byId(g, B).worn, HELM, 'a guest viewer is shown the worn gear too');
    const guest = [...p.world.byAccount.values()].find((x) => x.guest)!;
    assert.deepEqual(byId(a, guest.account).worn, {}, 'a guest wears nothing, whatever the page claims');
    a.close(); b.close(); g.close();
  } finally { await p.close(); }
});

test('a changed worn set is sent again as one enter to each viewer; an unchanged one is not; a failed refresh keeps the last set and sends nothing', async () => {
  const table: Record<string, Record<string, string>> = { [A]: {}, [B]: HELM };
  let fail = false;
  const p = createPresence({ verify: async (t) => (t === 'a' ? A : t === 'b' ? B : null), log: () => {}, wornOf: (acct) => table[acct] ?? {},
    readWorn: async (acct) => { if (fail) throw new Error('writer down'); return table[acct] ?? {}; }, wornEveryMs: 60 });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const a = await joinBot(p.port(), 'a'), b = await joinBot(p.port(), 'b');
    await until(() => a.entered().length === 1);
    await wait(400);   // several refresh rounds with nothing changed
    assert.equal(a.entered().length, 1, 'an unchanged set is not re-sent');
    table[B] = HELM_AND_BODY;
    await until(() => a.entered().length === 2);
    assert.deepEqual(a.entered()[1]!.worn, HELM_AND_BODY, 'the new set arrives as a fresh enter');
    assert.equal(a.entered()[1]!.id, a.entered()[0]!.id, 'for the same id');
    await wait(400);
    assert.equal(a.entered().length, 2, 'and only once');
    fail = true; table[B] = {};
    await wait(400);
    assert.equal(a.entered().length, 2, 'a failed refresh keeps the last set: nothing is sent');
    assert.deepEqual(p.world.byAccount.get(B)!.worn, HELM_AND_BODY);
    fail = false;
    await until(() => a.entered().length === 3);
    assert.deepEqual(a.entered()[2]!.worn, {}, 'the writer is back: the bare set arrives');
    assert.equal(a.enteredLate(), false, 'every enter still comes before the packet that carries its id');
    a.close(); b.close();
  } finally { await p.close(); }
});

test('the refresh queue: one read in flight, one entry per account, a failure is logged and the last set stands', async () => {
  const log: string[] = [], applied: string[] = [];
  let release!: () => void, inFlight = 0, maxInFlight = 0;
  const gate = new Promise<void>((r) => { release = r; });
  const q = wornQueue(async (acct) => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); await gate; inFlight--; if (acct === 'bad') throw new Error('nope'); return { head: acct }; }, (acct, w) => applied.push(`${acct}:${JSON.stringify(w)}`), (l) => log.push(l));
  q.push('x'); q.push('y'); q.push('y'); q.push('bad');   // x is read at once (in flight); y, y, bad queue behind it
  assert.equal(q.stats().queued, 2, 'the duplicate y collapsed: one queued entry per account');
  release(); await until(() => q.idle());
  assert.equal(maxInFlight, 1, 'never more than one read in flight');
  assert.deepEqual(applied, ['x:{"head":"x"}', 'y:{"head":"y"}'], 'each account once, in order; the failed read applied nothing');
  assert.equal(log.length, 1); assert.match(log[0]!, /worn read for bad failed/);
  assert.ok(sameWorn({ a: '1', b: '2' }, { a: '1', b: '2' }) && !sameWorn({ a: '1' }, {}), 'equal sets compare equal');
});

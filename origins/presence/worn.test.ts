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

// The writer's poke (POST /internal/worn): a gear op just succeeded, so presence reads that account's set now instead of at the next refresh.
test('a poke from the writer shows new gear to viewers within a tick, with no refresh timer; it needs the key; a guest and an unknown account are ignored; pokes inside the gap coalesce into one trailing read and the last change still shows', async () => {
  const table: Record<string, Record<string, string>> = { [A]: {}, [B]: {} }, reads: string[] = [];
  const p = createPresence({ verify: async (t) => (t === 'a' ? A : t === 'b' ? B : null), log: () => {}, internalKey: 'k', wornOf: (acct) => table[acct] ?? {},
    readWorn: async (acct) => { reads.push(acct); return table[acct] ?? {}; }, wornEveryMs: 3_600_000 });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  const poke = (account: string, key = 'k') => fetch(`http://127.0.0.1:${p.port()}/internal/worn`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: JSON.stringify({ account }) });
  try {
    const a = await joinBot(p.port(), 'a'), b = await joinBot(p.port(), 'b'), g = await joinBot(p.port(), null);
    await until(() => a.entered().length === 2);
    assert.equal((await poke(B, 'wrong')).status, 401, 'the key is required');
    assert.equal((await fetch(`http://127.0.0.1:${p.port()}/internal/worn`, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await poke('not-a-uuid')).status, 400);
    assert.deepEqual(await (await poke('00000000-0000-4000-8000-0000000000ff')).json(), { poke: 'ignored' }, 'an account that is not online');
    const guest = [...p.world.byAccount.values()].find((x) => x.guest)!;
    assert.equal(reads.length, 0, 'nothing read yet: the refresh timer is an hour away');
    table[B] = HELM;
    assert.deepEqual(await (await poke(B)).json(), { poke: 'queued' });
    await until(() => a.entered().filter((e) => e.worn.head).length === 1);
    assert.deepEqual(a.entered().find((e) => e.worn.head)!.worn, HELM, 'A sees B\'s helmet after one poke, no timer involved');
    assert.deepEqual(reads, [B]);
    table[B] = HELM_AND_BODY;
    const second = await (await poke(B)).json() as { poke: string }; table[B] = { ...HELM_AND_BODY, feet: 'veteran.Boots' };
    const third = await (await poke(B)).json() as { poke: string };
    assert.deepEqual([second.poke, third.poke], ['scheduled', 'scheduled'], 'pokes inside the gap wait for one trailing read');
    await until(() => a.entered().some((e) => e.worn.feet), 3000);
    assert.deepEqual(a.entered().at(-1)!.worn, { ...HELM_AND_BODY, feet: 'veteran.Boots' }, 'the LAST change is what shows');
    assert.equal(reads.length, 2, 'the two pokes inside the gap cost ONE read');
    assert.equal((await poke(guest.account)).status, 400, 'a guest id is not an account: the route refuses it, so a guest can never be refreshed');
    a.close(); b.close(); g.close();
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

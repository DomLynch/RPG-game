import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Intent } from '../src/duel.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { addClaim, CLAIM_WAIT_MS, CLAIMS_CAP, CLAIMS_KEY, finalClaim, flushClaims, flushThenStanding, loadClaims, pendingClaims, postClaim, saveClaims, settleClaims, type Claim } from '../src/loot-claims.ts';

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map }; };
const claim = (over: Partial<Claim> = {}): Claim => ({ userId: 'u1', opponent: 'goblin', record: 'R1', piece: null, final: false, ...over });
// A db whose loot_claims insert answers from `reply`, recording what was sent.
const db = (reply: (row: Record<string, unknown>) => Promise<{ error: unknown }>, sent: Record<string, unknown>[] = []) =>
  ({ from: (table: string) => ({ insert: (row: Record<string, unknown>) => { assert.equal(table, 'loot_claims'); sent.push(row); return reply(row); } }) }) as unknown as SupabaseClient;

test('the outbox survives a reload, and a malformed or foreign-shaped entry is left out rather than posted', () => {
  const storage = memory();
  saveClaims(storage, [claim(), claim({ record: 'R2', piece: 'goblin.Helmet', final: true })]);
  assert.deepEqual(loadClaims(storage), [claim(), claim({ record: 'R2', piece: 'goblin.Helmet', final: true })]);
  storage.setItem(CLAIMS_KEY, JSON.stringify([claim(), claim({ opponent: 'Goblin' }), claim({ record: 'a=b' }), claim({ piece: 'helmet' }), claim({ userId: '' }), null, 7]));
  assert.deepEqual(loadClaims(storage), [claim()]);
  storage.setItem(CLAIMS_KEY, '{not json'); assert.deepEqual(loadClaims(storage), []);
});

test('an entry left unfinished (the tab closed on the kill screen) becomes final with no piece; a final one keeps its piece', () => {
  const settled = settleClaims([claim({ piece: 'goblin.Helmet' }), claim({ record: 'R2', piece: 'goblin.Boots', final: true })]);
  assert.deepEqual(settled, [claim({ piece: null, final: true }), claim({ record: 'R2', piece: 'goblin.Boots', final: true })]);
  assert.deepEqual(finalClaim([claim()], 'R1', 'goblin.Arms'), [claim({ piece: 'goblin.Arms', final: true })]);
  assert.deepEqual(finalClaim([claim({ final: true })], 'R1', 'goblin.Arms'), [claim({ final: true })], 'a final entry is never rewritten');
});

test(`the outbox holds ${CLAIMS_CAP}: past it the oldest unfinished entry goes first, else the oldest; one entry per record`, () => {
  let claims: Claim[] = [];
  for (let i = 0; i < CLAIMS_CAP; i++) claims = addClaim(claims, claim({ record: `R${i}`, final: i !== 3 }));
  claims = addClaim(claims, claim({ record: 'new', final: true }));
  assert.equal(claims.length, CLAIMS_CAP); assert.ok(!claims.some((c) => c.record === 'R3')); assert.ok(claims.some((c) => c.record === 'R0'));
  claims = addClaim(claims, claim({ record: 'newer', final: true }));
  assert.equal(claims.length, CLAIMS_CAP); assert.ok(!claims.some((c) => c.record === 'R0'), 'all final: the oldest goes');
  assert.equal(addClaim([claim()], claim({ piece: 'goblin.Boots' })).length, 1);
});

test('a post drops only 23505 (already claimed) and 23514 (reported); 42501, PGRST205, 404 and the network keep it; user_id is never sent', async () => {
  const reports: unknown[] = [], sent: Record<string, unknown>[] = [];
  const answer = async (error: unknown) => postClaim(db(async () => ({ error }), sent), claim({ piece: 'goblin.Helmet' }), (e) => reports.push(e));
  assert.equal(await answer(null), 'drop');
  assert.deepEqual(sent[0], { opponent: 'goblin', piece: 'goblin.Helmet', record: 'R1' });
  assert.equal(await answer({ code: '23505' }), 'drop'); assert.equal(reports.length, 0);
  assert.equal(await answer({ code: '23514' }), 'drop'); assert.equal(reports.length, 1);
  for (const code of ['42501', 'PGRST205', '404', '']) assert.equal(await answer({ code }), 'keep', code);
  assert.equal(await postClaim(db(async () => { throw Error('offline'); }), claim(), () => {}), 'keep');
});

test('a flush posts only this account\'s final entries, drops what was answered, and stops at the first kept one', async () => {
  const storage = memory(), sent: Record<string, unknown>[] = [];
  saveClaims(storage, [claim({ record: 'A', final: true }), claim({ record: 'B' }), claim({ userId: 'u2', record: 'C', final: true }), claim({ record: 'D', final: true }), claim({ record: 'E', final: true })]);
  const replies: Record<string, unknown> = { A: null, D: { code: '42501' } };
  assert.equal(await flushClaims(db(async (row) => ({ error: replies[row.record as string] ?? null }), sent), 'u1', storage, () => {}), 1, 'A left; D was kept');
  assert.deepEqual(sent.map((row) => row.record), ['A', 'D'], 'B is not final, C is another account\'s, E waits behind the kept D');
  assert.deepEqual(loadClaims(storage).map((c) => c.record), ['B', 'C', 'D', 'E']);
  await flushClaims(db(async () => ({ error: null }), sent), 'u2', storage, () => {});
  assert.deepEqual(loadClaims(storage).map((c) => c.record), ['B', 'D', 'E'], 'u2 signs in on this device: its own entry goes, nobody else\'s');
  assert.deepEqual(pendingClaims(loadClaims(storage), 'u1').length, 3); assert.deepEqual(pendingClaims(loadClaims(storage), null), []);
});

test('after a flush that posted anything the standing is read again, after the post; a flush that posted nothing keeps the standing it had', async () => {
  const storage = memory(), calls: string[] = [];
  const server = (pending: () => number) => ({
    from: () => ({ insert: async () => { calls.push('insert'); return { error: null }; } }),
    rpc: async (fn: string) => { calls.push(fn); return { data: [{ marks: 4, owned: [], pending: pending(), pending_owned: ['goblin.Boots'] }], error: null }; },
  }) as unknown as SupabaseClient;
  const stale = { marks: 4, owned: [], pending: 0, pendingOwned: [] };
  saveClaims(storage, [claim({ final: true, piece: 'goblin.Boots' })]);
  assert.deepEqual(await flushThenStanding(server(() => calls.filter((c) => c === 'insert').length), 'u1', storage, () => {}, stale),
    { marks: 4, owned: [], pending: 1, pendingOwned: ['goblin.Boots'] }, 'the posted win is in pending, not lost from the rank');
  assert.deepEqual(calls, ['insert', 'my_standing'], 'the standing is read after the post, never before');
  assert.equal(await flushThenStanding(server(() => 9), 'u1', storage, () => {}, stale), stale, 'nothing to post: no read, the standing it had');
  assert.deepEqual(calls, ['insert', 'my_standing']);
});
test('a real encoded record meets the three loot_claims checks, and Share waits about three seconds at most', async () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', profile: 'hard', seed: 190926 });
  const still: Intent = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true };
  for (let i = 0; i < 1500; i++) rec.push(i % 7 ? still : { ...still, action: 'thrust' });
  const record = await encodeRecord(rec.finish('killed'));
  assert.match(record, /^[A-Za-z0-9_-]+$/); assert.ok(new TextEncoder().encode(record).length <= 16384);
  const storage = memory();
  saveClaims(storage, [claim({ record, piece: 'goblin.Helmet' })]);
  assert.equal(loadClaims(storage).length, 1, 'the entry the client stores is one the DB accepts: opponent, piece and record all pass');
  assert.ok(CLAIM_WAIT_MS >= 2000 && CLAIM_WAIT_MS <= 5000);
});

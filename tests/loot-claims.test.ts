import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Intent } from '../src/duel.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { addClaim, AUTH_KEY, bankClaim, CLAIM_REFUSED, CLAIM_UNSAVED, CLAIM_WAIT_MS, CLAIMS_CAP, CLAIMS_KEY, claimOnHide, finalClaim, KEEPALIVE_BYTES, flushClaims, flushThenStanding, loadClaims, pendingClaims, postClaim, saveClaims, settleClaims, finaliseClaim, held, outbox, settleOutbox, loadStanding, saveStanding, STANDING_KEY, type Claim , reloadAfter } from '../src/loot-claims.ts';

const memory = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map }; };
const claim = (over: Partial<Claim> = {}): Claim => ({ userId: 'u1', opponent: 'goblin', record: 'R1', piece: null, final: false, ...over });
// A db whose loot_claims insert answers from `reply`, recording what was sent, signed in as `who()` (the account auth.uid() would be).
const session = (who: () => string | null) => ({ getSession: async () => ({ data: { session: who() ? { user: { id: who() } } : null }, error: null }) });
const db = (reply: (row: Record<string, unknown>) => Promise<{ error: unknown }>, sent: Record<string, unknown>[] = [], who: () => string | null = () => 'u1') =>
  ({ auth: session(who), from: (table: string) => ({ insert: (row: Record<string, unknown>) => { assert.equal(table, 'loot_claims'); sent.push(row); return reply(row); } }) }) as unknown as SupabaseClient;

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

test(`the outbox holds ${CLAIMS_CAP}: past it an older unfinished entry goes first; a final one is never dropped; one entry per record`, () => {
  let claims: Claim[] = [];
  for (let i = 0; i < CLAIMS_CAP; i++) claims = addClaim(claims, claim({ record: `R${i}`, final: i !== 3 }));
  claims = addClaim(claims, claim({ record: 'new', final: true }));
  assert.equal(claims.length, CLAIMS_CAP); assert.ok(!claims.some((c) => c.record === 'R3')); assert.ok(claims.some((c) => c.record === 'R0'));
  const full = claims;
  assert.deepEqual(addClaim(full, claim({ record: 'newer', final: true })), full, 'all final: every unanswered win stays, the new one is refused');
  assert.deepEqual(addClaim(full, claim({ record: 'newest' })), full, 'the kill\'s own unfinished entry is refused too, never an older final one');
  assert.equal(addClaim([claim()], claim({ piece: 'goblin.Boots' })).length, 1);
  assert.equal(addClaim(full, claim({ record: 'R5', final: true, piece: 'goblin.Boots' })).length, CLAIMS_CAP, 'a record already held is replaced, not refused');
});

// GPT recheck 2026-09-29 (B), Strategy's ruling: the outbox holds 50; a won final claim is never evicted; past 50 the new win is refused
// with a visible line, never silently (the old rule dropped a win without a word).
test(`bankClaim: the ${CLAIMS_CAP}th win is kept; the next is refused with the line, and every unanswered win (the oldest first) is untouched`, () => {
  assert.equal(CLAIMS_CAP, 50);
  const storage = memory(), told: string[] = [], tell = (line: string) => { told.push(line); };
  for (let i = 1; i < CLAIMS_CAP; i++) assert.equal(bankClaim(storage, claim({ record: `W${i}` }), tell), true);
  saveClaims(storage, settleClaims(loadClaims(storage)));   // 49 final and unposted
  assert.equal(bankClaim(storage, claim({ record: `W${CLAIMS_CAP}` }), tell), true, 'the 50th is kept');
  assert.equal(loadClaims(storage).length, CLAIMS_CAP); assert.deepEqual(told, []);
  saveClaims(storage, settleClaims(loadClaims(storage)));   // all 50 final and unposted
  const before = loadClaims(storage);
  assert.equal(bankClaim(storage, claim({ record: `W${CLAIMS_CAP + 1}` }), tell), false, 'the 51st is refused');
  assert.deepEqual(told, [CLAIM_REFUSED], 'the player is told, once');
  assert.match(CLAIM_REFUSED, /50 wins are already waiting/); assert.doesNotMatch(CLAIM_REFUSED, /bank this win/, 'the refused win is held nowhere: no promise it banks later');
  assert.deepEqual(loadClaims(storage), before, 'no unanswered win was dropped');
  assert.equal(loadClaims(storage)[0].record, 'W1', 'the oldest is untouched');
});
// GPT recheck 2026-09-29 at 303af39 (E): a write that throws (storage full or blocked) left bankClaim returning true with nothing stored
// and no line. It returns false and tells the player the win is not held.
test('bankClaim: a failed write is told and returns false, never a silent true', () => {
  const told: string[] = [], throwing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.equal(saveClaims(throwing, [claim()]), false, 'saveClaims reports the failed write');
  assert.equal(bankClaim(throwing, claim(), (line) => { told.push(line); }), false);
  assert.deepEqual(told, [CLAIM_UNSAVED]);
  const storage = memory();
  assert.equal(saveClaims(storage, [claim()]), true, 'a written outbox reports true');
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
  await flushClaims(db(async () => ({ error: null }), sent, () => 'u2'), 'u2', storage, () => {});
  assert.deepEqual(loadClaims(storage).map((c) => c.record), ['B', 'D', 'E'], 'u2 signs in on this device: its own entry goes, nobody else\'s');
  assert.deepEqual(pendingClaims(loadClaims(storage), 'u1').length, 3); assert.deepEqual(pendingClaims(loadClaims(storage), null), []);
});

// GPT recheck 2026-09-29 (A): the client is shared, and the server keys a claim on auth.uid(), so a flush that outlives its account's
// session must stop before the next post; the entries it did not send stay in the outbox for that account's next sign-in.
test('a flush stops at the first post after the client changed account (or signed out); the unsent entries stay for their owner', async () => {
  const storage = memory(), sent: Record<string, unknown>[] = [];
  saveClaims(storage, [claim({ record: 'A', final: true }), claim({ record: 'B', final: true }), claim({ record: 'C', final: true })]);
  let who: string | null = 'u1';
  const switching = db(async (row) => { if (row.record === 'A') who = 'u2'; return { error: null }; }, sent, () => who);   // B signs in while A's post is in flight
  assert.equal(await flushClaims(switching, 'u1', storage, () => {}), 1);
  assert.deepEqual(sent.map((row) => row.record), ['A'], 'nothing of u1\'s is posted under u2');
  assert.deepEqual(loadClaims(storage).map((c) => c.record), ['B', 'C']);
  who = null;
  assert.equal(await flushClaims(db(async () => ({ error: null }), sent, () => who), 'u1', storage, () => {}), 0, 'signed out: nothing posted');
  assert.deepEqual(sent.map((row) => row.record), ['A']);
  await flushClaims(db(async () => ({ error: null }), sent, () => 'u1'), 'u1', storage, () => {});
  assert.deepEqual(sent.map((row) => row.record), ['A', 'B', 'C'], 'u1 back: its entries go');
  assert.deepEqual(loadClaims(storage), []);
});

test('after a flush that posted anything the standing is read again, after the post; a flush that posted nothing keeps the standing it had', async () => {
  const storage = memory(), calls: string[] = [];
  const server = (pending: () => number) => ({
    auth: session(() => 'u1'),
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
  const rec = createRecorder({ weapon: 'longsword', build: 'abc1234', opponent: 'goblin', level: 46, seed: 190926 });
  const still: Intent = { move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true };
  for (let i = 0; i < 1500; i++) rec.push(i % 7 ? still : { ...still, action: 'thrust' });
  const record = await encodeRecord(rec.finish('killed'));
  assert.match(record, /^[A-Za-z0-9_-]+$/); assert.ok(new TextEncoder().encode(record).length <= 16384);
  const storage = memory();
  saveClaims(storage, [claim({ record, piece: 'goblin.Helmet' })]);
  assert.equal(loadClaims(storage).length, 1, 'the entry the client stores is one the DB accepts: opponent, piece and record all pass');
  assert.ok(CLAIM_WAIT_MS >= 2000 && CLAIM_WAIT_MS <= 5000);
});

test('standing cache: replaced on an answer, kept for its own account when there is none, dropped on sign-out or another account, and a malformed cache is no cache', () => {
  const storage = memory(), a = { marks: 10, owned: ['veteran.Helmet', 'not-a-piece'], pending: 2, pendingOwned: [] } as never, b = { marks: 3, owned: [], pending: 0, pendingOwned: [] };
  assert.equal(loadStanding(storage), null, 'nothing cached');
  saveStanding(storage, 'user-a', a);
  assert.deepEqual(loadStanding(storage), { userId: 'user-a', standing: { marks: 10, owned: ['veteran.Helmet'], pending: 2, pendingOwned: [] } }, 'an unknown piece is left out, never a failed cache');
  saveStanding(storage, 'user-a', null);
  assert.equal(loadStanding(storage)?.standing.marks, 10, 'no answer this time: the account keeps its last figure');
  saveStanding(storage, 'user-b', null);
  assert.equal(loadStanding(storage), null, 'another account with no answer: never A\'s figure');
  saveStanding(storage, 'user-a', a); saveStanding(storage, 'user-b', b);
  assert.deepEqual(loadStanding(storage), { userId: 'user-b', standing: b }, 'another account\'s answer replaces it');
  saveStanding(storage, null, null);
  assert.equal(loadStanding(storage), null, 'signed out: dropped');
  for (const bad of ['{', '"x"', JSON.stringify({ userId: '', standing: b }), JSON.stringify({ userId: 'u', standing: { ...b, marks: -1 } }), JSON.stringify({ userId: 'u', standing: { ...b, marks: 1.5 } }), JSON.stringify({ userId: 'u', standing: { marks: 1, pending: 0 } })]) {
    storage.setItem(STANDING_KEY, bad); assert.equal(loadStanding(storage), null, bad);
  }
});

// The server's one rule that makes a double post harmless: loot_claims.record_hash is unique globally, so a second insert is 23505.
const server = () => {
  const rows = new Map<string, Record<string, unknown>>();
  const insert = (row: Record<string, unknown>) => { if (rows.has(row.record as string)) return { error: { code: '23505' } }; rows.set(row.record as string, row); return { error: null }; };
  const send = ((url: string, init: RequestInit) => {
    assert.equal(url, 'https://qa.supabase.co/rest/v1/loot_claims'); assert.equal(init.method, 'POST'); assert.equal(init.keepalive, true);
    const headers = init.headers as Record<string, string>; assert.equal(headers.apikey, 'pk'); assert.equal(headers.Authorization, 'Bearer tok');
    insert(JSON.parse(init.body as string)); return Promise.resolve(new Response(null, { status: 201 }));
  }) as unknown as typeof fetch;
  return { rows, send, db: db(async (row) => insert(row)) };
};
const API = { url: 'https://qa.supabase.co', key: 'pk' }, NOW = 1_800_000_000_000;
const signedIn = (storage: ReturnType<typeof memory>, expiresAt = NOW / 1000 + 3600) => storage.setItem(AUTH_KEY, JSON.stringify({ access_token: 'tok', expires_at: expiresAt }));

test('a win, then the page closes: the open entry is final with the take in its Undo line and sent once with keepalive', () => {
  const storage = memory(), s = server(); signedIn(storage);
  saveClaims(storage, addClaim([], claim()));
  assert.equal(claimOnHide(storage, 'u1', 'goblin.Helmet', API, s.send, NOW), 1);
  assert.deepEqual([...s.rows.values()], [{ opponent: 'goblin', piece: 'goblin.Helmet', record: 'R1' }]);
  assert.deepEqual(loadClaims(storage), [claim({ piece: 'goblin.Helmet', final: true })], 'kept: the next load posts it again and 23505 drops it');
});

test('a win, then the page closes, then the next load posts: still exactly one claim, and the outbox empties', async () => {
  const storage = memory(), s = server(); signedIn(storage);
  saveClaims(storage, addClaim([], claim()));
  claimOnHide(storage, 'u1', null, API, s.send, NOW);
  saveClaims(storage, settleClaims(loadClaims(storage)));   // the next load (main.ts)
  await flushClaims(s.db, 'u1', storage, () => assert.fail('23505 is not reported'));
  assert.equal(s.rows.size, 1); assert.deepEqual(loadClaims(storage), []);
  claimOnHide(storage, 'u1', null, API, s.send, NOW); assert.equal(s.rows.size, 1, 'nothing left to send');
});

test('a page closing sends nothing without a live session, never another account\'s entries, and at most what keepalive carries', () => {
  const storage = memory(), s = server();
  saveClaims(storage, [claim({ userId: 'u2', final: true }), claim({ record: 'R2' })]);
  assert.equal(claimOnHide(storage, 'u1', null, API, s.send, NOW), 0, 'no stored session');
  assert.deepEqual(loadClaims(storage)[1], claim({ record: 'R2', final: true }), 'the entry is still made final, so the next load posts it');
  signedIn(storage, NOW / 1000 - 1); assert.equal(claimOnHide(storage, 'u1', null, API, s.send, NOW), 0, 'an expired token');
  signedIn(storage); assert.equal(claimOnHide(storage, 'u1', null, null, s.send, NOW), 0, 'a build with no account API');
  assert.equal(claimOnHide(storage, 'u1', null, API, s.send, NOW), 1); assert.deepEqual([...s.rows.keys()], ['R2'], 'u2\'s entry is never sent');
  const big = 'A'.repeat(16000), many = Array.from({ length: 5 }, (_, i) => claim({ record: `${big}${i}`, final: true }));
  saveClaims(storage, many);
  assert.equal(claimOnHide(storage, 'u1', null, API, server().send, NOW), Math.floor(KEEPALIVE_BYTES / 16050));
});

// GPT audit of e65a6d8 (2026-09-30, F3): four callers dropped saveClaims()'s boolean, so a failed write at the final word lost the piece
// (the reload finalised the entry with none), a page closing sent nothing for an entry it could not finalise, and a posted entry whose
// removal failed was counted and posted again. A write the device refuses is now held in memory for the page's life (held).
const breakable = () => { const s = memory(); let broken = false; return { ...s, setItem: (k: string, v: string) => { if (broken) throw new Error('QuotaExceededError'); s.setItem(k, v); }, brk: () => { broken = true; }, fix: () => { broken = false; } }; };
test.beforeEach(() => { held.unsaved.length = 0; held.acked.clear(); });
test('a failed final-word write is persisted when storage recovers while the network stays offline, and survives reload', async () => {
  const storage = breakable(), sent: Record<string, unknown>[] = [];
  assert.equal(bankClaim(storage, claim(), () => assert.fail('bank write should succeed')), true);
  storage.brk();
  assert.equal(finaliseClaim(storage, 'R1', 'goblin.Helmet'), false);
  const final = claim({ piece: 'goblin.Helmet', final: true });
  assert.deepEqual(loadClaims(storage), [claim()], 'the failed write leaves an unfinished stored claim');
  assert.deepEqual(outbox(storage), [final], 'the selection is held in memory');
  storage.fix();
  assert.equal(await flushClaims(db(async () => { throw Error('offline'); }, sent), 'u1', storage, () => {}), 0);
  assert.deepEqual(sent, [{ opponent: 'goblin', record: 'R1', piece: 'goblin.Helmet' }]);
  held.unsaved.length = 0; held.acked.clear();   // reload loses all page memory, retaining only device storage
  assert.equal(settleOutbox(storage), true);
  assert.deepEqual(loadClaims(storage), [final], 'the reload retains the final selection instead of claiming no piece');
});
test('storage retry keeps holds on failure, then persists both accounts without resurrecting an acknowledged claim', async () => {
  const storage = breakable(), sent: Record<string, unknown>[] = [];
  saveClaims(storage, [claim({ record: 'answered', final: true }), claim(), claim({ userId: 'u2', record: 'R2' })]);
  storage.brk();
  assert.equal(await flushClaims(db(async () => ({ error: null })), 'u1', storage, () => {}), 1);
  assert.equal(finaliseClaim(storage, 'R1', 'goblin.Helmet'), false);
  assert.equal(finaliseClaim(storage, 'R2', 'goblin.Boots'), false);
  const pending = [claim({ piece: 'goblin.Helmet', final: true }), claim({ userId: 'u2', record: 'R2', piece: 'goblin.Boots', final: true })];
  const offline = db(async () => ({ error: { code: 'offline' } }), sent);
  assert.equal(await flushClaims(offline, 'u1', storage, () => {}), 0);
  assert.deepEqual(held.unsaved, pending, 'a failed retry keeps both final words in memory');
  assert.deepEqual([...held.acked], ['answered'], 'a failed retry keeps the removal hold');
  storage.fix();
  assert.equal(await flushClaims(offline, 'u1', storage, () => {}), 0);
  assert.deepEqual(loadClaims(storage), pending, 'both accounts are durable, the acknowledged claim is removed');
  assert.deepEqual(held.unsaved, []); assert.equal(held.acked.size, 0);
  assert.deepEqual(sent.map((row) => row.record), ['R1', 'R1'], 'neither the other account nor the acknowledged claim is posted');
});
test('F3: the final word on the loot whose write fails is held: the piece is posted, not lost, and the entry leaves memory once answered', async () => {
  const storage = breakable(), sent: Record<string, unknown>[] = [];
  saveClaims(storage, addClaim([], claim()));
  storage.brk();
  assert.equal(finaliseClaim(storage, 'R1', 'goblin.Helmet'), false, 'the write failed');
  assert.equal(loadClaims(storage)[0].final, false, 'storage still has the open entry');
  assert.deepEqual(outbox(storage), [claim({ piece: 'goblin.Helmet', final: true })], 'the outbox view is final with the piece');
  assert.equal(pendingClaims(outbox(storage), 'u1').length, 1);
  assert.equal(await flushClaims(db(async () => ({ error: null }), sent), 'u1', storage, () => {}), 1);
  assert.deepEqual(sent.map((row) => row.piece), ['goblin.Helmet'], 'the piece reached the server');
  assert.deepEqual(held.unsaved, [], 'answered: out of memory');
  assert.deepEqual(outbox(storage), [], 'its removal failed too: the stale storage copy is acked, not pending');
  storage.fix();
  await flushClaims(db(async () => ({ error: null }), sent), 'u1', storage, () => {});
  assert.deepEqual(loadClaims(storage), [], 'removed once the device writes'); assert.equal(sent.length, 1, 'never posted twice');
});
test('F3: the page closing with an entry it cannot finalise still sends it, with the take, once', () => {
  const storage = breakable(), s = server();
  saveClaims(storage, addClaim([], claim())); signedIn(storage); storage.brk();
  assert.equal(claimOnHide(storage, 'u1', 'goblin.Boots', API, s.send, NOW), 1);
  assert.equal(s.rows.size, 1); assert.equal([...s.rows.values()][0].piece, 'goblin.Boots');
});
test('F3: a posted entry whose removal write fails is not posted or counted again, and is removed once the device writes', async () => {
  const storage = breakable(), sent: Record<string, unknown>[] = [];
  saveClaims(storage, [claim({ record: 'A', final: true }), claim({ record: 'B', final: true })]);
  let posts = 0; const accepting = db(async () => { if (++posts === 2) storage.brk(); return { error: null }; }, sent);   // A is removed; B's removal finds the device full
  assert.equal(await flushClaims(accepting, 'u1', storage, () => {}), 2, 'both posted');
  assert.deepEqual(loadClaims(storage).map((c) => c.record), ['B'], 'A left storage; B\'s removal failed');
  assert.deepEqual(outbox(storage), [], 'B is not pending any more'); assert.deepEqual(pendingClaims(outbox(storage), 'u1'), []);
  assert.equal(await flushClaims(accepting, 'u1', storage, () => {}), 0, 'B is not posted again'); assert.equal(sent.length, 2);
  storage.fix();
  await flushClaims(accepting, 'u1', storage, () => {});
  assert.deepEqual(loadClaims(storage), [], 'the retried removal held'); assert.equal(held.acked.size, 0);
});
test('F3: a load that cannot write the settled outbox still posts the entries a closed tab left open, with no piece', async () => {
  const storage = breakable(), sent: Record<string, unknown>[] = [];
  saveClaims(storage, [claim({ record: 'A' }), claim({ record: 'B', final: true, piece: 'goblin.Helmet' })]);
  storage.brk();
  assert.equal(settleOutbox(storage), false);
  assert.deepEqual(outbox(storage).map((c) => [c.record, c.final, c.piece]), [['A', true, null], ['B', true, 'goblin.Helmet']]);
  assert.equal(await flushClaims(db(async () => ({ error: null }), sent), 'u1', storage, () => {}), 2);
  assert.deepEqual(sent.map((row) => row.record), ['A', 'B']);
});

test('reloadAfter: the next rung reloads the page whether the settle resolved or threw, and a throw is logged, not swallowed', async () => {
  const calls: string[] = [];
  await reloadAfter(Promise.resolve(), () => calls.push('reload'), () => calls.push('warn'));
  assert.deepEqual(calls, ['reload'], 'a clean settle reloads once and warns nothing');
  calls.length = 0;
  await reloadAfter(Promise.reject(new Error('quota')), () => calls.push('reload'), (error) => calls.push(`warn:${(error as Error).message}`));
  assert.deepEqual(calls, ['warn:quota', 'reload'], 'a throwing settle is logged and the page still reloads (the kill screen never sticks)');
});

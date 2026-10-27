import assert from 'node:assert/strict';
import test from 'node:test';
import { PC, paperdollOf, slotOf } from '../../src/core/server.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { WEAR_HIT_TYPES, WEAR_SLOTS, hitsTaken, wearKindOf, wornSlot, type Piece } from '../gear/wear-repair.ts';
import { DbError, type Db } from './db.ts';
import { openHoldingsWith } from './holdings.ts';
import { killWearLines, rollsOf, settleWithWear, wearMaxOf } from './wear-settle.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const lookup = lookupOf(loaded.value), UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
const career = { seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
const SLOTS = ['Helmet', 'Body', 'Arms', 'Greaves', 'Boots', 'Gloves'];
const prov = (n: number, lootId: string) => ({ kind: 'arena-award', at: '2026-10-06T12:00:00Z', claimId: n, lootId, wonBy: PC, fromLegend: 'goblin-1', atRank: 'Recruit' });
const row = (n: number, slot: string) => ({
  id: `inst:w-${n}`, item: `item:loot.goblin.${slot}`, version: 2, quantity: 1, tier: 'Recruit', upgrade_level: 0, loc_kind: 'equipped', loc_owner: PC, loc_index: null,
  loc_slot: paperdollOf(slotOf(`goblin.${slot}` as never)), bound_to: null, mint_key: `claim:${n}0000`, provenance: prov(n, `goblin.${slot}`), history: [],
});
const idOf = (slot: string) => `inst:w-${SLOTS.indexOf(slot) + 1}`;
async function inv(slots: string[], wear: Record<string, unknown> | 'absent' = {}) {
  const items = slots.map((s) => row(SLOTS.indexOf(s) + 1, s));
  const db: Db = { async run(sql) {
    if (/origins_item_wear/.test(sql)) return wear === 'absent' ? 'absent' : JSON.stringify(wear);
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: 64, bank_slots: 1000 }], items, quests: [], journal: [], talk: [] });
  } };
  return { db, inventory: (await openHoldingsWith(db, UID, PC, { lookup })).inventory };
}
const kill = (token: string) => ({ account: UID, character: PC, token });
const bitten = (token: string) => wornSlot(rollsOf(UID, token)[0]);
const tokenFor = (pred: (slot: string) => boolean) => { for (let i = 0; i < 500; i++) if (pred(bitten(`tok-${i}-aaaaaaaaaaaaaaaa`))) return `tok-${i}-aaaaaaaaaaaaaaaa`; throw new Error('no token'); };

test('wear writer: a paid kill wears the ONE equipped piece its token picks, by the tier\'s killWear row, from the gear row\'s wearMax; the same token picks the same piece', async () => {
  const token = tokenFor((s) => SLOTS.includes(s)), slot = bitten(token), kind = wearKindOf(`item:loot.goblin.${slot}`)!;
  const { db, inventory } = await inv(SLOTS);
  const lines = await killWearLines(db, kill(token), inventory);
  assert.equal(lines.length, 1);
  const line = lines[0] as { op: string; event_id: string; kind: string; payload: { wear: Piece & { instance: string; seq: number } } };
  assert.deepEqual([line.op, line.kind, line.event_id], ['event', 'metal', `wear:${idOf(slot)}:1`]);
  assert.deepEqual(line.payload.wear, { instance: idOf(slot), seq: 1, worn: kind.tier.killWear, max: wearMaxOf(kind.tier), baseMax: wearMaxOf(kind.tier) });
  assert.deepEqual(await killWearLines(db, kill(token), inventory), lines);
});

test('wear writer: a piece already worn continues its wear (seq + 1, worn adds, max kept); a piece at its max does not wear further', async () => {
  const token = tokenFor((s) => SLOTS.includes(s)), slot = bitten(token), kind = wearKindOf(`item:loot.goblin.${slot}`)!, id = idOf(slot);
  const prior = { instance: id, seq: 4, worn: 10, max: 50, baseMax: 60 };
  const a = await inv(SLOTS, { [id]: prior });
  const [line] = await killWearLines(a.db, kill(token), a.inventory) as { event_id: string; payload: { wear: Piece & { seq: number } } }[];
  assert.deepEqual([line!.event_id, line!.payload.wear.seq, line!.payload.wear.worn, line!.payload.wear.max], [`wear:${id}:5`, 5, 10 + kind.tier.killWear, 50]);
  const done = await inv(SLOTS, { [id]: { ...prior, worn: 50 } });
  assert.deepEqual(await killWearLines(done.db, kill(token), done.inventory), []);
});

test('wear writer: an empty slot absorbs the bite, and a database without the wear ledger wears nothing (the kill still pays)', async () => {
  const token = tokenFor((s) => s !== 'Helmet');
  const lone = await inv(['Helmet']);
  assert.deepEqual(await killWearLines(lone.db, kill(token), lone.inventory), []);
  const noLedger = await inv(SLOTS, 'absent');
  assert.deepEqual(await killWearLines(noLedger.db, kill(token), noLedger.inventory), []);
});

test('wear writer: the bite lands on the slots in proportion to the wear-slot rows (a slot with share 0 is never picked)', () => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 4000; i++) { const s = bitten(`t-${i}-bbbbbbbbbbbbbbbb`); counts[s] = (counts[s] ?? 0) + 1; }
  for (const s of WEAR_SLOTS) assert.ok(s.share === 0 ? !counts[s.id] : Math.abs((counts[s.id] ?? 0) / 4000 * 100 - s.share) < 4, `${s.id} ${counts[s.id]}`);
});

// ---- wear must never cost a payment -------------------------------------------------------------------------------------------------------------------------
type Line = { op: string; event_id: string; payload?: { wear?: { instance: string; seq: number; worn: number; max: number; baseMax: number } } };
const NEW_WEAR = (seq: number): Line[] => [{ op: 'event', event_id: `wear:inst:w-1:${seq}`, payload: { wear: { instance: 'inst:w-1', seq, worn: 6, max: 60, baseMax: 60 } } }];
function clashDb(ownEventStored = false): Db { return { async run(sql) { if (/origins_event\(/.test(sql)) return ownEventStored ? JSON.stringify({ payload: {} }) : 'null'; throw new Error(`unexpected sql: ${sql.slice(0, 40)}`); } }; }
const clash = () => new DbError('O0001', 'already settled');

test('settleWithWear: a wear-seq clash (the kill\'s own event is NOT stored) re-reads the wear and retries ONCE with the fresh seq: the kill is paid', async () => {
  const seqs = [1, 2]; const tried: string[][] = [];
  const out = await settleWithWear({ db: clashDb(), account: UID, ownEventId: 'enc:tok', wear: async () => NEW_WEAR(seqs.shift()!) as never,
    commit: async (w) => { tried.push((w as Line[]).map((l) => l.event_id)); if ((w as Line[])[0]?.event_id.endsWith(':1')) throw clash(); return 'paid'; } });
  assert.deepEqual([out, tried], ['paid', [['wear:inst:w-1:1'], ['wear:inst:w-1:2']]]);
});

test('settleWithWear: if the fresh seq clashes too, the kill settles WITHOUT the wear line (a missed bit of wear is fine, a missed payment is not)', async () => {
  const tried: number[] = [];
  const out = await settleWithWear({ db: clashDb(), account: UID, ownEventId: 'enc:tok', wear: async () => NEW_WEAR(1) as never,
    commit: async (w) => { tried.push(w.length); if (w.length) throw clash(); return 'paid'; } });
  assert.deepEqual([out, tried], ['paid', [1, 1, 0]]);
});

test('settleWithWear: a genuine replay (the kill\'s own event is stored) and any other error are rethrown untouched, never retried, never read as a wear clash', async () => {
  let calls = 0;
  await assert.rejects(settleWithWear({ db: clashDb(true), account: UID, ownEventId: 'enc:tok', wear: async () => NEW_WEAR(1) as never, commit: async () => { calls++; throw clash(); } }), (e: unknown) => e instanceof DbError && e.code === 'O0001');
  await assert.rejects(settleWithWear({ db: clashDb(), account: UID, ownEventId: 'enc:tok', wear: async () => NEW_WEAR(1) as never, commit: async () => { calls++; throw new DbError('O0002', 'stale'); } }), (e: unknown) => e instanceof DbError && e.code === 'O0002');
  assert.equal(calls, 2);
  let none = 0;
  assert.equal(await settleWithWear({ db: clashDb(), account: UID, ownEventId: 'enc:tok', wear: async () => [], commit: async (w) => { none += w.length; return 'paid'; } }), 'paid');   // nothing to wear: one plain commit
  assert.equal(none, 0);
});

test('two kills settling close together on the SAME piece: both are paid, the piece carries both bites (seq 1 then 2)', async () => {
  const rows = new Map<string, Line>(), taken = new Set<string>();
  const db: Db = { async run(sql) {
    if (/origins_event\(/.test(sql)) return 'null';
    if (/origins_item_wear/.test(sql)) { const w = [...rows.values()].map((l) => l.payload!.wear!); const cur = w.sort((a, b) => b.seq - a.seq)[0]; return JSON.stringify(cur ? { [cur.instance]: cur } : {}); }
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: 64, bank_slots: 1000 }], items: SLOTS.map((sl, i) => row(i + 1, sl)), quests: [], journal: [], talk: [] });
  } };
  const { inventory } = await inv(SLOTS);
  const tokenA = tokenFor((sl) => sl === 'Body');
  const pick = (token: string) => killWearLines(db, kill(token), inventory);
  const staleA = await pick(tokenA);                      // both kills read the wear BEFORE either commits
  const staleB = await pick(tokenA);                      // same piece, same seq
  const commitTo = (name: string, first: store_Json[]) => (w: store_Json[]) => { void name; for (const l of (w.length ? w : []) as Line[]) { if (taken.has(l.event_id)) throw clash(); } for (const l of w as Line[]) { taken.add(l.event_id); rows.set(l.event_id, l); } return Promise.resolve(`paid:${first.length}`); };
  const a = await settleWithWear({ db, account: UID, ownEventId: 'enc:a', wear: async () => staleA as never, commit: commitTo('a', staleA as never) });
  let reads = 0;
  const b = await settleWithWear({ db, account: UID, ownEventId: 'enc:b', wear: async () => (reads++ === 0 ? staleB : await pick(tokenA)) as never, commit: commitTo('b', staleB as never) });
  assert.deepEqual([a, b], ['paid:1', 'paid:1']);
  assert.deepEqual([...rows.keys()].map((k) => k.split(':').pop()), ['1', '2']);
  assert.equal(reads, 2);
});
type store_Json = unknown;

test('hit wear: hitsTaken sums only the event types the wearHitTypes rows name (a block, parry or dodge is not a hit taken)', () => {
  assert.deepEqual(WEAR_HIT_TYPES.map((t) => t.id), ['Hit', 'GuardBroken', 'SpecialLanded']);
  assert.equal(hitsTaken({ Hit: 4, GuardBroken: 1, SpecialLanded: 2, Blocked: 9, Parried: 3 }), 7);
  assert.equal(hitsTaken({}), 0);
});

test('hit wear: each blow taken bites once more; ONE line per piece however many bites it took, the same token and hits give the same lines, and no hits is the kill alone', async () => {
  const token = tokenFor((s) => SLOTS.includes(s));
  const { db, inventory } = await inv(SLOTS);
  const alone = await killWearLines(db, kill(token), inventory), none = await killWearLines(db, { ...kill(token), hits: 0 }, inventory);
  assert.deepEqual(none, alone);
  const many = await killWearLines(db, { ...kill(token), hits: 200 }, inventory) as { event_id: string; payload: { wear: Piece & { instance: string; seq: number } } }[];
  assert.deepEqual(await killWearLines(db, { ...kill(token), hits: 200 }, inventory), many);
  assert.equal(new Set(many.map((l) => l.payload.wear.instance)).size, many.length);                   // one line per piece
  assert.ok(many.every((l) => l.event_id === `wear:${l.payload.wear.instance}:1` && l.payload.wear.seq === 1));
  assert.ok(many.length > alone.length, '200 blows reach pieces the kill alone did not');
  for (const l of many) {
    const kind = wearKindOf(`item:loot.goblin.${SLOTS.find((sl) => idOf(sl) === l.payload.wear.instance)}`)!;
    assert.ok(l.payload.wear.worn > 0 && l.payload.wear.worn <= l.payload.wear.max && l.payload.wear.max === wearMaxOf(kind.tier));
  }
});

test('hit wear: blows continue a piece\'s stored wear (seq + 1) and never push it past its max; a database without the ledger still wears nothing', async () => {
  const token = tokenFor((s) => SLOTS.includes(s)), id = idOf(bitten(token));
  const a = await inv(SLOTS, { [id]: { instance: id, seq: 7, worn: 3, max: 50, baseMax: 60 } });
  const lines = await killWearLines(a.db, { ...kill(token), hits: 500 }, a.inventory) as { event_id: string; payload: { wear: Piece & { seq: number } } }[];
  const mine = lines.find((l) => l.event_id.startsWith(`wear:${id}:`))!;
  assert.deepEqual([mine.event_id, mine.payload.wear.seq, mine.payload.wear.worn, mine.payload.wear.max], [`wear:${id}:8`, 8, 50, 50]);
  const noLedger = await inv(SLOTS, 'absent');
  assert.deepEqual(await killWearLines(noLedger.db, { ...kill(token), hits: 50 }, noLedger.inventory), []);
});

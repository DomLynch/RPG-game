import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOT_IDS, PAPERDOLL, paperdollOf, slotOf, standingLevel, tierOf, type LootId } from '../../src/core/server.ts';
import { cumulative } from '../../src/core/career-model.ts';
import { PC } from '../../src/core/server.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import type { Db } from './db.ts';
import { gearHandlers, gearView } from './gear.ts';
import { CLOSES_AT_MS, gearImportHandler, type ImportReceipt } from './gear-import.ts';
import { Refused } from './errors.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', career = { seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
type Row = Record<string, unknown>;
// A stateful stub: origins_commit turns every `mint` op into a stored row, origins_open reads them back, so a second import sees the first.
function world(initial: Row[] = [], pack = 64, bank = 1000, gone: string[] = [], credit = 1e12) {   // credit: the account's server-verified total (the default reaches the top tier, so the older tests are about placement, not rank)   // gone: legacy mint keys of pieces that were retired or traded away (origins_items keeps them, unique)
  const rows: Row[] = [...initial], events = new Set<string>();
  const db: Db = { async run(sql, v = {}) {
    if (/origins_commit/.test(sql)) {
      for (const op of JSON.parse(v.b!) as Row[]) {
        if (op.op === 'event') { if (events.has(String(op.event_id))) throw Object.assign(new Error('dup'), { code: 'O0001' }); events.add(String(op.event_id)); }
        if (op.op === 'mint') {
          const it = op.item as Row, loc = it.loc as Row;
          if (rows.some((r) => r.mint_key === it.mint_key) || gone.includes(String(it.mint_key))) throw new Error('duplicate mint key (the database refuses it)');
          rows.push({ id: it.id, item: it.item, version: 0, quantity: it.quantity, tier: it.tier, upgrade_level: 0, loc_kind: loc.kind, loc_owner: loc.owner, loc_index: loc.index ?? null, loc_slot: loc.slot ?? null, bound_to: null, mint_key: it.mint_key, provenance: it.provenance, history: [] });
        }
      }
      return '[]';
    }
    if (/origins_mint_keys_held/.test(sql)) return JSON.stringify([...rows.map((r) => String(r.mint_key)), ...gone].filter((k) => (JSON.parse(v.k!) as string[]).includes(k)));
    return JSON.stringify({ marks: 0, career: { ...career, total_credit: credit }, characters: [{ id: PC, pack_slots: pack, bank_slots: bank }], items: rows, quests: [], journal: [], talk: [] });
  } };
  return { db, rows };
}
const ops = gearHandlers({ lookup: lookupOf(loaded.value) });
const ctx = (db: Db) => ({ db, account: UID });
const run = async (db: Db, body: Record<string, unknown>) => ops.gear_import!(ctx(db), { character: PC, ...body }) as Promise<ImportReceipt>;
const view = async (db: Db) => ops.gear_open!(ctx(db), { character: PC }) as Promise<ReturnType<typeof gearView>>;
const ALL = [...LOOT_IDS].sort() as LootId[];
// one worn piece per paperdoll slot, the first armour LootId that fits it
const WORN = Object.fromEntries(Object.keys(PAPERDOLL).map((doll) => [doll, ALL.find((id) => paperdollOf(slotOf(id)) === doll)!]));

test('THE AUDITOR PROOF: a full 75-piece profile (every LootId owned, one worn per slot) lands as the same set and the same worn map; pack fills first, the overflow goes to the bank, worn counts toward neither', async () => {
  const w = world(), tiers = Object.fromEntries(ALL.map((id, i) => [id, (i % 10) + 1]));
  const r = await run(w.db, { owned: ALL, equipped: WORN, tiers });
  assert.equal(r.imported.length, ALL.length);
  assert.deepEqual(r.skipped, []);
  const v = await view(w.db);
  assert.deepEqual(v.pieces.map((p) => p.lootId).sort(), [...ALL].sort(), 'the same set, nothing lost, nothing invented');
  assert.deepEqual(Object.fromEntries(Object.entries(v.worn).map(([doll, id]) => [doll, v.pieces.find((p) => p.id === id)!.lootId])), WORN, 'the same worn map');
  const packed = v.pieces.filter((p) => p.where === 'pack'), banked = v.pieces.filter((p) => p.where === 'bank'), worn = v.pieces.filter((p) => p.where === 'equipped');
  assert.equal(worn.length, Object.keys(WORN).length);
  assert.equal(packed.length + banked.length + worn.length, ALL.length);
  assert.ok(packed.length <= 64 && banked.length === Math.max(0, ALL.length - worn.length - 64), `pack ${packed.length}, bank ${banked.length}`);
  assert.deepEqual(r.bank.length, banked.length);
  assert.equal(new Set(v.pieces.map((p) => `${p.where}:${p.index ?? p.paperdoll}`)).size, ALL.length, 'one piece per place');
});

test('a replay changes nothing (same set, every piece "already held"), and a stale device that signed in later adds exactly the difference', async () => {
  const w = world();
  await run(w.db, { owned: ALL.slice(0, 40), equipped: {} });
  const before = JSON.stringify(w.rows);
  const again = await run(w.db, { owned: ALL.slice(0, 40), equipped: {} });
  assert.deepEqual([again.imported, again.alreadyHeld.length], [[], 40]);
  assert.equal(JSON.stringify(w.rows), before, 'nothing written');
  const stale = await run(w.db, { owned: ALL.slice(20, 60), equipped: {} });   // the other device: 20 it shares, 20 it alone had
  assert.deepEqual([stale.imported.length, stale.alreadyHeld.length], [20, 20]);
  assert.equal((await view(w.db)).pieces.length, 60, 'the union, no duplicate');
  assert.equal(new Set(w.rows.map((r) => r.mint_key)).size, w.rows.length, 'one mint key per piece');
});

test('unknown LootIds are skipped and reported, never fatal; a worn slot already taken sends the piece to the pack (nothing displaced); worn forgotten from owned still arrives', async () => {
  const w = world();
  const helm = ALL.filter((id) => slotOf(id) === 'Helmet');
  const r1 = await run(w.db, { owned: ['nobody.Helmet', 'goblin.Spoon', ...helm.slice(0, 1)], equipped: { head: helm[0] } });
  assert.deepEqual(r1.skipped.map((s) => s.lootId).sort(), ['goblin.Spoon', 'nobody.Helmet']);   // not LootIds: nothing to mint
  assert.deepEqual(r1.worn, [helm[0]]);
  const r2 = await run(w.db, { owned: [], equipped: { head: helm[1] } });   // the head is taken now
  assert.deepEqual([r2.imported, r2.worn, r2.unworn.map((u) => u.lootId)], [[helm[1]], [], [helm[1]]]);   // head taken: owned, so pack, and said so
  const v = await view(w.db);
  assert.equal(v.pieces.find((p) => p.lootId === helm[1])!.where, 'pack');
  assert.equal(v.pieces.find((p) => p.lootId === helm[0])!.where, 'equipped');
  const gloves = ALL.find((id) => slotOf(id) === 'Gloves')!;
  const bad = await run(w.db, { owned: [], equipped: { head: gloves, tail: ALL.find((id) => slotOf(id) === 'Boots') } });
  assert.deepEqual([bad.imported.length, bad.skipped.length, bad.worn.length, bad.unworn.length], [2, 0, 0, 2], 'a worn piece the slot cannot take is NOT dropped: it falls back to the pack, reported as unworn');
  assert.ok((await view(w.db)).pieces.some((p) => p.lootId === gloves && p.where === 'pack'));
});

test('malformed bodies are 400s and nothing is minted; the rung a piece was taken at is recorded (tier + legend), absent means Recruit', async () => {
  const w = world();
  for (const body of [{ owned: 'x' }, { owned: [1] }, { owned: Array.from({ length: 201 }, () => 'a.b') }, { owned: [], equipped: [] }]) await assert.rejects(async () => run(w.db, body), /owned|equipped/);
  assert.equal(w.rows.length, 0);
  const id = ALL.find((x) => x.startsWith('veteran.'))!;
  await run(w.db, { owned: [id, ALL.find((x) => x.startsWith('goblin.'))!], tiers: { [id]: 3 } });
  const a = w.rows.find((r) => r.mint_key === `legacy:${UID}:${id.toLowerCase()}`)!, b = w.rows.find((r) => r.id !== a.id)!;
  assert.deepEqual([a.tier, (a.provenance as Row).fromLegend, (a.provenance as Row).atRank, a.loc_kind], ['Gladiator', 'veteran-3', 'Gladiator', 'pack']);
  assert.deepEqual([b.tier, (b.provenance as Row).fromLegend, (b.provenance as Row).atRank], ['Recruit', null, null]);
});

test('a full pack AND a full bank skips the rest with a reason (nothing lost silently); a character with a full pack sends the whole import to the bank', async () => {
  const tiny = world([], 2, 3);
  const r = await run(tiny.db, { owned: ALL.slice(0, 7), equipped: {} });
  assert.deepEqual([r.imported.length, r.bank.length, r.skipped.length], [5, 3, 2]);
  assert.ok(r.skipped.every((s) => s.reason === 'pack and bank are full'));
});

test('a piece migrated once and later retired or traded away is alreadyHeld for good: its mint key is unique across all rows, so it is never planned again (Auditor, #1984)', async () => {
  const gone = [`legacy:${UID}:${ALL[0]!.toLowerCase()}`], w = world([], 64, 1000, gone);
  const r = await run(w.db, { owned: ALL.slice(0, 3), equipped: {} });
  assert.deepEqual([r.alreadyHeld, r.imported.length], [[ALL[0]], 2]);
  assert.equal(w.rows.length, 2, 'only the two new pieces were minted');
  const without = world([], 64, 1000, []);   // a database without the function would answer the live view only: the stub's rows are the same, nothing else is known
  assert.equal((await run(without.db, { owned: ALL.slice(0, 3), equipped: {} })).imported.length, 3);
});

// ---- the rank cap and the cut-off (Lead/Strategy 2026-10-16, the audit found one top-tier piece minted on a level-1 account) -----------------------------------------------------------------
// The minted tier is the client's `tiers` claim; it is bounded by the tier the account's SERVER-verified career level can reach (standingLevel(total_credit), the same standing gear.ts equips on).
const creditForTier = (t: number): number => { for (let lvl = 0; lvl <= 60; lvl++) if (tierOf(standingLevel(cumulative(lvl))) === t) return cumulative(lvl); throw new Error(`no credit reaches tier ${t}`); };

test('a forged full-catalog POST at the top rung on a level-1 account mints nothing: every piece is skipped "above your rank", and no mint key is spent', async () => {
  const w = world([], 64, 1000, [], 0), tiers = Object.fromEntries(ALL.map((id) => [id, 10]));
  const r = await run(w.db, { owned: ALL, equipped: WORN, tiers });
  assert.deepEqual([r.imported.length, r.worn.length, r.skipped.length], [0, 0, ALL.length]);
  assert.ok(r.skipped.every((s) => s.reason === 'above your rank'));
  assert.equal(w.rows.length, 0, 'nothing minted');
  // ... and it is not a lock: the same pieces import at the rank the account really holds (the skip kept their mint keys free)
  const ok = await run(w.db, { owned: ALL.slice(0, 5), equipped: {}, tiers: Object.fromEntries(ALL.slice(0, 5).map((id) => [id, 1])) });
  assert.equal(ok.imported.length, 5);
});

test('the cap follows the verified level: tier 3 imports rungs 1..3 and skips 4..10 in the same body; a legit in-rank ledger lands exactly as before; an unclaimed rung still mints at Recruit', async () => {
  const w = world([], 64, 1000, [], creditForTier(3)), ids = ALL.slice(0, 6);
  const r = await run(w.db, { owned: ids, equipped: {}, tiers: { [ids[0]!]: 1, [ids[1]!]: 3, [ids[2]!]: 4, [ids[3]!]: 10, [ids[4]!]: 2 } });   // ids[5] has no claimed rung
  assert.deepEqual(r.imported.sort(), [ids[0], ids[1], ids[4], ids[5]].sort());
  assert.deepEqual(r.skipped.map((s) => s.lootId).sort(), [ids[2], ids[3]].sort());
  const tierOfId = (id: LootId) => w.rows.find((x) => x.mint_key === `legacy:${UID}:${id.toLowerCase()}`)!.tier;
  assert.deepEqual([tierOfId(ids[0]!), tierOfId(ids[1]!), tierOfId(ids[4]!), tierOfId(ids[5]!)], ['Recruit', 'Gladiator', 'Legionary', 'Recruit']);
  // an account with no career row at all is the first tier
  const none = world([], 64, 1000, [], 0), r2 = await run(none.db, { owned: [ids[0]!, ids[1]!], equipped: {}, tiers: { [ids[0]!]: 1, [ids[1]!]: 2 } });
  assert.deepEqual([r2.imported, r2.skipped.map((s) => s.lootId)], [[ids[0]], [ids[1]]]);
});

test('the cut-off row: before it the op runs; at and after it everything is refused (422 closed) and nothing is read or minted', async () => {
  const w = world(), open = gearImportHandler({ lookup: lookupOf(loaded.value) }, () => CLOSES_AT_MS - 1), shut = gearImportHandler({ lookup: lookupOf(loaded.value) }, () => CLOSES_AT_MS);
  const body = { character: PC, owned: ALL.slice(0, 2), equipped: {} };
  assert.equal(((await open(ctx(w.db), body)) as ImportReceipt).imported.length, 2);
  const before = w.rows.length;
  await assert.rejects(async () => shut(ctx(w.db), { ...body, owned: ALL.slice(2, 4) }), (e: unknown) => e instanceof Refused && e.status === 422 && e.code === 'closed');
  await assert.rejects(async () => shut(ctx(w.db), body), (e: unknown) => e instanceof Refused && e.code === 'closed', 'a replay is refused too');
  assert.equal(w.rows.length, before, 'nothing minted after the cut-off');
  assert.ok(CLOSES_AT_MS > Date.parse('2026-10-16T00:00:00Z'), 'the placeholder row is a date in the future');
});

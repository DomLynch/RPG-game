import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOT_IDS, PAPERDOLL, paperdollOf, slotOf, type LootId } from '../../src/loot.ts';
import { PC } from '../contracts/fixtures.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import type { Db } from './db.ts';
import { gearHandlers, gearView } from './gear.ts';
import type { ImportReceipt } from './gear-import.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', career = { seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
type Row = Record<string, unknown>;
// A stateful stub: origins_commit turns every `mint` op into a stored row, origins_open reads them back, so a second import sees the first.
function world(initial: Row[] = [], pack = 64, bank = 1000) {
  const rows: Row[] = [...initial], events = new Set<string>();
  const db: Db = { async run(sql, v = {}) {
    if (/origins_commit/.test(sql)) {
      for (const op of JSON.parse(v.b!) as Row[]) {
        if (op.op === 'event') { if (events.has(String(op.event_id))) throw Object.assign(new Error('dup'), { code: 'O0001' }); events.add(String(op.event_id)); }
        if (op.op === 'mint') {
          const it = op.item as Row, loc = it.loc as Row;
          if (rows.some((r) => r.mint_key === it.mint_key)) throw new Error('duplicate mint key (the database refuses it)');
          rows.push({ id: it.id, item: it.item, version: 0, quantity: it.quantity, tier: it.tier, upgrade_level: 0, loc_kind: loc.kind, loc_owner: loc.owner, loc_index: loc.index ?? null, loc_slot: loc.slot ?? null, bound_to: null, mint_key: it.mint_key, provenance: it.provenance, history: [] });
        }
      }
      return '[]';
    }
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: pack, bank_slots: bank }], items: rows, quests: [], journal: [], talk: [] });
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
  assert.deepEqual(r1.skipped.map((s) => s.lootId).sort(), ['goblin.Spoon', 'nobody.Helmet']);
  assert.deepEqual(r1.worn, [helm[0]]);
  const r2 = await run(w.db, { owned: [], equipped: { head: helm[1] } });   // the head is taken now
  assert.deepEqual([r2.imported, r2.worn], [[helm[1]], []]);
  const v = await view(w.db);
  assert.equal(v.pieces.find((p) => p.lootId === helm[1])!.where, 'pack');
  assert.equal(v.pieces.find((p) => p.lootId === helm[0])!.where, 'equipped');
  const bad = await run(w.db, { owned: [], equipped: { head: ALL.find((id) => slotOf(id) === 'Gloves') } });
  assert.equal(bad.skipped.length, 1, 'a Gloves piece cannot be on the head');
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

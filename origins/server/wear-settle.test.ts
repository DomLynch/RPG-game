import assert from 'node:assert/strict';
import test from 'node:test';
import { PC, paperdollOf, slotOf } from '../../src/core/server.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { WEAR_SLOTS, wearKindOf, wearMaxOf, wornSlot, type Piece } from '../gear/wear-repair.ts';
import type { Db } from './db.ts';
import { openHoldingsWith } from './holdings.ts';
import { killWearLines, rollsOf } from './wear-settle.ts';

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

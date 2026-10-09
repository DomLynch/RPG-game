import assert from 'node:assert/strict';
import test from 'node:test';
import { PC } from '../contracts/fixtures.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { DbError, type Db } from './db.ts';
import { Refused } from './errors.ts';
import { gearHandlers, gearView, putsBetween } from './gear.ts';
import { openHoldingsWith } from './holdings.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const lookup = lookupOf(loaded.value), UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
const prov = (n: number, lootId: string) => ({ kind: 'arena-award', at: '2026-10-06T12:00:00Z', claimId: n, lootId, wonBy: PC, fromLegend: `${lootId.split('.')[0]}-1`, atRank: 'Recruit' });
const row = (n: number, lootId: string, loc: Record<string, unknown>) => ({
  id: `inst:t-${n}`, item: `item:loot.${lootId}`, version: 2, quantity: 1, tier: 'Recruit', upgrade_level: 0, loc_kind: loc.kind, loc_owner: PC, loc_index: loc.index ?? null, loc_slot: loc.slot ?? null,
  bound_to: null, mint_key: `claim:${n}0000`, provenance: prov(n, lootId), history: [],
});
const career = { seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
function stub(items: unknown[], opts: { stale?: boolean } = {}) {
  const commits: { op: string; id: string; expected_version: number; loc: { kind: string; slot?: string; index?: number } }[][] = [];
  const db: Db = { async run(sql, v = {}) {
    if (/origins_commit/.test(sql)) { if (opts.stale) throw new DbError('O0002', 'stale'); commits.push(JSON.parse(v.b!)); return '[]'; }
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: 64, bank_slots: 1000 }], items, quests: [], journal: [], talk: [] });
  } };
  return { db, commits };
}
const content = { lookup };
const ctx = (db: Db) => ({ db, account: UID });
const ops = gearHandlers(content);

test('gear_open: every held or worn gear piece with its LootId, where it is and the worn map; non-gear is left out', async () => {
  const s = stub([row(1, 'goblin.Helmet', { kind: 'pack', index: 0 }), row(2, 'goblin.Body', { kind: 'equipped', slot: 'chest' }), row(3, 'goblin.Boots', { kind: 'bank', index: 4 })]);
  const out = await ops.gear_open!(ctx(s.db), { character: PC }) as ReturnType<typeof gearView>;
  assert.deepEqual(out.pieces.map((p) => [p.lootId, p.where, p.index, p.paperdoll]), [['goblin.Helmet', 'pack', 0, null], ['goblin.Body', 'equipped', null, 'chest'], ['goblin.Boots', 'bank', 4, null]]);
  assert.deepEqual(out.worn, { chest: 'inst:t-2' });
  assert.deepEqual([out.packSize, out.bankSize], [64, 1000]);
});

test('gear_equip: a pack piece goes on its paperdoll slot as ONE versioned put; the server reads the rank, the body names only character and id', async () => {
  const s = stub([row(1, 'goblin.Helmet', { kind: 'pack', index: 0 })]);
  const out = await ops.gear_equip!(ctx(s.db), { character: PC, id: 'inst:t-1', slot: 'feet', tier: 'Origin', level: 99 }) as ReturnType<typeof gearView>;
  assert.deepEqual(s.commits.length, 1);
  const put = s.commits[0]![0]!;
  assert.deepEqual([s.commits[0]!.length, put.op, put.id, put.expected_version, put.loc.kind, put.loc.slot], [1, 'put', 'inst:t-1', 2, 'equipped', 'head']);
  assert.deepEqual(out.worn, { head: 'inst:t-1' });
});

test('gear_equip refuses what inventory.equip refuses: an occupied slot (no silent swap), a piece that is not in the pack, an unknown piece; nothing is committed', async () => {
  const s = stub([row(1, 'goblin.Helmet', { kind: 'pack', index: 0 }), row(2, 'veteran.Helmet', { kind: 'equipped', slot: 'head' }), row(3, 'goblin.Boots', { kind: 'bank', index: 0 })]);
  const refused = (code: number) => (e: unknown) => e instanceof Refused && e.status === code;
  await assert.rejects(async () => ops.gear_equip!(ctx(s.db), { character: PC, id: 'inst:t-1' }), refused(422));
  await assert.rejects(async () => ops.gear_equip!(ctx(s.db), { character: PC, id: 'inst:t-3' }), refused(422));
  await assert.rejects(async () => ops.gear_equip!(ctx(s.db), { character: PC, id: 'inst:nope' }), refused(422));
  assert.deepEqual(s.commits, []);
});

test('gear_unequip: a worn piece returns to the first free pack slot (or the slot asked); a pack piece refuses', async () => {
  const s = stub([row(1, 'goblin.Helmet', { kind: 'equipped', slot: 'head' }), row(2, 'goblin.Body', { kind: 'pack', index: 0 })]);
  const out = await ops.gear_unequip!(ctx(s.db), { character: PC, id: 'inst:t-1' }) as ReturnType<typeof gearView>;
  const put = s.commits[0]![0]!;
  assert.deepEqual([put.op, put.id, put.loc.kind, put.loc.index], ['put', 'inst:t-1', 'pack', 1]);
  assert.deepEqual(out.worn, {});
  await assert.rejects(async () => ops.gear_unequip!(ctx(s.db), { character: PC, id: 'inst:t-2' }), Refused);
});

test('a stale read (the piece moved under us) aborts with the database\'s O0002; malformed bodies are 400s; putsBetween is empty when nothing moved', async () => {
  const s = stub([row(1, 'goblin.Helmet', { kind: 'pack', index: 0 })], { stale: true });
  await assert.rejects(async () => ops.gear_equip!(ctx(s.db), { character: PC, id: 'inst:t-1' }), (e: unknown) => e instanceof DbError && e.code === 'O0002');
  await assert.rejects(async () => ops.gear_equip!(ctx(s.db), { character: PC }), /id: a piece id/);
  await assert.rejects(async () => ops.gear_unequip!(ctx(s.db), { character: PC, id: 'inst:t-1', index: -1 }), /index/);
  const { inventory } = await openHoldingsWith(stub([row(1, 'goblin.Helmet', { kind: 'pack', index: 0 })]).db, UID, PC, content);
  assert.deepEqual(putsBetween(inventory, inventory), []);
});

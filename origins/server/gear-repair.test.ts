import assert from 'node:assert/strict';
import test from 'node:test';
import { PC } from '../../src/core/server.ts';
import { repairCost, repairedPiece, wearKindOf, type Piece } from '../gear/wear-repair.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { DbError, type Db } from './db.ts';
import { Refused } from './errors.ts';
import { gearRepairHandler } from './gear-repair.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const lookup = lookupOf(loaded.value), UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', OP = 'repair:op-0001';
const career = { seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 };
const loc = (kind: string, index: number) => ({ loc_kind: kind, loc_owner: PC, loc_index: index, loc_slot: null });
const base = { version: 2, tier: 'Recruit', upgrade_level: 0, bound_to: null, history: [] };
const helmet = { ...base, id: 'inst:t-1', item: 'item:loot.goblin.Helmet', quantity: 1, ...loc('pack', 0), mint_key: 'claim:10000', provenance: { kind: 'arena-award', at: '2026-10-06T12:00:00Z', claimId: 1, lootId: 'goblin.Helmet', wonBy: PC, fromLegend: 'goblin-1', atRank: 'Recruit' } };
const iron = (qty: number) => ({ ...base, id: 'inst:t-9', item: 'item:grave-iron', quantity: qty, tier: null, ...loc('pack', 1), mint_key: 'mob:90000', provenance: { kind: 'loot', at: '2026-10-06T12:00:00Z', wonBy: PC, table: 'loottable:scavenger', encounter: null } });
const kind = wearKindOf('item:loot.goblin.Helmet')!;
const worn: Piece = { worn: 12, max: 40, baseMax: 40 };
const cost = repairCost(kind.tier, worn, worn.worn, undefined, kind.slot);

type Opts = { wear?: Piece | null; bronze?: number; ironQty?: number; stored?: unknown; stale?: boolean };
function stub(o: Opts = {}) {
  const commits: Record<string, unknown>[][] = [];
  const db: Db = { async run(sql, v = {}) {
    if (/origins_commit/.test(sql)) { if (o.stale) throw new DbError('O0002', 'stale'); commits.push(JSON.parse(v.b!)); return '[]'; }
    if (/origins_event\(/.test(sql)) return o.stored ? JSON.stringify({ payload: o.stored }) : 'null';
    if (/origins_item_wear/.test(sql)) return o.wear === undefined || o.wear === null ? 'null' : JSON.stringify({ instance: 'inst:t-1', ...o.wear });
    if (/origins_metal_of/.test(sql)) return JSON.stringify({ bronze: o.bronze ?? 1000, version: 3 });
    const items = [helmet, ...((o.ironQty ?? 99) > 0 ? [iron(o.ironQty ?? 99)] : [])];
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: 64, bank_slots: 1000 }], items, quests: [], journal: [], talk: [] });
  } };
  return { db, commits };
}
const AT_SMITH = async () => ({ online: true, placed: true, zone: 'exchange', ageMs: 100 } as never), AWAY = async () => ({ online: true, placed: true, zone: 'zone1', ageMs: 100 } as never);
const run = (s: { db: Db }, body: Record<string, unknown> = {}, where: typeof AT_SMITH | undefined = AT_SMITH) =>
  gearRepairHandler({ lookup })({ db: s.db, account: UID, where } as never, { character: PC, op: OP, instance: 'inst:t-1', ...body });
const refused = async (p: Promise<unknown>, status: number, code: string) => {
  await assert.rejects(p, (e: unknown) => e instanceof Refused && e.status === status && e.code === code, `expected ${status} ${code}`);
};

test('gear_repair: the cost is the wear-repair rows\' (nothing in the body); ONE batch = the wear event, the bronze spend and the burned iron', async () => {
  const s = stub({ wear: worn });
  const out = await run(s) as { points: number; cost: { bronze: number; metal: { item: string; qty: number } }; piece: Piece; replayed: boolean };
  assert.deepEqual([out.points, out.cost.bronze, out.cost.metal, out.piece, out.replayed], [worn.worn, cost.gold, { item: cost.metalItem, qty: cost.metal }, repairedPiece(worn), false]);
  assert.equal(s.commits.length, 1);
  const [event, spend, burn] = s.commits[0]!;
  assert.deepEqual([event!.op, event!.kind, event!.event_id], ['event', 'metal', `repair:${PC}:${OP}`]);
  assert.deepEqual((event!.payload as { wear: unknown }).wear, { instance: 'inst:t-1', ...repairedPiece(worn) });
  assert.deepEqual([spend!.op, spend!.delta_bronze, spend!.reason, spend!.expected_version], ['metal', -cost.gold, 'spend', 3]);
  assert.deepEqual([burn!.op, burn!.id, burn!.count], ['burn', 'inst:t-9', cost.metal]);
});

test('gear_repair: a piece with no wear row is not worn (422), and nothing is committed', async () => {
  const s = stub();
  await refused(run(s), 422, 'not-worn');
  assert.equal(s.commits.length, 0);
});

test('gear_repair: short of bronze is funds, short of grave iron is metal, away from the smith is away; none commits', async () => {
  const poor = stub({ wear: worn, bronze: cost.gold - 1 });
  await refused(run(poor), 422, 'funds');
  const noIron = stub({ wear: worn, ironQty: cost.metal - 1 });
  await refused(run(noIron), 422, 'metal');
  const far = stub({ wear: worn });
  await refused(run(far, {}, AWAY), 422, 'away');
  assert.deepEqual([poor.commits.length, noIron.commits.length, far.commits.length], [0, 0, 0]);
});

test('gear_repair: partial points cost the rows\' partial price; the body never names a price', async () => {
  const s = stub({ wear: worn });
  const out = await run(s, { points: 5, price: 1, gold: 0 }) as { points: number; cost: { bronze: number } };
  assert.deepEqual([out.points, out.cost.bronze], [5, repairCost(kind.tier, worn, 5, undefined, kind.slot).gold]);
});

test('gear_repair: the same op id answers the stored receipt (replayed, no commit); the same op for another piece is a 409', async () => {
  const receipt = { instance: 'inst:t-1', points: worn.worn, cost: { bronze: cost.gold, metal: { item: cost.metalItem, qty: cost.metal } }, piece: repairedPiece(worn) };
  const s = stub({ wear: repairedPiece(worn), stored: { receipt } });
  const out = await run(s) as { replayed: boolean; cost: unknown };
  assert.deepEqual([out.replayed, out.cost], [true, receipt.cost]);
  assert.equal(s.commits.length, 0);
  await assert.rejects(run(s, { instance: 'inst:t-2' }), (e: unknown) => e instanceof Error && /409|different/i.test((e as { status?: number }).status?.toString() ?? e.message));
});

test('gear_repair: a body that is not an op id, a character or a held piece is a 400, jewellery and non-wearing items are refused', async () => {
  const s = stub({ wear: worn });
  await assert.rejects(run(s, { op: 'x' }), /op/);
  await assert.rejects(run(s, { instance: 'inst:nope' }), /instance|not one of/);
  await assert.rejects(run(s, { points: -1 }), /points/);
});

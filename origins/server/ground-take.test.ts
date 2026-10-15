// Ground loot (#2775): the pure take (one-of-each, pack room, the mint under the derived key) and the two handlers over a stub database. The SQL side is scripts/origins-ground-check.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCOUNT, PC, openInventory } from '../../src/core/server.ts';
import type { CharacterInstanceId } from '../../src/core/server.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { GROUND_ITEMS, GROUND_LIMITS } from '../world/ground-items.ts';
import type { WhereFn } from '../presence/where.ts';
import { CENTRE_CM } from '../presence/zones.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import { groundKillId, groundOps, groundPointOf, groundTakeBatch, radiusOf } from './ground-take.ts';
import type { Json } from './store.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, lookup = lookupOf(content);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', INSTANCE = 'ground:zone1.rusty-sword-1', row = GROUND_ITEMS[INSTANCE]!;
const pack = (items: never[] = [], packSize = 20) => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items, packSize, bankSize: 10 }, lookup); if (!inv.ok) throw new Error('inventory'); return inv.value; };
const status = (s: number, code: string) => (e: unknown) => e instanceof Refused && e.status === s && e.code === code;
const NOW = '2026-10-15T12:00:00.000Z', at = { account: UID, character: PC, instance: INSTANCE, n: 1, row, content, at: NOW, reach: 'unchecked' as const };

// A stub database: ground_state answers `claims`, ground_take answers `take` (or throws), origins_open an empty pack; records the take call.
function stub(o: { claims?: { instance: string; n: number; takenAt: string }[]; take?: unknown; absent?: boolean; packItems?: unknown[] } = {}) {
  const takes: { i: string; n: string; r: string; b: Json[] }[] = [];
  const db: Db = { async run(sql, v = {}) {
    if (/origins_ground_/.test(sql) && o.absent) return 'absent';
    if (/origins_ground_state/.test(sql)) return JSON.stringify({ now: NOW, takes: o.claims ?? [] });
    if (/origins_ground_take/.test(sql)) { takes.push({ i: v.i!, n: v.n!, r: v.r!, b: JSON.parse(v.b!) }); if (o.take instanceof Error) throw o.take; return JSON.stringify(o.take ?? { result: 'taken', instance: v.i, n: Number(v.n) }); }
    return JSON.stringify({ marks: 0, career: { seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 }, characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: o.packItems ?? [], quests: [], journal: [], talk: [] });
  } };
  return { db, takes };
}
const point = groundPointOf(row)!;
const poseAt = (dx: number, zone = row.place): WhereFn => async () => ({ online: true as const, layer: 0, placed: true as const, x: CENTRE_CM + (point.x + dx) * 100, z: CENTRE_CM + point.z * 100, zone, ageMs: 100 });
const ctx = (db: Db, where?: WhereFn) => ({ db, account: UID, ...(where ? { where } : {}) });
const ops = (extra: object = {}) => groundOps({ content, now: () => new Date(NOW), log: () => {}, ...extra });

test('the take is pure and deterministic: the batch is the event then ONE mint, bound to the character, under loot:<killId>:0, and the killId is the digest the database derives', () => {
  const t = groundTakeBatch({ ...at, inventory: pack() });
  assert.ok('batch' in t, JSON.stringify(t));
  if (!('batch' in t)) return;
  assert.deepEqual(t.batch.map((l) => l.op), ['event', 'mint']);
  const mint = t.batch[1] as { item: { item: string; quantity: number; mint_key: string; bound_to: string | null; single_copy: boolean; loc: { kind: string; owner: string } } };
  assert.equal(mint.item.item, 'item:starter.rusty-sword'); assert.equal(mint.item.quantity, 1);
  assert.equal(mint.item.mint_key, `loot:${groundKillId(INSTANCE, UID, 1)}:0`);
  assert.equal(mint.item.bound_to, PC, 'bound on acquire to the taker');
  assert.ok(mint.item.single_copy && mint.item.loc.kind === 'pack' && mint.item.loc.owner === PC);
  assert.notEqual(groundKillId(INSTANCE, UID, 1), groundKillId(INSTANCE, UID, 2), 'a new claim number is a new key');
  assert.notEqual(groundKillId(INSTANCE, UID, 1), groundKillId(INSTANCE, 'other', 1), 'a different account is a different key');
  assert.match(mint.item.mint_key, /^[a-z0-9][a-z0-9:._-]{7,127}$/, 'fits the mint key pattern');
  assert.equal((t.batch[0] as { kind: string }).kind, 'mint', 'the event kind is one the ledger already allows');
});

test('one of each and pack room: a second sword is refused as have-it, a full pack as full, and nothing is minted in either case', () => {
  const first = groundTakeBatch({ ...at, inventory: pack() }) as { batch: Json[] };
  const held = (first.batch[1] as { item: Record<string, unknown> }).item;
  const inst = { kind: 'item-instance', schemaVersion: 1, id: held.id, item: held.item, version: 1, quantity: 1, tier: null, location: { kind: 'pack', owner: PC, index: 0 }, boundTo: PC, provenance: held.provenance, history: [] } as never;
  assert.deepEqual(groundTakeBatch({ ...at, inventory: pack([inst]) }), { refused: 'have-it' });
  assert.deepEqual(groundTakeBatch({ ...at, inventory: pack([], 0) }), { refused: 'full' });
});

test('the point and the radius come from rows: the place\'s centre plus the offset, and the row\'s radius or the default row plus the slack', () => {
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.z));
  assert.deepEqual(groundPointOf({ ...row, offsetX: 3, offsetZ: -2 }), { x: point.x + 3, z: point.z - 2 });
  assert.equal(groundPointOf({ ...row, place: 'nowhere' }), null);
  assert.equal(groundPointOf({ ...row, zone: 'zone0' }), null);
  assert.ok(radiusOf(row) > GROUND_LIMITS.defaultRadiusM && radiusOf({ radiusM: 3 }) > 3);
});

test('ground_state: every row with this account\'s availability from the database\'s clock; a taken row is not visible while the window runs (hiddenWhileTaken)', async () => {
  const fresh = await ops().ground_state!(ctx(stub().db), {}) as { items: { instance: string; available: boolean; visible: boolean; availableAt: string | null }[] };
  assert.deepEqual(fresh.items.map((i) => [i.instance, i.available, i.visible, i.availableAt]), [[INSTANCE, true, true, null]]);
  const takenAt = new Date(Date.parse(NOW) - 600_000).toISOString();
  const taken = await ops().ground_state!(ctx(stub({ claims: [{ instance: INSTANCE, n: 1, takenAt }] }).db), {}) as typeof fresh;
  assert.deepEqual([taken.items[0]!.available, taken.items[0]!.visible, taken.items[0]!.availableAt], [false, false, new Date(Date.parse(takenAt) + row.respawnSec * 1000).toISOString()]);
  const back = new Date(Date.parse(NOW) - (row.respawnSec + 1) * 1000).toISOString();
  assert.equal(((await ops().ground_state!(ctx(stub({ claims: [{ instance: INSTANCE, n: 1, takenAt: back }] }).db), {})) as typeof fresh).items[0]!.available, true, 'the window has passed: it is back');
});

test('ground_take: a first take sends claim number 1, the row\'s respawn window and the batch; the body names nothing but the character and the instance', async () => {
  const s = stub();
  const got = await ops().ground_take!(ctx(s.db), { character: PC, instance: INSTANCE }) as { result: string; item: string; qty: number; availableAt: string };
  assert.deepEqual([got.result, got.item, got.qty], ['taken', 'item:starter.rusty-sword', 1]);
  assert.equal(got.availableAt, new Date(Date.parse(NOW) + row.respawnSec * 1000).toISOString());
  assert.deepEqual([s.takes[0]!.i, s.takes[0]!.n, s.takes[0]!.r, s.takes[0]!.b.map((l) => l.op)], [INSTANCE, '1', String(row.respawnSec), ['event', 'mint']]);
  assert.equal((s.takes[0]!.b[0] as { payload: { ground: { reach: string } } }).payload.ground.reach, 'unchecked', 'no presence: recorded as unchecked');
});

test('ground_take: the next claim number after a respawn; inside the window it is taken and the database is never asked', async () => {
  const old = new Date(Date.parse(NOW) - (row.respawnSec + 5) * 1000).toISOString(), s = stub({ claims: [{ instance: INSTANCE, n: 4, takenAt: old }] });
  await ops().ground_take!(ctx(s.db), { character: PC, instance: INSTANCE });
  assert.equal(s.takes[0]!.n, '5', 'claim 4 + 1');
  const recent = stub({ claims: [{ instance: INSTANCE, n: 1, takenAt: new Date(Date.parse(NOW) - 60_000).toISOString() }] });
  await assert.rejects(() => ops().ground_take!(ctx(recent.db), { character: PC, instance: INSTANCE }), status(409, 'taken'));
  assert.equal(recent.takes.length, 0);
});

test('ground_take reach: a pose at the item is checked, one beyond the radius is away (nothing written), no pose is unchecked and refused only when refuseUnchecked is on', async () => {
  const near = stub();
  await ops().ground_take!(ctx(near.db, poseAt(0.5)), { character: PC, instance: INSTANCE });
  assert.equal((near.takes[0]!.b[0] as { payload: { ground: { reach: string } } }).payload.ground.reach, 'checked');
  const far = stub();
  await assert.rejects(() => ops().ground_take!(ctx(far.db, poseAt(radiusOf(row) + 5)), { character: PC, instance: INSTANCE }), status(422, 'away'));
  assert.equal(far.takes.length, 0);
  await assert.rejects(() => ops({ refuseUnchecked: true }).ground_take!(ctx(stub().db), { character: PC, instance: INSTANCE }), status(422, 'unchecked'));
  const elsewhere = stub();
  await ops({ refuseUnchecked: true }).ground_take!(ctx(elsewhere.db, poseAt(0, 'exchange')), { character: PC, instance: INSTANCE }).then(() => assert.fail('a pose in another place is not checked'), status(422, 'unchecked'));
});

test('ground_take refusals write nothing: a bad body is a 400, an unknown instance too, a stale claim is a 503, the migration absent is a 503, off is a 503', async () => {
  const s = stub();
  await assert.rejects(() => ops().ground_take!(ctx(s.db), { character: 'nope', instance: INSTANCE }), BadRequest);
  await assert.rejects(() => ops().ground_take!(ctx(s.db), { character: PC, instance: 'ground:zone1.not-a-row' }), BadRequest);
  await assert.rejects(() => ops().ground_take!(ctx(s.db), { character: PC, instance: 'x' }), BadRequest);
  assert.equal(s.takes.length, 0);
  const stale = stub({ take: new DbError('stale', 'O0002') });
  await assert.rejects(() => ops().ground_take!(ctx(stale.db), { character: PC, instance: INSTANCE }), status(503, 'stale'));
  await assert.rejects(() => ops().ground_take!(ctx(stub({ absent: true }).db), { character: PC, instance: INSTANCE }), (e: unknown) => e instanceof Refused && e.status === 503);
  await assert.rejects(() => ops().ground_state!(ctx(stub({ absent: true }).db), {}), (e: unknown) => e instanceof Refused && e.status === 503);
  for (const name of ['ground_state', 'ground_take']) await assert.rejects(() => groundOps(null)[name]!(ctx(s.db), { character: PC, instance: INSTANCE }), status(503, 'off'));
});

test('the database refuses a take it already holds as taken: the writer returns the 409 and does not retry', async () => {
  const s = stub({ take: { refused: 'taken', availableAt: '2026-10-15T13:00:00Z' } });
  await assert.rejects(() => ops().ground_take!(ctx(s.db), { character: PC, instance: INSTANCE }), status(409, 'taken'));
  assert.equal(s.takes.length, 1);
});

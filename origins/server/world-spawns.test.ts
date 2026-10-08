import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PC } from '../contracts/fixtures.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import type { CareerRow, Json } from './store.ts';
import type { WhereFn } from '../presence/where.ts';
import { maxHit, minHits, minKillMs, withinReach, worldSpawnOps, zone1Spawns, type Spawn } from './world-spawns.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, spawns = zone1Spawns(content);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', TOKEN = 'T'.repeat(32);
const row = (): CareerRow => ({ seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 });
const wolf = [...spawns.values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;

// A stub database: answers each 202610080014 function from `answers` (by name), origins_open with an empty pack, origins_metal_of as absent; records the kill batch.
function stub(answers: Record<string, unknown>, opts: { absent?: boolean } = {}) {
  const kills: { m: string; r: string; b: Json[]; g: Json }[] = [];
  const db: Db = { async run(sql, v = {}) {
    if (/origins_spawn_/.test(sql) && opts.absent) return 'absent';
    const fn = /public\.(origins_spawn_\w+)\(/.exec(sql.split('\\if :spawns')[1] ?? '')?.[1];
    if (fn === 'origins_spawn_kill') { kills.push({ m: v.m!, r: v.r!, b: JSON.parse(v.b!), g: JSON.parse(v.g!) }); }
    if (fn) { const a = answers[fn]; if (a instanceof Error) throw a; return a === undefined ? 'null' : JSON.stringify(a); }
    if (/origins_metal_of/.test(sql)) return 'absent';
    return JSON.stringify({ marks: 0, career: row(), characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
  } };
  return { db, kills };
}
const ctx = (db: Db, where?: WhereFn) => ({ db, account: UID, ...(where ? { where } : {}) });
const open = { token: TOKEN, character: PC, instance: wolf?.spec.id, generation: 0, issuedAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-08T10:02:00Z' };
const status = (s: number, code: string) => (e: unknown) => e instanceof Refused && e.status === s && e.code === code;

test('the spawn list is the page\'s own mobSpecs ids, every one priced by the server (HP, fight, respawn)', () => {
  assert.ok(wolf, 'the Ash Wolf stands in Zone 1');
  assert.match(wolf.spec.id, /-\d+$/);
  for (const s of spawns.values()) { assert.ok(s.hp > 0); assert.ok(s.respawnS >= 10); assert.ok(s.fight.length > 0); }
});

test('the floors: hits >= ceil(HP / max hit); time-to-kill from the chained light cut; reach = roam + cut + slack', () => {
  assert.equal(minHits(90), Math.ceil(90 / maxHit()));
  assert.equal(minKillMs(1), 0, 'one blow kills at once');
  assert.ok(minKillMs(90) > 1000, 'a 90 HP wolf takes more than a second');
  assert.ok(minKillMs(220) > minKillMs(90));
  const spec = { home: { x: 0, z: 0 }, roam: 6 };
  assert.ok(withinReach(spec, { x: 9, z: 0 })); assert.ok(!withinReach(spec, { x: 20, z: 0 }));
});

test('off (ORIGINS_SPAWNS=0): every op answers 503 off; migration absent: 503', async () => {
  const ops = worldSpawnOps(null);
  for (const op of ['spawn_state', 'engage', 'touch', 'kill_report']) await assert.rejects(async () => ops[op]!(ctx(stub({}).db), {}), status(503, 'off'));
  const live = worldSpawnOps({ content, spawns });
  await assert.rejects(async () => live.spawn_state!(ctx(stub({}, { absent: true }).db), {}), (e: unknown) => e instanceof Refused && e.status === 503);
});

test('spawn_state: every spawn, never-engaged ones alive at generation 0, dead ones with their respawn time', async () => {
  const { db } = stub({ origins_spawn_state: { now: 'N', spawns: [{ instance: wolf.spec.id, kind: wolf.spec.character, alive: false, respawnAt: 'R', generation: 2 }] } });
  const out = await worldSpawnOps({ content, spawns }).spawn_state!(ctx(db), {}) as { now: string; spawns: { instance: string; alive: boolean; respawnAt: string | null; generation: number }[] };
  assert.equal(out.spawns.length, spawns.size);
  assert.deepEqual(out.spawns.find((s) => s.instance === wolf.spec.id), { instance: wolf.spec.id, kind: wolf.spec.character, level: wolf.spec.level, alive: false, respawnAt: 'R', generation: 2 });
  assert.ok(out.spawns.filter((s) => s.instance !== wolf.spec.id).every((s) => s.alive && s.generation === 0));
});

test('engage: the server names the kind, level and HP; unknown instances are refused; dead 409, too many 429', async () => {
  const ops = worldSpawnOps({ content, spawns });
  const out = await ops.engage!(ctx(stub({ origins_spawn_engage: { token: TOKEN, instance: wolf.spec.id, generation: 0, kind: wolf.spec.character, issuedAt: 'I', expiresAt: 'E' } }).db), { character: PC, instance: wolf.spec.id, level: 99, hp: 1 }) as Record<string, unknown>;
  assert.deepEqual(out, { token: TOKEN, instance: wolf.spec.id, generation: 0, kind: wolf.spec.character, level: wolf.spec.level, hp: wolf.hp, expiresAt: 'E' });
  await assert.rejects(async () => ops.engage!(ctx(stub({}).db), { character: PC, instance: 'nowhere-1' }), BadRequest);
  await assert.rejects(async () => ops.engage!(ctx(stub({ origins_spawn_engage: { refused: 'dead', respawnAt: 'R' } }).db), { character: PC, instance: wolf.spec.id }), status(409, 'dead'));
  await assert.rejects(async () => ops.engage!(ctx(stub({ origins_spawn_engage: { refused: 'too-many' } }).db), { character: PC, instance: wolf.spec.id }), status(429, 'too-many'));
});

test('kill_report: too few hits is refused before anything is written; a valid report sends the TTK floor, the respawn and ONE batch (event + rewards)', async () => {
  const ops = worldSpawnOps({ content, spawns, seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {} });
  const few = stub({ origins_spawn_engage_get: open });
  await assert.rejects(async () => ops.kill_report!(ctx(few.db), { token: TOKEN, hits: minHits(wolf.hp) - 1 }), status(422, 'too-few-hits'));
  assert.equal(few.kills.length, 0);
  const ok = stub({ origins_spawn_engage_get: open, origins_spawn_kill: { result: 'killed', instance: wolf.spec.id, respawnAt: 'R' } });
  const out = await ops.kill_report!(ctx(ok.db), { token: TOKEN, hits: 50, loot: [{ item: 'gold', quantity: 999 }], cp: 1e6 }) as Record<string, unknown>;
  assert.equal(out.result, 'killed'); assert.equal(out.beta, true); assert.equal(out.respawnAt, 'R');
  assert.equal(ok.kills.length, 1);
  const [k] = ok.kills;
  assert.equal(Number(k!.m), minKillMs(wolf.hp)); assert.equal(Number(k!.r), wolf.respawnS);
  assert.equal(k!.b[0]!.op, 'event'); assert.equal(k!.b[0]!.event_id, `enc:${TOKEN}`);
  assert.deepEqual((k!.b[0]!.payload as Json).beta, true);
  assert.ok(!JSON.stringify(k!.b).includes('999'), 'nothing in the body is paid');
  assert.deepEqual(k!.g, { cp: out.cp, reach: 'unchecked' }, 'the beta ledger row: the cp paid, reach unchecked with no presence pose');
});

test('kill_report: the database\'s refusals map to the contract (dead 409, too-fast 422, cap 429, used 409); reach via presence', async () => {
  const ops = worldSpawnOps({ content, spawns, log: () => {} });
  const with_ = (kill: unknown) => stub({ origins_spawn_engage_get: open, origins_spawn_kill: kill }).db;
  await assert.rejects(async () => ops.kill_report!(ctx(with_({ refused: 'dead', respawnAt: 'R' })), { token: TOKEN, hits: 50 }), status(409, 'dead'));
  await assert.rejects(async () => ops.kill_report!(ctx(with_({ refused: 'too-fast' })), { token: TOKEN, hits: 50 }), status(422, 'too-fast'));
  await assert.rejects(async () => ops.kill_report!(ctx(with_({ refused: 'cap' })), { token: TOKEN, hits: 50 }), status(429, 'cap'));
  await assert.rejects(async () => ops.kill_report!(ctx(with_(new DbError('O0009', 'gone'))), { token: TOKEN, hits: 50 }), status(409, 'used'));
  await assert.rejects(async () => ops.kill_report!(ctx(stub({ origins_spawn_engage_get: null }).db), { token: TOKEN, hits: 50 }), status(409, 'used'));
  const far = async () => ({ online: true as const, layer: 0, placed: true as const, x: (wolf.spec.home.x + 50) * 100, z: wolf.spec.home.z * 100, zone: wolf.spec.zone, ageMs: 100 });
  await assert.rejects(async () => ops.kill_report!(ctx(with_({ result: 'killed', instance: wolf.spec.id, respawnAt: 'R' }), far), { token: TOKEN, hits: 50 }), status(422, 'away'));
  const near = async () => ({ online: true as const, layer: 0, placed: true as const, x: wolf.spec.home.x * 100, z: wolf.spec.home.z * 100, zone: wolf.spec.zone, ageMs: 100 });
  const nearDb = stub({ origins_spawn_engage_get: open, origins_spawn_kill: { result: 'killed', instance: wolf.spec.id, respawnAt: 'R' } });
  assert.equal((await ops.kill_report!(ctx(nearDb.db, near), { token: TOKEN, hits: 50 }) as Json).result, 'killed');
  assert.equal(nearDb.kills[0]!.g.reach, 'checked', 'a fresh presence pose in the zone: reach checked');
});

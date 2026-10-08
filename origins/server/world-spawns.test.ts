import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCOUNT, PC } from '../contracts/fixtures.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { openInventory } from '../inventory/inventory.ts';
import type { CharacterInstanceId } from '../contracts/ids.ts';
import { mobBatch } from './mob-rewards.ts';
import { OPPONENTS, opponentAt } from '../../src/moves.ts';
import { createFighter, idleIntent, opponentFighter, stepDuel, type Duel } from '../combat/duel-open.ts';
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
const emptyPack = () => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: 20, bankSize: 10 }, lookupOf(content)); if (!inv.ok) throw new Error(JSON.stringify(inv.issues)); return inv.value; };
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

test('the floors are bounds from the Pit kit: at least one hit, monotone in health; reach = roam + cut + slack', () => {
  assert.ok(minHits(1) === 1 && minHits(90) >= 1, 'never below one hit');
  assert.equal(minHits(90), Math.max(1, Math.ceil(90 / maxHit())));
  assert.ok(minKillMs(1) >= 0 && minKillMs(5000) >= minKillMs(90), 'more health never lowers the time floor');
  const spec = { home: { x: 0, z: 0 }, roam: 6 };
  assert.ok(withinReach(spec, { x: 9, z: 0 })); assert.ok(!withinReach(spec, { x: 20, z: 0 }));
});

// The Auditor's pin (#1880): the duel Zone 1 actually runs (duel-open stepDuel, the hero's longsword against the creature's Pit level row) never kills faster, or in fewer landed blows,
// than the floors. The attacker's best case: a creature that never moves, guards or swings, and a hero who presses one attack every tick it is legal.
test('an honest Pit-kit kill of every Zone 1 kind at L1-3 clears both floors (duel-open, best case for the attacker)', () => {
  const kinds = [...new Set([...spawns.values()].map((s) => s.spec.body))];
  assert.ok(kinds.length > 0);
  for (const kind of kinds) for (const level of [1, 2, 3]) {
    const o = opponentAt((OPPONENTS as Record<string, Parameters<typeof opponentAt>[0]>)[kind]!, level);
    let fastest = Infinity;
    for (const action of ['light', 'heavy', 'thrust'] as const) {
      const hero = createFighter({ x: 0, z: -0.8, heading: 0, distance: 0 }, 'ready', 'longsword'), foe = opponentFighter(o, { x: 0, z: 0.8, heading: Math.PI, distance: 0 }, 'ready');
      let duel: Duel = { tick: 0, fighters: [hero, foe], finish: null, events: [] }, hits = 0;
      for (let t = 0; t < 60 * 120 && duel.finish === null && duel.fighters[1].health > 0; t++) {
        duel = stepDuel(duel, [{ ...idleIntent(), action }, idleIntent()]);
        hits += duel.events.filter((e) => e.actor === 0 && e.target === 1 && (e.type === 'Hit' || e.type === 'GuardBroken')).length;
      }
      if (duel.fighters[1].health > 0) continue;   // this attack alone never finished it (it can't be the fastest)
      const ms = duel.tick * 1000 / 60;
      assert.ok(ms >= minKillMs(o.health), `${kind} L${level} ${action}: killed in ${ms} ms, under the ${minKillMs(o.health)} ms floor`);
      assert.ok(hits >= minHits(o.health), `${kind} L${level} ${action}: ${hits} hits, under the ${minHits(o.health)} hit floor`);
      fastest = Math.min(fastest, ms);
    }
    assert.ok(Number.isFinite(fastest), `${kind} L${level}: no scripted attack killed it (the test proves nothing)`);
  }
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
  assert.deepEqual(k!.g, { reach: 'unchecked' }, 'the ledger input is the reach status only (cp is derived in SQL); unchecked with no presence pose');
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

test('kill_report prices the kill at the SPAWN\'s level (mobSpecs, by distance), not the form\'s: a level-1 spawn pays level-1 CP and loot, a level-2 spawn pays level-2 (Auditor, #1900; priced against level 2, not the form: the Zone 1 form level is 1 now)', async () => {
  const paidAt = async (level: number) => {
    const spawn: Spawn = { ...wolf, spec: { ...wolf.spec, level } };
    const ops = worldSpawnOps({ content, spawns: new Map([[wolf.spec.id, spawn]]), seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {} });
    const db = stub({ origins_spawn_engage_get: open, origins_spawn_kill: { result: 'killed', instance: wolf.spec.id, respawnAt: 'R' } });
    await ops.kill_report!(ctx(db.db), { token: TOKEN, hits: 50 });
    return db.kills[0]!.b;
  };
  const expect = (level: number) => mobBatch({ account: UID, character: PC, token: TOKEN, fight: wolf.fight, seed: 7, enemy: wolf.spec.body, level, twist: null }, { career: row(), inventory: emptyPack(), metal: 'absent' }, content, '2026-10-08T10:01:00.000Z', { level }).batch;
  const one = await paidAt(1), two = await paidAt(2);
  assert.deepEqual(one.slice(1), expect(1), 'level 1: exactly what mobBatch pays a level-1 kill');
  assert.deepEqual(two.slice(1), expect(2), 'level 2: exactly what mobBatch pays a level-2 kill');
  assert.notDeepEqual(one.slice(1), two.slice(1), 'and the two differ: the spawn\'s level prices the kill');
});

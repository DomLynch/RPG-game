// The writer side of a ROTATING camp (docs/specs/origins/dungeon-legend-rotation.md, #3620): the database's spawn kind is the camp's, the legend is resolved per generation (legendAt, the page's function) in spawn_state,
// engage and kill_report, and the ledger/settle keys (instance, generation) never see the legend. A camp is built here from three real Zone 1 spawns; the real-zone path is pinned by origins/server/world-marks-dungeon.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PC } from '../../src/core/server.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { legendAt } from '../dungeon/legend-at.ts';
import type { Db } from './db.ts';
import type { CareerRow, Json } from './store.ts';
import { CENTRE_CM } from '../presence/zones.ts';
import type { WhereFn } from '../presence/where.ts';
import { defaultZoneSpawns, minHits, spawnAt, worldSpawnOps, type Spawn } from './world-spawns.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, zone1 = defaultZoneSpawns(content);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', TOKEN = 'T'.repeat(32), ID = 'rot-camp-1';
const POOL = ['character:cinder-scavenger', 'character:ruin-ghoul', 'character:cinder-bear'];
const members = POOL.map((c) => [...zone1.values()].find((s) => s.spec.character === c)!);
const asCamp = (m: Spawn): Spawn => ({ ...m, spec: { ...m.spec, id: ID, spawn: 'rot-camp', pool: POOL } });
const camp: Spawn = { ...asCamp(members[0]!), pool: new Map(POOL.map((c, i) => [c, asCamp(members[i]!)] as const)), poolKind: 'pool:rot-camp' };
const spawns = new Map<string, Spawn>([[ID, camp]]);
const at = (g: number): Spawn => members[POOL.indexOf(legendAt(POOL, ID, g))]!;

const row = (): CareerRow => ({ seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 });
// A stub database like world-spawns.test.ts's: answers each origins_spawn_* function by name and records every variable it was sent (the kind) and the kill batch.
function stub(answers: Record<string, unknown>) {
  const sent: string[] = [], kills: { b: Json[] }[] = [];
  const db: Db = { async run(sql, v = {}) {
    sent.push(...Object.values(v));
    const fn = /public\.(origins_spawn_\w+)\(/.exec(sql.split('\\if :spawns')[1] ?? sql)?.[1];
    if (fn === 'origins_spawn_kill') kills.push({ b: JSON.parse(v.b!) });
    if (fn) { const a = answers[fn]; return a === undefined ? 'null' : JSON.stringify(a); }
    if (/origins_account_is_test/.test(sql)) return 'false';
    if (/origins_metal_of/.test(sql)) return 'absent';
    return JSON.stringify({ marks: 0, career: row(), characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
  } };
  return { db, sent, kills };
}
const pose = (s: Spawn): WhereFn => async () => ({ online: true as const, layer: 0, placed: true as const, x: CENTRE_CM + s.spec.home.x * 100, z: CENTRE_CM + s.spec.home.z * 100, zone: s.spec.zone, ageMs: 100 });
const ctx = (db: Db) => ({ db, account: UID, where: pose(camp) });

test('the pool has three different legends: different character, level or health', () => {
  assert.equal(new Set(members.map((m) => m.spec.character)).size, 3);
  assert.equal(new Set(members.map((m) => `${m.spec.level}:${m.hp}`)).size, 3, 'a test of rotation needs legends that differ');
});

test('spawnAt: a plain spawn is itself in every generation; a rotating camp is legendAt(pool, id, generation), never twice running', () => {
  for (const g of [0, 1, 7]) assert.equal(spawnAt(members[0]!, g), members[0]);
  for (let g = 0; g < 9; g++) {
    assert.equal(spawnAt(camp, g).spec.character, legendAt(POOL, ID, g));
    assert.notEqual(spawnAt(camp, g).spec.character, spawnAt(camp, g + 1).spec.character);
  }
});

test('spawn_state reports the legend of the generation the database reports, with its level', async () => {
  const ops = worldSpawnOps({ content, spawns });
  for (const g of [0, 1, 2, 3]) {
    const { db } = stub({ origins_spawn_state: { now: 'N', spawns: [{ instance: ID, kind: 'pool:rot-camp', alive: true, respawnAt: null, generation: g }] } });
    const out = await ops.spawn_state!(ctx(db), {}) as { spawns: { instance: string; kind: string; level: number; generation: number }[] };
    assert.deepEqual(out.spawns, [{ instance: ID, kind: at(g).spec.character, level: at(g).spec.level, alive: true, respawnAt: null, generation: g }]);
  }
});

test('engage sends the DATABASE the camp\'s stable kind (never a legend: the table refuses a changed kind) and answers the legend of the issued generation', async () => {
  const ops = worldSpawnOps({ content, spawns });
  for (const g of [0, 1, 2]) {
    const s = stub({ origins_spawn_engage: { token: TOKEN, instance: ID, generation: g, kind: 'pool:rot-camp', issuedAt: 'I', expiresAt: 'E' } });
    const out = await ops.engage!(ctx(s.db), { character: PC, instance: ID }) as Record<string, unknown>;
    assert.deepEqual(out, { token: TOKEN, instance: ID, zoneId: '1', generation: g, kind: at(g).spec.character, level: at(g).spec.level, hp: at(g).hp, expiresAt: 'E' });
    assert.ok(s.sent.includes('pool:rot-camp'), 'the camp\'s kind went to the database');
    assert.ok(POOL.every((c) => !s.sent.includes(c)), 'no legend id went as the kind');
  }
});

test('kill_report prices the legend of the token\'s generation: the hit floor and the TTK floor follow ITS health, and the event names its fight', async () => {
  const ops = worldSpawnOps({ content, spawns, seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {} });
  for (const g of [0, 1, 2]) {
    const m = at(g), open = { token: TOKEN, character: PC, instance: ID, generation: g, issuedAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-08T10:02:00Z' };
    const few = stub({ origins_spawn_engage_get: open });
    if (minHits(m.hp) > 1) await assert.rejects(async () => ops.kill_report!(ctx(few.db), { token: TOKEN, hits: minHits(m.hp) - 1 }), (e: unknown) => (e as { code?: string }).code === 'too-few-hits');
    const ok = stub({ origins_spawn_engage_get: open, origins_spawn_kill: { result: 'killed', instance: ID, respawnAt: 'R' } });
    const out = await ops.kill_report!(ctx(ok.db), { token: TOKEN, hits: 50 }) as Record<string, unknown>;
    assert.equal(out.result, 'killed');
    assert.equal((ok.kills[0]!.b[0]!.payload as Record<string, unknown>).fight, m.fight, `generation ${g}: the event names the legend's fight`);
    assert.equal((ok.kills[0]!.b[0]!.payload as Record<string, unknown>).generation, g, 'the ledger key still carries the generation');
  }
});

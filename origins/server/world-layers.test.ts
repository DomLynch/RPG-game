import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { PC } from '../../src/core/server.ts';
import { worldSpawnOps, defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import type { Where } from '../presence/where.ts';
import type { CareerRow } from './store.ts';
import type { Db } from './db.ts';
import { Refused } from './errors.ts';

// Per-layer spawn clocks at the writer (spawnLayers on): which function is asked, with which layer, and what a layer change or a missing presence does. A fake database; the real functions are proven on a
// disposable cluster by scripts/origins-spawns-check.mjs and scripts/origins-damage-share-check.mjs.
const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const content = loaded.value;
const base = [...defaultZoneSpawns(content).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };
const spawns = new Map([[wolf.spec.id, wolf]]);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', TOKEN = 'T'.repeat(32);
const row = (): CareerRow => ({ seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 });

type Call = { fn: string; vars: Record<string, string> };
function stub(opts: { tokenLayer?: number; layersAbsent?: boolean; refused?: string } = {}): { calls: Call[]; db: Db } {
  const calls: Call[] = [];
  const db = { async run(sql: string, v: Record<string, string> = {}) {
    const call = sql.includes('\\if :') ? sql.slice(sql.indexOf('\\if :')) : sql;
    const fn = /public\.(origins_[a-z0-9_]+)\(/.exec(call)?.[1] ?? '';
    if (/spawn_state|spawn_engage|spawn_check|spawn_damage_read|spawn_kill/.test(fn)) calls.push({ fn, vars: v });
    if (opts.layersAbsent && /_layer$/.test(fn)) return 'absent';
    if (fn === 'origins_spawn_state' || fn === 'origins_spawn_state_layer') return JSON.stringify({ now: 'N', spawns: [] });
    if (fn === 'origins_spawn_engage' || fn === 'origins_spawn_engage_layer') return JSON.stringify({ token: TOKEN, instance: wolf.spec.id, generation: 0, expiresAt: 'E' });
    if (fn === 'origins_spawn_engage_get') return JSON.stringify({ token: TOKEN, character: PC, instance: wolf.spec.id, ...(opts.tokenLayer === undefined ? {} : { layer: opts.tokenLayer }), generation: 0, issuedAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-08T10:02:00Z' });
    if (fn === 'origins_spawn_check_layer' || fn === 'origins_spawn_check') return JSON.stringify(opts.refused ? { refused: opts.refused } : { ok: true, mode: 'first', instance: wolf.spec.id, generation: 0 });
    if (fn === 'origins_spawn_damage_read_layer' || fn === 'origins_spawn_damage_read') return '[]';
    if (fn === 'origins_spawn_kill_v2' || fn === 'origins_spawn_kill') return JSON.stringify(opts.refused ? { refused: opts.refused } : { result: 'killed', instance: wolf.spec.id, respawnAt: 'R' });
    if (/origins_metal_of/.test(sql)) return 'absent';
    return JSON.stringify({ marks: 0, career: row(), characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
  } } as Db;
  return { calls, db };
}
const standing = (layer: number): (() => Promise<Where>) => async () => ({ online: true, layer, placed: false });
const ops = (extra: object = {}) => worldSpawnOps({ content, spawns, seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {}, ...extra });
const ctx = (db: Db, where?: () => Promise<Where>) => ({ db, account: UID, ...(where ? { where } : {}) });
const last = (s: { calls: Call[] }, fn: string): Call | undefined => s.calls.findLast((c) => c.fn === fn);

test('spawnLayers off: spawn_state and engage ask the layer-less functions, whatever presence says', async () => {
  const s = stub(), o = ops();
  await o.spawn_state!(ctx(s.db, standing(3)), {});
  await o.engage!(ctx(s.db, standing(3)), { character: PC, instance: wolf.spec.id });
  assert.deepEqual(s.calls.map((c) => c.fn), ['origins_spawn_state', 'origins_spawn_engage']);
});

test('spawnLayers on: spawn_state and engage ask presence where the account stands and use THAT layer; the body never names one', async () => {
  const s = stub(), o = ops({ spawnLayers: true });
  await o.spawn_state!(ctx(s.db, standing(3)), { layer: 9 });
  await o.engage!(ctx(s.db, standing(3)), { character: PC, instance: wolf.spec.id, layer: 9 });
  assert.equal(last(s, 'origins_spawn_state_layer')?.vars.l, '3');
  assert.equal(last(s, 'origins_spawn_engage_layer')?.vars.l, '3');
});

test('spawnLayers on, presence unreachable, offline or absent: layer 1, today\'s single pool (an outage never stops a kill)', async () => {
  for (const where of [async (): Promise<Where> => { throw new Error('presence down'); }, async (): Promise<Where> => ({ online: false }), undefined]) {
    const s = stub(); await ops({ spawnLayers: true }).engage!(ctx(s.db, where), { character: PC, instance: wolf.spec.id });
    assert.equal(last(s, 'origins_spawn_engage_layer')?.vars.l, '1');
  }
});

test('spawnLayers on but the migration not applied: the layer-less function answers (layer 1 behaviour), nothing breaks', async () => {
  const s = stub({ layersAbsent: true }), o = ops({ spawnLayers: true });
  await o.spawn_state!(ctx(s.db, standing(2)), {});
  const got = await o.engage!(ctx(s.db, standing(2)), { character: PC, instance: wolf.spec.id }) as { token: string };
  assert.equal(got.token, TOKEN);
  assert.ok(s.calls.some((c) => c.fn === 'origins_spawn_engage') && s.calls.some((c) => c.fn === 'origins_spawn_state'));
});

test('kill_report: presence now says another layer than the token\'s: 409 moved, nothing written, no check, the token stays open', async () => {
  const s = stub({ tokenLayer: 2 });
  await assert.rejects(() => Promise.resolve(ops({ spawnLayers: true }).kill_report!(ctx(s.db, standing(4)), { token: TOKEN, hits: 50 })), (e: unknown) => e instanceof Refused && e.status === 409 && e.code === 'moved');
  assert.deepEqual(s.calls.map((c) => c.fn), ['origins_spawn_engage_get']);
});

test('kill_report: the same layer pays through the ordinary kill (the database reads the token\'s layer); presence unable to answer pays on the token\'s own layer', async () => {
  for (const where of [standing(2), async (): Promise<Where> => { throw new Error('presence down'); }]) {
    const s = stub({ tokenLayer: 2 });
    const got = await ops({ spawnLayers: true }).kill_report!(ctx(s.db, where), { token: TOKEN, hits: 50 }) as { result: string };
    assert.equal(got.result, 'killed');
    assert.ok(s.calls.some((c) => c.fn === 'origins_spawn_kill'));
  }
});

test('kill_report with kill credit by damage: the layer-aware check carries the respawn window (the cross-layer cooldown) and the damage ledger is read for THIS layer', async () => {
  const s = stub({ tokenLayer: 2 });
  await ops({ spawnLayers: true, damageShare: true, verifyRecord: async () => ({ ok: true, ticks: 1, damage: wolf.hp }) }).kill_report!(ctx(s.db, standing(2)), { token: TOKEN, hits: 50, record: 'r' });
  assert.equal(last(s, 'origins_spawn_check_layer')?.vars.r, String(wolf.respawnS));
  assert.equal(last(s, 'origins_spawn_damage_read_layer')?.vars.l, '2');
});

test('a cooldown refusal (killed in another layer inside the respawn window) is a 422 that writes nothing', async () => {
  const s = stub({ tokenLayer: 2, refused: 'cooldown' });
  await assert.rejects(() => Promise.resolve(ops({ spawnLayers: true, damageShare: true }).kill_report!(ctx(s.db, standing(2)), { token: TOKEN, hits: 50 })), (e: unknown) => e instanceof Refused && e.status === 422 && e.code === 'cooldown');
  assert.ok(!s.calls.some((c) => /spawn_kill/.test(c.fn)));
});

test('a token from before the migration (no layer) is never refused moved, even with the flag on', async () => {
  const s = stub();
  const got = await ops({ spawnLayers: true }).kill_report!(ctx(s.db, standing(5)), { token: TOKEN, hits: 50 }) as { result: string };
  assert.equal(got.result, 'killed');
});

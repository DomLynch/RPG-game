// Sheet in the world, PR 3 (World): each bout's damage roll is seeded by hash32(the creature's engage token, its join step). The page mints the seed at the join, the record carries it, the replay re-derives duel.roll
// from it, and the server accepts it only when it equals hash32(the kill's own engage token, the join step). No token = no seed = no roll: today's fight.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWorldRecord, hash32, replayWorldRecord, type WorldRecord } from '../../src/fight/server.ts';
import { createWorldCombat as live } from '../../src/fight/world-combat.ts';
import { creature, player } from '../../src/fight/world.ts';
import { openBout } from '../../src/fight/open-fight.ts';
import { verifyWorldRecord } from './world-verify.ts';
import { defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';

const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const base = [...defaultZoneSpawns(loaded.value).values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };
const TOKEN = 'T'.repeat(32);

async function fight(token: string | null): Promise<WorldRecord> {
  const fell: string[] = []; let rec: WorldRecord | null = null;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {}, ...(token ? { engageToken: () => token } : {}) });
  const hero = { x: at.x, z: at.z - 1.2, facing: 0 };
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((q) => q.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); } }
  assert.ok(rec, 'the scripted hero kills the wolf');
  return rec!;
}
const verify = async (r: WorldRecord, token?: string) => verifyWorldRecord(await encodeWorldRecord(r), { spec: wolf.spec }, 'wolf', null, 20_000, token);

test('openBout seeds the duel roll from the creature\'s seed; no seed, no roll (today\'s bout)', () => {
  const hero = player('me', 0, 0, 0), plain = creature('c', 'wolf', 2, 0, 0, 1);
  assert.equal(openBout(hero, plain).duel.roll, undefined, 'band off: no roll');
  assert.deepEqual(openBout(hero, { ...plain, seed: 12345 }).duel.roll, { seed: 12345, hits: 0 });
});

test('a live fight with an engage token writes hash32(token, join step) on the join, and the replay re-derives the same fight (verified)', async () => {
  const rec = await fight(TOKEN), j = rec.joins.find((e) => e.id === wolf.spec.id)!;
  assert.equal(j.seed, hash32(TOKEN, j.s), 'the seed is hash32(the kill\'s token, the join step)');
  assert.deepEqual(await verify(rec, TOKEN), { ok: true, ticks: rec.steps.length }, 'the replay (duel.roll from the header seed) reproduces the kill');
  const killAt = (r: WorldRecord): number | undefined => { const x = replayWorldRecord(r); return x.ok ? x.killStep[wolf.spec.id] : undefined; };
  const at = killAt(rec); assert.ok(at !== undefined && at < rec.steps.length, 'the replay kills the wolf inside the record');
  assert.equal(killAt(rec), at, 'the replay is deterministic: same token and join step, same fight');
  const withSeed = (seed: number | undefined): WorldRecord => ({ ...rec, joins: rec.joins.map(({ seed: _s, ...e }) => (seed === undefined ? e : { ...e, seed })) });
  const bandOff = killAt(withSeed(undefined));
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8].some((k) => killAt(withSeed(k)) !== bandOff), 'a seed turns the roll band on in the replay: some seed kills on another step than the band-off fight');
});

test('a forged seed, a wrong token and a seed with no token are refused; a record with no seed is today\'s fight and still verifies', async () => {
  const rec = await fight(TOKEN), forged: WorldRecord = { ...rec, joins: rec.joins.map((e) => ({ ...e, seed: ((e.seed ?? 0) + 1) >>> 0 })) };
  assert.deepEqual(await verify(forged, TOKEN), { ok: false, reason: 'seed' }, 'forged seed');
  assert.deepEqual(await verify(rec, 'X'.repeat(32)), { ok: false, reason: 'seed' }, 'another creature\'s token');
  assert.deepEqual(await verify(rec), { ok: false, reason: 'seed' }, 'a seed but no token to check it against');
  const none = await fight(null);
  assert.equal(none.joins[0]!.seed, undefined);
  assert.deepEqual(await verify(none, TOKEN), { ok: true, ticks: none.steps.length }, 'band off: the same record shape as today');
});

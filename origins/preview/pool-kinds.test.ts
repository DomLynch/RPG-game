// Dungeon 1's rotating camps (zone 7): every body a camp's pool can ever show is in the zone's warm kinds, not only the generation-0 bodies the specs carry now. Else the first rotated-in legend of a family no camp shows at load
// would link its programs at the engage (the late-program hitch of #3633, from the pool side). Pure: zoneKinds (mob-looks.ts) is what the page's zone-ready warm list is built from.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frontierBuild, frontierPlan } from './frontier-plan.ts';
import { mobSpecs } from './mobs.ts';
import { bodyKeyOf, mobLook, zoneKinds } from './mob-looks.ts';
import { listedZone } from '../zones/listed.ts';

const ZONE = listedZone('7'), f = frontierPlan(false, '7'), specs = mobSpecs(f, frontierBuild(f), ZONE.spawns.rows);
const lookOf = (id: string) => mobLook(id, ZONE);

test('zone 7 has rotating camps, and the warm kinds hold the body key of every legend in every camp\'s pool', () => {
  const pooled = specs.filter((s) => s.pool?.length);
  assert.ok(pooled.length > 0, 'zone 7 has rotating camps');
  const { keys } = zoneKinds(specs, lookOf);
  for (const s of pooled) for (const character of s.pool!) {
    const look = lookOf(character), key = bodyKeyOf(look?.opponent ?? s.body, look);
    assert.ok(keys.includes(key), `${s.id}: pool legend ${character} wears ${key}, which the warm kinds lack`);
  }
});

test('the warm kinds are wider than what the specs show now (the mutation: without the pool keys a later generation\'s body would be cold)', () => {
  const { keys, pool } = zoneKinds(specs, lookOf), own = new Set(specs.map((s) => bodyKeyOf(s.body, lookOf(s.character))));
  assert.deepEqual(keys.filter((k) => own.has(k)), [...own], 'every spec\'s own key stays, first');
  for (const k of pool.keys()) assert.ok(!own.has(k) && keys.includes(k), `${k} is a pool-only key in the kinds`);
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  assert.deepEqual(zoneKinds(specs.map((s) => ({ ...s, pool: undefined })), lookOf).keys, [...own], 'a camp with no pool adds nothing');
});

test('a camp with no pool (Zone 1, every static zone) keeps exactly its own keys', () => {
  const f1 = frontierPlan(false, '1'), s1 = mobSpecs(f1, frontierBuild(f1), listedZone('1').spawns.rows);
  const z1 = listedZone('1'), { keys, pool } = zoneKinds(s1, (id) => mobLook(id, z1));
  assert.equal(pool.size, 0);
  assert.deepEqual(keys, [...new Set(s1.map((s) => bodyKeyOf(s.body, mobLook(s.character, z1))))]);
});

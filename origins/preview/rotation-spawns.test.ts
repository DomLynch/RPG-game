// A rotating spawn group (`rotation: "cycle"`, docs/specs/origins/dungeon-legend-rotation.md, #3620): its characters are a POOL, the camp shows the pool's legend for each respawn generation, and every body the pool
// can show counts for the zone (the warm list and the world budget). Fixture: Zone 1's scavengers group made a rotating pool of three of its own rows, restored afterwards.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frontierBuild, frontierPlan, FRONTIER } from './frontier-plan.ts';
import { mobSpecs, poolBodies, regionBodies, zoneBodies } from './mobs.ts';
import { loadZone, zoneProblems } from '../zones/loader.ts';
import { spawnProblems, type SpawnGroup } from '../zones/place.ts';
import { legendAt } from '../dungeon/legend-at.ts';

const POOL = ['character:cinder-scavenger', 'character:ruin-ghoul', 'character:cinder-bear'];
const g = (characters: SpawnGroup['characters'], rotation?: SpawnGroup['rotation']): SpawnGroup => ({ id: 'g', at: 'x', characters, ...(rotation === undefined ? {} : { rotation }) });

test('the rotation rules: a known rule, a non-empty pool, bare ids only (a weight or a max means nothing to a cycle)', () => {
  assert.deepEqual(spawnProblems(g(POOL, 'cycle'), 4), []);
  assert.deepEqual(spawnProblems(g(['character:a'], 'cycle'), 1), [], 'a pool of one is allowed (a camp that never changes)');
  assert.match(spawnProblems(g(POOL, 'shuffle' as never), 4).join('|'), /rotation "shuffle" is not one of cycle/);
  assert.match(spawnProblems(g([], 'cycle'), 4).join('|'), /needs a pool of characters/);
  assert.match(spawnProblems(g([{ id: 'character:a', weight: 2 }, 'character:b'], 'cycle'), 4).join('|'), /lists bare ids \(character:a carries a weight or a max\)/);
  assert.deepEqual(spawnProblems(g(['character:a', { id: 'character:b', weight: 2 }]), 4), [], 'without rotation a weighted group is as it was');
});

test('the loader refuses a rotating group whose pool names a character with no spawn row (a pool never skips a generation)', () => {
  const z = loadZone(), bad = JSON.parse(JSON.stringify(z)) as typeof z;
  const grp = bad.place!.spawns.find((s) => s.id === 'scavengers')!;
  grp.characters = [...POOL, 'character:no-such-row']; grp.rotation = 'cycle';
  assert.match(zoneProblems(bad).join('|'), /group scavengers: pool character character:no-such-row has no spawn row/);
  grp.characters = POOL;
  assert.deepEqual(zoneProblems(bad).filter((p) => p.startsWith('group ')), [], 'a pool of real rows is valid');
});

test('a rotating camp stands as generation 0 of its pool, carries the pool and every pool body, and moves nothing else', () => {
  const f = frontierPlan(), b = frontierBuild(f), grp = loadZone().place!.spawns.find((s) => s.id === 'scavengers')!, original = grp.characters;
  const reg = f.data.registry.regions.get(FRONTIER)!;
  const withPool = { ...f, data: { ...f.data, registry: { ...f.data.registry, regions: new Map([[FRONTIER, { ...reg, spawns: reg.spawns.map((s) => (s.id === 'scavengers' ? { ...s, characters: POOL } : s)) }]]) } } } as unknown as typeof f;
  const before = mobSpecs(f, b);
  try {
    grp.characters = POOL; grp.rotation = 'cycle';
    const specs = mobSpecs(withPool, b), camp = specs.filter((s) => s.spawn === 'scavengers');
    assert.equal(camp.length, before.filter((s) => s.spawn === 'scavengers').length, 'the camp size comes from the first pool character\'s row');
    for (const s of camp) {
      assert.deepEqual(s.pool, POOL);
      assert.equal(s.character, legendAt(POOL, s.id, 0), `${s.id} stands as generation 0 of the pool`);
      assert.ok(s.poolBodies!.includes(s.body));
    }
    assert.ok(new Set(camp.map((s) => s.character)).size > 1 || camp.length === 1, 'camp members start on different pool entries (their ids hash apart)');
    const stand = (xs: typeof specs) => xs.filter((s) => s.spawn !== 'scavengers').map(({ level: _level, ...rest }) => rest);   // a level follows the distance from the hero's start, which the scavenger camp's own spread can move (as for a weighted camp)
    assert.deepEqual(stand(specs), stand(before), 'other groups stand where they stood');
    assert.deepEqual(mobSpecs(withPool, b), specs, 'deterministic');
    const bodies = poolBodies(POOL.map((c) => f.data.registry.characters.get(c as never)!.encounterForms.find((x) => x.id === 'mob')!.opponent ?? 'goblin'));
    for (const body of bodies) {
      assert.ok(zoneBodies(specs)[camp[0]!.zone]!.includes(body), `${body}: a pool body the zone's warm list and budget must count`);
      assert.ok(regionBodies(specs).includes(body), `${body}: and the region's`);
    }
  } finally { grp.characters = original; delete grp.rotation; }
});

test('a camp that does not rotate has no pool on its spec', () => {
  const f = frontierPlan();
  for (const s of mobSpecs(f, frontierBuild(f))) assert.ok(s.pool === undefined && s.poolBodies === undefined, s.id);
});

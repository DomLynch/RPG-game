// Weighted spawn entries (docs/specs/origins/weighted-spawns.md; donor EQEmu spawnentry.chance / spawn_limit, shape only): the roll, its rules, the loader checks, and the
// golden that every plain group (a single bare id, every row today) stands exactly where it did.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { frontierBuild, frontierPlan, FRONTIER } from './frontier-plan.ts';
import { mobSpecs } from './mobs.ts';
import { loadZone, zoneProblems } from '../zones/loader.ts';
import { listedZone, listedZoneIds } from '../zones/listed.ts';
import { entryOf, isPlainGroup, rollCamp, spawnIds, spawnProblems, type SpawnGroup } from '../zones/place.ts';
import { prng } from '../world/generate.ts';

const digest = (id: string): [number, string] => {
  const f = frontierPlan(false, id), specs = mobSpecs(f, frontierBuild(f), listedZone(id).spawns.rows);
  return [specs.length, createHash('sha256').update(JSON.stringify(specs)).digest('hex').slice(0, 16)];
};

test('plain groups are untouched: zones 2-4 are byte for byte what they were before weighted entries (digests taken on the code before it); zone 1 was 12d8a3ce... and differs by exactly one creature, brood-4 (the black-mere salamander roll: mobs.golden.json pins every entry)', () => {
  assert.deepEqual(listedZoneIds().map((id) => [id, ...digest(id)]), [['1', 23, '17c2bb3729c29d2f'], ['2', 10, '2423b405e7cc588c'], ['3', 1, 'd4a1ff259bba0d8a'], ['4', 1, 'ce4afb8cd6a5b785']]);
});

test('a bare id is weight 1 and a single bare id is a plain group; an object entry or two entries is weighted', () => {
  assert.deepEqual(entryOf('character:a'), { id: 'character:a', weight: 1 });
  assert.deepEqual(entryOf({ id: 'character:a', weight: 6, max: 2 }), { id: 'character:a', weight: 6, max: 2 });
  assert.ok(isPlainGroup({ characters: ['character:a'] }) && isPlainGroup({ characters: [] }));
  assert.ok(!isPlainGroup({ characters: [{ id: 'character:a', weight: 1 }] }) && !isPlainGroup({ characters: ['character:a', 'character:b'] }));
  assert.deepEqual(spawnIds({ characters: ['character:a', { id: 'character:b', weight: 2 }, 'character:a'] }), ['character:a', 'character:b']);
});

const count = (ids: string[]) => ids.reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {});

test('the roll follows the weights: over many seeds each entry lands in proportion (6:2 = 75% / 25%), and a slot\'s draw is its own', () => {
  const entries = [{ id: 'g', weight: 6 }, { id: 's', weight: 2 }];
  let total: Record<string, number> = {}, slots = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    const rand = prng(seed), draws = [rand(), rand(), rand()], ids = rollCamp(entries, 3, (i) => draws[i]!);
    assert.equal(ids.length, 3);
    total = count([...Object.entries(total).flatMap(([k, n]) => Array<string>(n).fill(k)), ...ids]); slots += 3;
  }
  assert.ok(Math.abs(total.s! / slots - 0.25) < 0.02, `salamander share ${(total.s! / slots).toFixed(3)} is not near 0.25`);
  assert.deepEqual(rollCamp(entries, 3, () => 0), ['g', 'g', 'g'], 'a draw of 0 is the first entry');
  assert.deepEqual(rollCamp(entries, 3, () => 0.999), ['s', 's', 's'], 'a draw near 1 is the last');
});

test('max caps one id per camp (EQEmu spawn_limit): a rare is at most `max` in a camp, however the draws fall', () => {
  const entries = [{ id: 'g', weight: 1 }, { id: 's', weight: 100, max: 1 }];
  for (let seed = 1; seed <= 500; seed++) {
    const rand = prng(seed), draws = Array.from({ length: 5 }, () => rand()), ids = rollCamp(entries, 5, (i) => draws[i]!);
    assert.equal(ids.length, 5);
    assert.ok((count(ids).s ?? 0) <= 1, `seed ${seed}: ${ids.join(',')}`);
  }
  assert.deepEqual(rollCamp([{ id: 's', weight: 1, max: 1 }], 3, () => 0), ['s'], 'all entries at max: a short camp, never a hang');
});

test('the entry rules: weights are numbers > 0, max whole >= 1, no id twice, and the camp can always be filled', () => {
  const g = (characters: SpawnGroup['characters']): SpawnGroup => ({ id: 'g', at: 'x', characters });
  const ok = (characters: SpawnGroup['characters'], campMax = 4) => spawnProblems(g(characters), campMax).join('|');
  assert.equal(ok(['character:a', { id: 'character:b', weight: 2, max: 1 }]), '');
  assert.match(ok([{ id: 'character:a', weight: 0 }]), /weight 0 is not a number > 0/);
  assert.match(ok([{ id: 'character:a', weight: -1 }]), /weight -1/);
  assert.match(ok([{ id: 'character:a', weight: Number.NaN }]), /weight NaN/);
  assert.match(ok([{ id: 'character:a', weight: 1, max: 0 }]), /max 0 is not a whole number >= 1/);
  assert.match(ok([{ id: 'character:a', weight: 1, max: 1.5 }]), /max 1.5/);
  assert.match(ok(['character:a', 'character:a']), /listed twice/);
  assert.match(ok([{ id: 'character:a', weight: 1, max: 1 }, { id: 'character:b', weight: 1, max: 2 }]), /every entry has a max below the camp size 4/);
  assert.equal(ok([{ id: 'character:a', weight: 1, max: 1 }, { id: 'character:b', weight: 1, max: 2 }], 2), '', 'a max >= the camp size fills it');
});

test('the loader holds a zone\'s weighted group to those rules (the ids themselves are the registry\'s check, as before)', () => {
  const z = loadZone(), clone = () => JSON.parse(JSON.stringify(z)) as typeof z;
  assert.deepEqual(zoneProblems(z).filter((p) => p.startsWith('group ')), [], 'Zone 1\'s groups are valid');
  const bad = clone(); bad.place!.spawns[0]!.characters = [{ id: 'character:cinder-scavenger', weight: 0 }];
  assert.match(zoneProblems(bad).join('|'), /group scavengers: character:cinder-scavenger weight 0/);
  const capped = clone(); capped.place!.spawns[0]!.characters = [{ id: 'character:cinder-scavenger', weight: 1, max: 1 }];
  assert.match(zoneProblems(capped).join('|'), /group scavengers: every entry has a max below the camp size 4/, 'the scavenger camp is up to 4, so a lone entry capped at 1 can never fill it');
});

test('a weighted camp stands from the group\'s own stream: one entry with a weight is the plain camp, and a second entry mixes the kinds by weight inside the same camp size', () => {
  const f = frontierPlan(), b = frontierBuild(f), place = loadZone().place!, g = place.spawns.find((s) => s.id === 'scavengers')!, original = g.characters;   // a plain one-id group (the brood group is a real weighted one now)
  const base = mobSpecs(f, b).filter((s) => s.spawn === 'scavengers');
  const reg = f.data.registry.regions.get(FRONTIER)!, withIds = (ids: string[]) => ({ ...f, data: { ...f.data, registry: { ...f.data.registry, regions: new Map([[FRONTIER, { ...reg, spawns: reg.spawns.map((s) => (s.id === 'scavengers' ? { ...s, characters: ids } : s)) }]]) } } }) as unknown as typeof f;
  try {
    g.characters = [{ id: 'character:cinder-scavenger', weight: 5 }];
    assert.deepEqual(mobSpecs(f, b).filter((s) => s.spawn === 'scavengers'), base, 'one weighted entry = the plain camp');
    g.characters = [{ id: 'character:cinder-scavenger', weight: 1 }, { id: 'character:ruin-ghoul', weight: 1, max: 1 }];
    const mixed = mobSpecs(withIds(['character:cinder-scavenger', 'character:ruin-ghoul']), b).filter((s) => s.spawn === 'scavengers');
    assert.equal(mixed.length, base.length, 'the camp size comes from the first entry\'s row, whatever is rolled');
    assert.ok(mixed.filter((s) => s.character === 'character:ruin-ghoul').length <= 1, 'max 1 holds in a built camp');
    assert.ok(mixed.some((s) => s.character === 'character:cinder-scavenger'), 'and the scavengers still stand');
    assert.deepEqual(mixed, mobSpecs(withIds(['character:cinder-scavenger', 'character:ruin-ghoul']), b).filter((s) => s.spawn === 'scavengers'), 'deterministic');
    assert.deepEqual(mobSpecs(f, b).filter((s) => s.spawn !== 'scavengers'), mobSpecs(withIds(['character:cinder-scavenger', 'character:ruin-ghoul']), b).filter((s) => s.spawn !== 'scavengers'), 'other groups do not move');
  } finally { g.characters = original; }
});

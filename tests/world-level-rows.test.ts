// World level rows (Combat, RV89; Lead's ruling: the Zone 1 goblin fix leaves the Pit byte for byte alone). The open world's creature body is worldOpponentAt (moves.ts); the Pit keeps opponentAt. A world level row
// (src/fight/world-level-defs.json) changes ONLY the (opponent, level) it names; with no row worldOpponentAt returns the Pit's own body object. tests/level-anchor-rows.test.ts already pins the hash of opponentAt for every
// opponent at every level, so a Pit body that moved fails there; this file pins the other half: the world differs from the Pit at exactly the named rows.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, OPPONENTS, opponentAt, worldOpponentAt } from '../src/fight/moves.ts';
import { worldLevelHealth } from '../src/fight/world-level-rows.ts';
import WORLD_LEVEL_DEFS from '../src/fight/world-level-defs.json' with { type: 'json' };

const ROWS = WORLD_LEVEL_DEFS.worldLevels;

test('with no world level row, the world body IS the Pit body: the same object, every opponent at every level', () => {
  const named = new Set(ROWS.map((r) => r.id));
  let checked = 0;
  for (const id of Object.keys(OPPONENTS) as (keyof typeof OPPONENTS)[]) for (let level = 1; level <= LEVELS; level++) {
    if (named.has(`${id}:${level}`)) continue;
    assert.equal(worldOpponentAt(OPPONENTS[id], level), opponentAt(OPPONENTS[id], level), `${id} L${level}`);
    checked++;
  }
  assert.ok(checked > Object.keys(OPPONENTS).length * (LEVELS - 1));
});

test('a named row moves only that body\'s health, and only in the world; the Pit goblin keeps its 120 at every level', () => {
  for (const r of ROWS) {
    const pit = opponentAt(OPPONENTS[r.opponent as keyof typeof OPPONENTS], r.level), world = worldOpponentAt(OPPONENTS[r.opponent as keyof typeof OPPONENTS], r.level);
    assert.deepEqual({ ...world, health: pit.health }, pit, `${r.id}: everything but health is the Pit's`);
    assert.equal(world.health, Math.max(1, Math.round(pit.health * r.health / OPPONENTS[r.opponent as keyof typeof OPPONENTS].health)), `${r.id}: health follows the row through the novice blend`);
    assert.equal(worldLevelHealth(r.opponent, r.level), r.health);
  }
  assert.equal(OPPONENTS.goblin.health, 120, 'the archetype row (the Pit\'s Goblin) is untouched');
  for (let level = 6; level <= LEVELS; level++) assert.equal(opponentAt(OPPONENTS.goblin, level).health, 120, `the Pit goblin at L${level}`);
});

test('the Zone 1 goblin at level 1 is the 45 hp row (masher L1 rule); level 2 and up are the Pit\'s', () => {
  assert.equal(worldLevelHealth('goblin', 1), 45);
  assert.ok(worldOpponentAt(OPPONENTS.goblin, 1).health < opponentAt(OPPONENTS.goblin, 1).health, 'the world goblin is lighter than the Pit goblin at L1');
  for (let level = 2; level <= LEVELS; level++) assert.equal(worldLevelHealth('goblin', level), undefined, `goblin L${level} has no world row`);
});

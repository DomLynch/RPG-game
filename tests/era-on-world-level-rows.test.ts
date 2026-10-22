// World level rows (Combat, RV89 / Zone 2; Lead's ruling: a Zone fairness fix leaves the Pit byte for byte alone). The open world's creature body is worldOpponentAt and its brain worldProfileAt (moves.ts); the Pit keeps
// opponentAt / profileAt. A world level row (src/fight/world-level-defs.json) changes ONLY the (opponent, level) it names, and only the field it sets (`health`, `profileLevel`); with no row the world returns the Pit's own object.
// tests/level-anchor-rows.test.ts already pins the hash of opponentAt and profileAt for every opponent at every level, so a Pit body or brain that moved fails there; this file pins the other half: the world differs from the Pit at exactly the named rows.
// The LIVE era's twin of world-level-rows.test.ts (RV90): the rest of the unit suite imports ./lib/era-off.ts, so the world level rows were only ever proven under the legacy rules. This file
// imports ./lib/era-on.ts FIRST (the rules the game plays today); `node --test` runs each file in its own process, so it cannot leak. Same asserts, same rows.
import './lib/era-on.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, OPPONENTS, opponentAt, profileAt, worldOpponentAt, worldProfileAt } from '../src/fight/moves.ts';
import { worldLevelHealth, worldProfileLevel } from '../src/fight/world-level-rows.ts';
import WORLD_LEVEL_DEFS from '../src/fight/world-level-defs.json' with { type: 'json' };

type Row = { id: string; opponent: string; level: number; health?: number; profileLevel?: number };
const ROWS = WORLD_LEVEL_DEFS.worldLevels as Row[], body = (id: string) => OPPONENTS[id as keyof typeof OPPONENTS];

test('with no world level row, the world body and brain ARE the Pit\'s: the same objects, every opponent at every level', () => {
  const health = new Set(ROWS.filter((r) => r.health !== undefined).map((r) => r.id)), brain = new Set(ROWS.filter((r) => r.profileLevel !== undefined).map((r) => r.id));
  let checked = 0;
  for (const id of Object.keys(OPPONENTS) as (keyof typeof OPPONENTS)[]) for (let level = 1; level <= LEVELS; level++) {
    if (!health.has(`${id}:${level}`)) assert.equal(worldOpponentAt(OPPONENTS[id], level), opponentAt(OPPONENTS[id], level), `${id} L${level} body`);
    if (!brain.has(`${id}:${level}`)) assert.equal(worldProfileAt(OPPONENTS[id], level), profileAt(OPPONENTS[id], level), `${id} L${level} brain`);
    checked++;
  }
  assert.ok(checked > Object.keys(OPPONENTS).length * (LEVELS - 1));
});

test('a health row moves only that body\'s health, and only in the world; the Pit goblin keeps its 120 at every level', () => {
  for (const r of ROWS.filter((x) => x.health !== undefined)) {
    const pit = opponentAt(body(r.opponent), r.level), world = worldOpponentAt(body(r.opponent), r.level);
    assert.deepEqual({ ...world, health: pit.health }, pit, `${r.id}: everything but health is the Pit's`);
    assert.equal(world.health, Math.max(1, Math.round(pit.health * r.health! / body(r.opponent).health)), `${r.id}: health follows the row through the novice blend`);
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

test('a profileLevel row builds the world brain at that ladder level and nothing else: the Zone 2 Nightborn at displayed L2 and L3 reads like a level 8 one; the Pit Nightborn keeps its own', () => {
  const rows = ROWS.filter((r) => r.profileLevel !== undefined);
  assert.deepEqual(rows.map((r) => r.id), ['nightborn:2', 'nightborn:3']);
  for (const r of rows) {
    assert.equal(worldProfileLevel(r.opponent, r.level), 8);
    assert.equal(worldProfileAt(body(r.opponent), r.level), profileAt(body(r.opponent), 8), `${r.id}: the brain is the level-8 profile (the same object)`);
    assert.notDeepEqual(worldProfileAt(body(r.opponent), r.level), profileAt(body(r.opponent), r.level), `${r.id}: and it is not the level-${r.level} one`);
    assert.equal(worldOpponentAt(body(r.opponent), r.level), opponentAt(body(r.opponent), r.level), `${r.id}: the body, displayed level, loot and XP stay the Pit's level ${r.level} one`);
  }
  assert.equal(worldProfileLevel('nightborn', 4), undefined, 'a level with no row keeps its own brain');
  assert.equal(worldProfileLevel('goblin', 1), undefined, 'a health row alone does not move the brain');
});

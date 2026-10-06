import assert from 'node:assert/strict';
import test from 'node:test';
import { awardFor, kitAt, levelRefusal } from '../src/awards.ts';
import { DIAL_TRAIL, MAX_LEVEL } from '../src/career.ts';
import { LOOT, WORN_FROM } from '../src/loot.ts';

// The DB half (seed, verified win, guest convert, forged cache) is scripts/awards-database-check.mjs on real PostgreSQL; this is the rule.
test('the take is the claimed piece, armour or weapon, at the tier the fight was met at', () => {
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: 'veteran.Greaves' }, { marks: 4, owned: [] }), { piece: 'veteran.Greaves', tier: 1 });   // Recruit V (4 wins, 50-level ladder)
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: 'veteran.Greaves' }, { marks: 5, owned: [] }), { piece: 'veteran.Greaves', tier: 2 });   // Legionary I
  assert.deepEqual(awardFor({ opponent: 'goblin', piece: 'goblin.Knife' }, { marks: 45, owned: [] }), { piece: 'goblin.Knife', tier: 10 });   // Origin
});

test('a claim is still a mark with nothing to award', () => {
  assert.equal(awardFor({ opponent: 'veteran', piece: null }, { marks: 14, owned: [] }), null);                        // the take declined
  assert.equal(awardFor({ opponent: 'veteran', piece: 'veteran.Body' }, { marks: 0, owned: ['veteran.Body'] }), null);   // already his
});

test('a piece outside the opponent\'s kit is refused', () => {
  for (const piece of ['veteran.Trident', 'goblin.Crest', 'goblin.Axe', 'nonsense']) {
    assert.equal(typeof awardFor({ opponent: 'goblin', piece }, { marks: 0, owned: [] }), 'string', piece);
  }
  assert.equal(typeof awardFor({ opponent: 'minotaur', piece: 'veteran.Body' }, { marks: 0, owned: [] }), 'string');   // he carries no loot
});

test('the kit floor: a piece worn only from a later rung is refused below it', () => {
  const floor = { 'veteran.Crest': 'Gladiator' } as const;   // Gladiator starts at 10 wins (level 11)
  assert.deepEqual(WORN_FROM, {});   // beta ruling 2026-09-23: empty, every piece worn from Recruit; filling it is Multi Chars' data change
  assert.deepEqual(kitAt('veteran', 'Recruit'), LOOT.veteran);
  assert.ok(!kitAt('veteran', 'Legionary', floor).includes('veteran.Crest'));
  assert.equal(typeof awardFor({ opponent: 'veteran', piece: 'veteran.Crest' }, { marks: 9, owned: [] }, floor), 'string');
  assert.deepEqual(awardFor({ opponent: 'veteran', piece: 'veteran.Crest' }, { marks: 10, owned: [] }, floor), { piece: 'veteran.Crest', tier: 3 });
});

test('levelRefusal: the floor is the rank level minus DIAL_TRAIL, never below 1; at or above passes; a record with no level keeps the older rules', () => {
  assert.equal(levelRefusal(undefined, 100000), null);
  assert.equal(levelRefusal(1, 0), null, 'a fresh account: rank 1, floor 1');
  assert.equal(levelRefusal(1, DIAL_TRAIL), null, 'rank 1 + DIAL_TRAIL still floors at 1');
  assert.match(String(levelRefusal(1, DIAL_TRAIL + 1)), /didn't count \(level 1; your rank is level 7, floor 2\)/);
  assert.equal(levelRefusal(MAX_LEVEL - DIAL_TRAIL, 100000), null, 'Origin: the dial may trail to 45');
  assert.match(String(levelRefusal(MAX_LEVEL - DIAL_TRAIL - 1, 100000)), /floor 45/);
  assert.equal(levelRefusal(MAX_LEVEL, 0), null, 'harder than the rank is never an exploit');
  // The 50-level ladder (RV27): the floor moves only for ranks past 46, which did not exist before; a record older than RV27 keeps the 46 top (floor 41).
  assert.equal(levelRefusal(41, 45), null); assert.equal(levelRefusal(41, 45, 27), null, 'rank 46 (45 wins) is the same rank on both ladders: floor 41');
  assert.ok(levelRefusal(41, 49, 27), 'rank 50 at RV27: floor 45, level 41 is refused'); assert.equal(levelRefusal(41, 49, 26), null, 'the same claim recorded at RV26 is judged by the 46 ladder: floor 41');
  assert.ok(levelRefusal(40, 49, 26), 'and the old floor still refuses 40'); assert.equal(levelRefusal(45, 49, 27), null);
  assert.equal(levelRefusal(1, 19), "This win was fought below your rank and didn't count (level 1; your rank is level 20, floor 15).", 'the player reads it');
  assert.equal(levelRefusal(15, 19), null, 'the floor itself counts'); assert.ok(levelRefusal(14, 19), 'one under the floor does not');
});

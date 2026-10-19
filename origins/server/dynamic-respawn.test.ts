import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dynamicRespawnS } from './dynamic-respawn.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const RULE = SERVER_RULES.dynamicRespawn[0]!;   // the row: playersFull 10, floorS 15 (Dom's ruling via Strategy: Trinity-style respawn x min(1, 10 / players), floor 10-15 s)

test('the row: 10 players is a full layer, 15 s is the floor (about one fight)', () => {
  assert.deepEqual([RULE.playersFull, RULE.floorS], [10, 15]);
});

test('at or under the full count, and with no count at all, the creature keeps its own row respawn', () => {
  for (const players of [0, 1, 9, 10, undefined, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(dynamicRespawnS(75, players), 75, String(players));
});

test('over the full count the respawn shrinks in proportion: double the crowd, half the clock', () => {
  assert.equal(dynamicRespawnS(60, 20), 30);
  assert.equal(dynamicRespawnS(75, 20), 38);   // 37.5 rounds up
  assert.equal(dynamicRespawnS(300, 80), 38);   // a long clock (the troll's 300 s) in a full 80-player layer: 37.5
});

test('never below the floor, never above the creature\'s own row', () => {
  assert.equal(dynamicRespawnS(40, 80), 15, '40 x 10 / 80 = 5 s, held at the floor');
  assert.equal(dynamicRespawnS(75, 100), 15, '7.5 s at the hard cap of 100 players, held at the floor');
  assert.equal(dynamicRespawnS(10, 80), 10, 'a row already under the floor keeps its own (the floor never lengthens a clock)');
  for (const base of [10, 30, 45, 75, 300]) for (const players of [11, 20, 80, 100]) assert.ok(dynamicRespawnS(base, players) <= base, `${base}/${players}`);
});

test('a layer\'s supply per player stays flat: respawn x players is constant until the floor binds', () => {
  const base = 120;
  const products = [20, 40, 80].map((p) => dynamicRespawnS(base, p) * p);
  assert.ok(Math.max(...products) - Math.min(...products) <= 80, `x players: ${products.join(', ')}`);   // rounding to a whole second is the only slack
});

test('a row can be passed in place of the file (tests and a later per-zone row)', () => {
  assert.equal(dynamicRespawnS(100, 30, { playersFull: 10, floorS: 20 }), 33);
  assert.equal(dynamicRespawnS(100, 30, { playersFull: 10, floorS: 50 }), 50);
});

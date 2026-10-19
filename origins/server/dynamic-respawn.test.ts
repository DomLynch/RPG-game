import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dynamicRespawnS } from './dynamic-respawn.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

const RULE = SERVER_RULES.dynamicRespawn[0]!;   // the row: playersFull 20, floorS 15

test('the row: 20 players is a full layer, 15 s is the floor (about one fight)', () => {
  assert.deepEqual([RULE.playersFull, RULE.floorS], [20, 15]);
});

test('at or under the full count, and with no count at all, the creature keeps its own row respawn', () => {
  for (const players of [0, 1, 19, 20, undefined, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(dynamicRespawnS(75, players), 75, String(players));
});

test('over the full count the respawn shrinks in proportion: double the crowd, half the clock', () => {
  assert.equal(dynamicRespawnS(60, 40), 30);
  assert.equal(dynamicRespawnS(75, 40), 38);   // 37.5 rounds up
  assert.equal(dynamicRespawnS(300, 80), 75);   // a long clock (the troll's 300 s) in a full 80-player layer
});

test('never below the floor, never above the creature\'s own row', () => {
  assert.equal(dynamicRespawnS(40, 80), 15, '40 x 20 / 80 = 10 s, held at the floor');
  assert.equal(dynamicRespawnS(75, 100), 15, '15 s exactly at the hard cap of 100 players');
  assert.equal(dynamicRespawnS(10, 80), 10, 'a row already under the floor keeps its own (the floor never lengthens a clock)');
  for (const base of [10, 30, 45, 75, 300]) for (const players of [21, 40, 80, 100]) assert.ok(dynamicRespawnS(base, players) <= base, `${base}/${players}`);
});

test('a layer\'s supply per player stays flat: respawn x players is constant until the floor binds', () => {
  const base = 120;
  const products = [40, 60, 80].map((p) => dynamicRespawnS(base, p) * p);
  assert.ok(Math.max(...products) - Math.min(...products) <= 80, `x players: ${products.join(', ')}`);   // rounding to a whole second is the only slack
});

test('a row can be passed in place of the file (tests and a later per-zone row)', () => {
  assert.equal(dynamicRespawnS(100, 30, { playersFull: 10, floorS: 20 }), 33);
  assert.equal(dynamicRespawnS(100, 30, { playersFull: 10, floorS: 50 }), 50);
});

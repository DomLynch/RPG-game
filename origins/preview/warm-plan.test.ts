import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER, warmDone, warmList } from './warm-plan.ts';

test('the player\'s actor is in every zone\'s warm-up list, first, whatever the creature kinds', () => {
  for (const kinds of [[], ['goblin', 'wolf'], ['goblin', 'boar', 'knight', 'pitborn', 'bear', 'witch', 'wolf'], ['player']]) {
    const list = warmList(kinds); assert.equal(list[0], PLAYER); assert.equal(list.filter((k) => k === PLAYER).length, 1); assert.deepEqual(list.slice(1), kinds.filter((k) => k !== PLAYER));
  }
});
test('a zone is ready only when the player and every kind are warmed or failed', () => {
  const list = warmList(['goblin', 'wolf']);
  assert.equal(warmDone(list, ['goblin', 'wolf'], []), false, 'creatures warmed but the player is not');
  assert.equal(warmDone(list, ['player', 'goblin'], []), false);
  assert.equal(warmDone(list, ['player', 'goblin', 'wolf'], []), true);
  assert.equal(warmDone(list, ['goblin', 'wolf'], ['player']), true, 'a player actor that failed to load does not hold the zone');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ROSTER, ENCOUNTERS, isOpponentId } from '../src/roster.ts';
import { OPPONENTS, weaponOf } from '../src/moves.ts';
import { warriorRecipe } from '../scripts/warrior-recipe.mjs';

test('every recipe resolves to its shipped rig, simulation weapon and offline build', () => {
  assert.equal(ENCOUNTERS.length, 5);
  for (const { id } of ENCOUNTERS) {
    const recipe = ROSTER[id], opponent = OPPONENTS[id];
    assert.equal(opponent.id, id); assert.equal(opponent.weapon, recipe.weapon);
    assert.ok(existsSync(new URL(`../src/assets/${recipe.body}.glb`, import.meta.url)));
    const build = warriorRecipe(id);
    assert.equal(build.body, recipe.body);
    assert.equal(build.weapon, weaponOf(recipe.weapon).placeholder ? 'longsword' : recipe.weapon);
  }
  assert.equal(warriorRecipe('executioner').weapon, 'scythe');
  assert.equal(warriorRecipe().weapon, 'longsword');
  assert.equal(warriorRecipe('nightborn', 'estoc').weapon, 'estoc', 'weapon lane can explicitly build a shelved package');
  for (const id of ['constructor', '__proto__', '', 'goblin47']) {
    assert.equal(isOpponentId(id), false); assert.throws(() => warriorRecipe(id));
  }
  assert.throws(() => warriorRecipe('veteran', 'missing'));
});

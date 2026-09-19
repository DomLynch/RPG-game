import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ROSTER, ENCOUNTERS, isOpponentId, supportsFinishers } from '../src/roster.ts';
import { OPPONENTS, weaponOf } from '../src/moves.ts';
import { warriorRecipe } from '../scripts/warrior-recipe.mjs';
import { warriorAppearance } from '../scripts/warrior-appearance.mjs';

test('every recipe resolves to its shipped rig, simulation weapon and offline build', () => {
  assert.equal(ENCOUNTERS.length, 9);
  for (const { id } of ENCOUNTERS) {
    const recipe = ROSTER[id], opponent = OPPONENTS[id];
    assert.equal(opponent.id, id); assert.equal(opponent.weapon, recipe.weapon);
    assert.ok(existsSync(new URL(`../src/assets/${recipe.body}.glb`, import.meta.url)));
    const build = warriorRecipe(id);
    if (build.pipeline === 'reconstruction') {
      assert.ok(existsSync(new URL(`../src/assets/source/creatures/${id}.glb`, import.meta.url)), 'reconstruction has a reproducible source');
      assert.equal(supportsFinishers(id), false, 'unvalidated creature executions use plain death');
    } else assert.ok(warriorAppearance(id).steel.color, 'humanoid recipes have an explicit appearance');
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

test('appearance presets reject unknown identities and do not leak edits across builds', () => {
  for (const id of ['constructor', '__proto__', '', 'missing']) assert.throws(() => warriorAppearance(id));
  const original = warriorAppearance();
  const edited = warriorAppearance();
  edited.steel.color = '#000000';
  edited.heraldry = '#ffffff';
  assert.deepEqual(warriorAppearance(), original);
  assert.equal(warriorAppearance('executioner').matteIron, true);
  assert.equal(warriorAppearance('veteran').matteIron, false);
});

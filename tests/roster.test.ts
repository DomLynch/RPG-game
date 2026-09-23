import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ROSTER, ENCOUNTERS, isOpponentId, supportsFinishers, resolveFinisher } from '../src/roster.ts';
import { OPPONENTS, weaponOf } from '../src/moves.ts';
import { warriorRecipe } from '../scripts/warrior-recipe.mjs';
import { warriorAppearance } from '../scripts/warrior-appearance.mjs';

test('every recipe resolves to its shipped rig, simulation weapon and offline build', () => {
  assert.equal(ENCOUNTERS.length, 12);
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
  assert.equal(warriorAppearance('veteran').items, 'helmet_bronze');
  assert.equal(warriorAppearance('executioner').items, 'mask_iron,hood_rag');
  for (const id of ['hero', 'pitborn', 'goblin', 'nightborn']) assert.equal(warriorAppearance(id).items, '');
});

test('Opened is supported on Wraith and Minotaur without enabling other creature executions', () => {
  for (const id of ['wraith','minotaur'] as const) {
    assert.equal(supportsFinishers(id, 'opened'), true);
    for (const kind of ['splitCrown','decapitation','runThrough','quietOne'] as const) assert.equal(supportsFinishers(id,kind),false);
  }
});


test('new creatures retain ordinary death for Auto and every manual finisher choice', () => {
  for (const id of ['werewolf', 'skeleton'] as const) {
    const weapons = ['longsword', ROSTER[id].weapon] as const;
    for (let heading = 0; heading < 10; heading++) {
      const finish = { victim: 1 as const, location: 'torso' as const, move: 'light_right' as const, heading, draw: false };
      assert.equal(resolveFinisher(id, finish, weapons), null);
      for (const choice of ['splitCrown', 'decapitation', 'runThrough', 'quietOne', 'opened', 'plainDeath'] as const) {
        assert.equal(supportsFinishers(id, choice), false);
        assert.equal(resolveFinisher(id, finish, weapons, choice), null);
      }
    }
  }
});

test('the Dwarf takes the full finisher rotation (owner 2026-09-20): every rotation outcome resolves on him', () => {
  const weapons = ['longsword', ROSTER.dwarf.weapon] as const;
  const seen = new Set<string>();
  for (let heading = 0; heading < 40; heading++) {
    const finish = { victim: 1 as const, location: 'torso' as const, move: 'light_right' as const, heading: heading * 0.37, draw: false };
    const pick = resolveFinisher('dwarf', finish, weapons);
    assert.ok(pick, 'a blade kill on the Dwarf draws a ceremony');
    seen.add(pick);
  }
  assert.deepEqual([...seen].sort(), ['decapitation', 'opened', 'plainDeath', 'runThrough', 'splitCrown']);
  for (const choice of ['splitCrown', 'decapitation', 'runThrough', 'opened', 'plainDeath'] as const) assert.equal(supportsFinishers('dwarf', choice), true);
  assert.equal(supportsFinishers('dwarf', 'quietOne'), false, 'The Quiet One is not validated on the Dwarf (picker forces fall back to the plain death)');
});

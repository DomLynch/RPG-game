import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GEAR } from '../src/fight/gear-rows.ts';
import { weightClassOf } from '../src/fight/gear-weight.ts';

test('a piece\'s weight class is its opponent\'s set class, read from the gear rows', () => {
  assert.equal(weightClassOf('veteran.Arms'), 'heavy');   // plate
  assert.equal(weightClassOf('witch.Head'), 'light');     // robes
  assert.equal(weightClassOf('goblin.Legs'), 'medium');   // leathers
});
test('a piece no set owns has no class, never a guess', () => {
  assert.equal(weightClassOf('frontier.ash-helm'), null);
  assert.equal(weightClassOf('nobody.Arms'), null);
});
test('every owner in the rows resolves to its set\'s class', () => {
  for (const [owner, set] of Object.entries(GEAR.owners)) assert.equal(weightClassOf(`${owner}.Arms`), GEAR.sets[set]!.weightClass, owner);
});

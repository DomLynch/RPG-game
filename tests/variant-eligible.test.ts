// Variant eligibility (row 22, catalogue half): only wild creatures roll scarred/alpha/ancient. A ranked Pit opponent never does, because its look and name come from its rung legend.
import assert from 'node:assert/strict';
import test from 'node:test';
import { VARIANTS, eligibleFor } from '../origins/world/variants.ts';
import { CATALOGUE } from '../src/fight/index.ts';

test('variant eligibility: every listed id is a catalogue creature without ranks, and the beasts and the undead roll the tiers', () => {
  const ranked = new Set(CATALOGUE.filter((r) => r.ranks.length).map((r) => r.id));
  for (const v of Object.values(VARIANTS)) for (const id of v.eligible) assert.ok(CATALOGUE.some((r) => r.id === id) && !ranked.has(id), `${id} is a wild catalogue creature`);
  assert.deepEqual(eligibleFor('ember-wolf').map((r) => r.id), ['plain', 'scarred', 'alpha']);
  assert.deepEqual(eligibleFor('wraith').map((r) => r.id), ['plain', 'ancient']);
  assert.deepEqual(eligibleFor('goblin').map((r) => r.id), ['plain']);
});

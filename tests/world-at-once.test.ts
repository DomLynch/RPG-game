// A catalogue row may hold a camp below the one attacker cap (Lead, 2026-10-13: the goblin camps engage at most two at once, by the row's `atOnce` field, until Combat's retune restores the designed sizes).
// The cap is the lower of MAX_ATTACKERS and the row's value; a kind with no `atOnce` (the wolf) is unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_ATTACKERS } from '../src/fight/attackers.ts';
import { fieldOf } from '../src/fight/catalogue-fields.ts';
import { creature, newWorld, pairs, player, stepCombat } from '../src/fight/world.ts';

const peakOn = (kinds: readonly string[]): number => {
  const foes = kinds.map((k, i) => { const a = (i / kinds.length) * Math.PI * 2, r = 5 + (i % 2); return creature(`c${i}`, k, Math.sin(a) * r, Math.cos(a) * r, a + Math.PI, 3); });
  const hero = player('hero', 0, 0, 0); hero.health = hero.maxHealth = 1e6;
  let w = newWorld([hero, ...foes]), peak = 0;
  for (let k = 0; k < 60 * 30; k++) { w = stepCombat(w, { hero: { x: 0, z: 0, attack: k % 25 === 0 ? 'light' : null } }, 1 / 60).world; peak = Math.max(peak, pairs(w).filter((p) => p.player === 'hero').length); }
  return peak;
};

test('the goblin row holds a camp to two on the hero; the wolf row is unchanged', () => {
  assert.equal(fieldOf('goblin', 'atOnce'), 2, 'the cap is one data field on the goblin row');
  assert.equal(fieldOf('wolf', 'atOnce'), undefined, 'the wolf row has none');
  for (const n of [3, 4]) assert.equal(peakOn(Array(n).fill('goblin')), 2, `${n} goblins: two at once, and the cap is reached (not vacuous)`);
  assert.equal(peakOn(Array(4).fill('wolf')), MAX_ATTACKERS, 'four wolves still put three on him');
});

test('a goblin in a mixed camp lowers the count only when it is in the group: wolves fill what the goblin row allows', () => {
  assert.ok(peakOn(['goblin', 'goblin', 'goblin', 'wolf', 'wolf']) <= MAX_ATTACKERS);
});

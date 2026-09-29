// The Special Moves race (Dom 20:2x): a caster killed during his wind-up fizzles; a release on the same tick he takes a lethal blow still
// lands, and a lethal one then makes the fight a double kill through the sim's own Finish.draw. Constructed states, no stepping: deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPPONENTS } from '../src/moves.ts';
import { resolveSpecial } from './special-proto.ts';
import { arena } from './strategies.ts';

test('special: a caster killed during the wind-up fizzles and deals nothing', () => {
  const d = arena(OPPONENTS.veteran);
  d.fighters[0].health = 0; d.finish = { victim: 0, location: 'torso', move: 'heavy_overhead', heading: 0 };
  const before = d.fighters[1].health, r = resolveSpecial(d, 0, false, .2);
  assert.equal(r.race, 'fizzled');
  assert.equal(r.d.fighters[1].health, before);
  assert.ok(!r.d.finish?.draw);
});

test('special: released on the tick its caster takes a lethal blow, a lethal special is a double kill (Finish.draw)', () => {
  const d = arena(OPPONENTS.veteran);
  d.fighters[0].health = 0; d.finish = { victim: 0, location: 'torso', move: 'heavy_overhead', heading: 0 };
  d.fighters[1].health = 10;
  const r = resolveSpecial(d, 0, true, .2);
  assert.equal(r.race, 'double');
  assert.equal(r.d.fighters[1].health, 0);
  assert.equal(r.d.finish?.draw, true);
  assert.equal(r.d.finish?.victim, 0);   // the draw path keeps the first victim, as duel.ts does
});

test('special: a live caster lands 20 % of max health, and a lethal one ends the fight on the target', () => {
  const d = arena(OPPONENTS.veteran), max = d.fighters[1].maxHealth;
  const hit = resolveSpecial(d, 0, true, .2);
  assert.equal(hit.race, 'landed');
  assert.equal(hit.d.fighters[1].health, max - Math.round(.2 * max));
  assert.equal(hit.d.finish, null);
  d.fighters[1].health = 5;
  const kill = resolveSpecial(d, 0, true, .2);
  assert.deepEqual([kill.race, kill.d.finish?.victim, !!kill.d.finish?.draw], ['landed', 1, false]);
});

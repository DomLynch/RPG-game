// State gates (Wave A1 PR3, programme item 5, adapted: there is no to-hit roll, so a gate is a refused input): a stunned fighter's parry and dodge are refused, a casting fighter's too, and the
// front arc is the existing `guardDirection`. The engine already refuses them through `legal()` (a stunned fighter is in the 'hurt' phase, a caster has `special`); these tests PIN it, so a later change
// to a phase or to the cast gate cannot quietly reopen an escape from a stun or a cast. No sim file changes for this item, so it carries no record bump of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, legal, type Action, type Fighter } from '../src/fight/duel.ts';
import { TARGET } from '../src/fight/sim.ts';

const standing = (): Fighter => createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready');
const ESCAPES: readonly Action[] = ['parry', 'dodge', 'backstep'];

test('a standing fighter can parry, dodge and step back (the gates only close on a stun or a cast)', () => {
  for (const a of ESCAPES) assert.equal(legal(standing(), a), true, a);
});
test('a stunned fighter (hurt, ticks of stun left) cannot parry, dodge or step back', () => {
  const stunned: Fighter = { ...standing(), phase: 'hurt', age: 1, stun: 20 };
  for (const a of ESCAPES) assert.equal(legal(stunned, a), false, a);
});
test('a casting fighter (a committed special windup) takes no input at all: no parry, no dodge, no step, no swing', () => {
  const casting: Fighter = { ...standing(), special: { id: 'any' } as unknown as NonNullable<Fighter['special']> };
  for (const a of [...ESCAPES, 'light', 'heavy', 'kick', 'skill'] as Action[]) assert.equal(legal(casting, a), false, a);
});
test('an exhausted fighter cannot dodge or step back either (the existing stamina gate)', () => {
  const spent: Fighter = { ...standing(), stamina: 0, exhausted: true };
  for (const a of ESCAPES) assert.equal(legal(spent, a), false, a);
});

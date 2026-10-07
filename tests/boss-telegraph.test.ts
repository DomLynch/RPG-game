// The boss ground telegraph (boss-telegraph.ts, ?telegraph=1): a pure read of the sim's windup, boss specials only, never written back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/moves.ts';
import { telegraphFlag, telegraphLook } from '../src/boss-telegraph.ts';

test('the flag is explicit: only ?telegraph=1|on|ring turns it on', () => {
  assert.equal(telegraphFlag('?telegraph=1'), true);
  assert.equal(telegraphFlag('?special=shield&telegraph=on'), true);
  assert.equal(telegraphFlag(''), false);
  assert.equal(telegraphFlag('?telegraph=0'), false);
});

test('a boss windup fills the ring and flashes in the last roll window', () => {
  const boss = { specialShare: RULES.special.bossDamage, health: 100 };
  assert.deepEqual(telegraphLook({ ...boss, special: RULES.special.windup }), { fill: 0, flash: false });
  assert.equal(telegraphLook({ ...boss, special: RULES.special.windup / 2 })?.fill, 0.5);
  assert.equal(telegraphLook({ ...boss, special: 24 })?.flash, true);
  assert.equal(telegraphLook({ ...boss, special: 25 })?.flash, false);
});

test('nothing is drawn for a class special, outside a windup, or for a dead caster', () => {
  assert.equal(telegraphLook({ specialShare: RULES.special.damage, health: 100, special: 60 }), null);
  assert.equal(telegraphLook({ specialShare: RULES.special.bossDamage, health: 100, special: 0 }), null);
  assert.equal(telegraphLook({ specialShare: RULES.special.bossDamage, health: 0, special: 60 }), null);
  assert.equal(telegraphLook({ health: 100, special: 60 }), null);
});

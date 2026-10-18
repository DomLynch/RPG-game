// Sandbox missiles (RV79) ship OFF: every missile table is empty and every missile rule is 0, so no weapon throws anything, no bow has a special, the AI answers no arrow and a fight is byte for byte what it was (the melee digest, scripts/melee-digest.mjs, is the receipt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ammoOf, bowSpecialOf, bowSpecialRows, laneOf, MISSILE_ANSWER, MISSILE_GUARD_POSTURE, MISSILE_HOMING, MISSILE_STUN, missileLook, missileMinGap, missileOf, missileRows, missileTiming, QUIVER } from '../src/fight/sandbox-rules.ts';
import { CC_LADDER } from '../src/fight/cc-ladder.ts';

test('no missile rows: nothing flies, nothing is drawn, the quiver is infinite', () => {
  assert.equal(missileRows(), 0); assert.equal(missileLook(), undefined); assert.equal(missileOf('knife'), undefined); assert.equal(laneOf('thrust'), undefined);
  assert.equal(ammoOf('knife'), 0); assert.equal(missileTiming('knife'), undefined); assert.equal(QUIVER, 0);
  assert.equal(missileMinGap(), 0); assert.equal(MISSILE_HOMING, 0); assert.equal(MISSILE_STUN, 0); assert.equal(MISSILE_GUARD_POSTURE, 0);
});

test('no bow special rows and no AI answer', () => {
  assert.deepEqual(bowSpecialRows(), []); assert.equal(bowSpecialOf('knife', 'cleave', Infinity, undefined), undefined); assert.equal(MISSILE_ANSWER, undefined);
});

test('the cc ladder knows the pin kind and the unstoppable tier is immune to it', () => {
  assert.ok(CC_LADDER.kinds.pin, 'a pin kind'); assert.deepEqual(CC_LADDER.kinds.pin!.sources, ['pinShot']);
  assert.ok(CC_LADDER.tiers.unstoppable!.immune.includes('pin'));
});

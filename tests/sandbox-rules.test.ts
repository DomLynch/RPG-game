import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL_MELEE_WINDUP, SPECIAL_REACT, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE, SPECIAL_REACT_STAGGER, shardRows, specialLookOf, specialPickRows, specialReactFloorOf, specialShardsOf, specialSoundOf, specialTrailOf } from '../src/fight/sandbox-rules.ts';

// Slice (e) of the combat-sandbox port (RV77) wired duel.ts to the melee-special rules; the flip (RV78) ships the windup and react rows ON (the behaviour per rule is tests/sandbox-special-react.test.ts).
test('the shipped melee-special rules are on: a melee special commits for the row\'s ticks, a landed special staggers; the tuned percents and the lunge floor apply', () => {
  assert.equal(SPECIAL_MELEE_WINDUP, 32, 'a melee special is committed for a heavy swing\'s pace');
  assert.equal(SPECIAL_REACT, 1, 'a landed special applies its move row\'s stagger, knockback and posture');
  assert.deepEqual([SPECIAL_REACT_STAGGER, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE], [160, 450, 150], 'the sandbox\'s tuned percents, read only once specialReact is 1');
  assert.equal(specialReactFloorOf('lunge'), 36);
  assert.equal(specialReactFloorOf('cleave'), 0);
  assert.deepEqual(specialPickRows(), []);
  assert.equal(specialLookOf('cleave'), undefined);
  assert.equal(specialTrailOf('cleave'), undefined);
  assert.deepEqual(specialShardsOf('cleave'), []);
  assert.equal(shardRows(), 0);
  assert.deepEqual(specialSoundOf('cleave'), []);
});

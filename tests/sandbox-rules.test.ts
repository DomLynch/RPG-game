import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL_MELEE_WINDUP, SPECIAL_REACT, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE, SPECIAL_REACT_STAGGER, shardRows, specialLookOf, specialPickRows, specialReactFloorOf, specialShardsOf, specialSoundOf, specialTrailOf } from '../src/fight/sandbox-rules.ts';

// Slice (e) of the combat-sandbox port (RV77): duel.ts reads the melee-special rules, and they ship OFF, so a trunk fight is byte for byte as before (the behaviour with a rule ON is tests/sandbox-special-react.test.ts).
test('the shipped melee-special rules are off: the special keeps its own windup, a landed special does damage only; the tuned percents and the lunge floor wait for the flip', () => {
  assert.equal(SPECIAL_MELEE_WINDUP, 0, 'the special keeps its own windup rule');
  assert.equal(SPECIAL_REACT, 0, 'a landed special does damage only');
  assert.deepEqual([SPECIAL_REACT_STAGGER, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE], [160, 450, 150], 'the sandbox\'s tuned percents, read only once specialReact is 1');
  assert.equal(specialReactFloorOf('lunge'), 36);
  assert.equal(specialReactFloorOf('cleave'), 0);
  assert.deepEqual(specialPickRows(), []);
  assert.equal(specialLookOf('cleave'), undefined);
  assert.equal(specialTrailOf('cleave'), undefined);
  assert.deepEqual(specialShardsOf('cleave'), []);
  assert.equal(shardRows(), 0);
  assert.deepEqual(specialSoundOf('cleave'), []);
  assert.deepEqual(specialSoundOf('skullcrack'), []);
});

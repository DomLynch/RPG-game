import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL_MELEE_WINDUP, SPECIAL_REACT, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE, SPECIAL_REACT_STAGGER, shardRows, specialLookOf, specialPickRows, specialReactFloorOf, specialShardsOf, specialSoundOf, specialTrailOf } from '../src/fight/sandbox-rules.ts';

// Slice (e) of the combat-sandbox port (RV77): duel.ts reads the melee-special rules, and they ship OFF, so a trunk fight is byte for byte as before (the behaviour with a rule ON is tests/sandbox-special-react.test.ts).
test('the shipped melee-special rules are ON (BULK-CS, Dom 2026-10-18): windup 32, a landed special staggers by its move row at the tuned percents, the lunge floor 36', () => {
  assert.equal(SPECIAL_MELEE_WINDUP, 32, 'a melee special is as quick as a heavy swing');
  assert.equal(SPECIAL_REACT, 1, 'a landed special staggers, shoves and shakes the victim');
  assert.deepEqual([SPECIAL_REACT_STAGGER, SPECIAL_REACT_KNOCK, SPECIAL_REACT_POSTURE], [160, 450, 150], 'the sandbox\'s tuned percents');
  assert.equal(specialReactFloorOf('lunge'), 36);
  assert.equal(specialReactFloorOf('cleave'), 0);
  assert.deepEqual(specialPickRows().map((r) => r.id), ['cleave', 'reaping', 'stomp', 'lunge']);   // the sandbox's four picker specials (Skull Crack, Whirlwind, Ground Slam, Lunge)
  assert.equal(specialLookOf('cleave'), undefined);
  assert.equal(specialTrailOf('cleave'), undefined);
  assert.deepEqual(specialShardsOf('cleave'), []);
  assert.equal(shardRows(), 0);
  assert.ok(specialSoundOf('cleave').length > 0, 'the sandbox\'s sounds for Skull Crack');
});

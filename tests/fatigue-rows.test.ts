import test from 'node:test';
import assert from 'node:assert/strict';
import { WINDED, TIRED } from '../src/fight/fatigue.ts';
import { FOE_TUNE, GUARD_DROP } from '../src/fight/fatigue-tune.ts';
import { FATIGUE_FULL, FATIGUE_RISE, FATIGUE_FALL, FATIGUE_GAS_RISE, FATIGUE_GAS_FALL, FATIGUE_SECOND, FATIGUE_HYST } from '../src/fight/fatigue-rows.ts';

// Group B slice 5: the fatigue numbers are rows now; the values must be bit for bit the literals they replaced.
test('fatigue rows give exactly the numbers the code used to hold', () => {
  assert.deepEqual([FATIGUE_FULL, FATIGUE_RISE, FATIGUE_FALL, FATIGUE_GAS_RISE, FATIGUE_GAS_FALL, FATIGUE_SECOND], [100, 1 / 45, 1 / 120, 1 / 20, 1 / 90, 1 / 90]);
  assert.deepEqual([WINDED, TIRED, FATIGUE_HYST, GUARD_DROP], [.5, .75, .06, .3]);
  assert.deepEqual(FOE_TUNE, {
    goblin: { rate: 1.5, depth: .55, sag: .8 }, executioner: { rate: .65, depth: 1.4, sag: 1.2 }, minotaur: { rate: .7, depth: 1.4, sag: 1.2 },
    dwarf: { rate: 1.2, depth: .8, sag: 1 }, veteran: { rate: .95, depth: 1.1, sag: 1 }, pitborn: { rate: .9, depth: 1.2, sag: 1.1 },
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/power-words-rows.ts';

// power-words.ts's named numbers are rows (power-words-defs.json); the values must be exactly the literals the file held before.
test('power-words rows give exactly the numbers power-words.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"POWER_WORD_GAIN": 0});
});

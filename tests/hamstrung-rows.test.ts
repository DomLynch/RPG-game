import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/hamstrung-rows.ts';

// hamstrung.ts's named numbers are rows (hamstrung-defs.json); the values must be exactly the literals the file held before.
test('hamstrung rows give exactly the numbers hamstrung.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"HAMSTRUNG_SOURCE_PELVIS": 0.95});
});

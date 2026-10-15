import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/moves-dials-rows.ts';

// moves-dials.ts's named numbers are rows (moves-dials-defs.json); the values must be exactly the literals the file held before.
test('moves-dials rows give exactly the numbers moves-dials.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"LEVELS": 50, "LATE_NOTICE_FROM": 12});
});

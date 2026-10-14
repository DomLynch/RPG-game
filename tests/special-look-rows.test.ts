import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-look-rows.ts';

// special-look.ts's named numbers are rows (special-look-defs.json); the values must be exactly the literals the file held before.
test('special-look rows give exactly the numbers special-look.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"SPECIAL_RECOVER": 45, "SPECIAL_STRUCK": 45});
});

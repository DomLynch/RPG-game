import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/standoff-rows.ts';

// standoff.ts's named numbers are rows (standoff-defs.json); the values must be exactly the literals the file held before.
test('standoff rows give exactly the numbers standoff.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"STANDOFF_MS": 800});
});

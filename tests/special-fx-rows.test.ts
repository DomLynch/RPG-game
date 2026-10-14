import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-rows.ts';

// special-fx.ts's named numbers are rows (special-fx-defs.json); the values must be exactly the literals the file held before.
test('special-fx rows give exactly the numbers special-fx.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"CLOUD": 14, "HALO": 8, "BURST": 20, "BURST_LIFE": 0.55, "CLOUD_HIGH": 0.7, "CLOUD_LOW": 0.12});
});

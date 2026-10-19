import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/mobkit-rows.ts';

// mobkit.ts's named numbers are rows (mobkit-defs.json); the values must be exactly the literals the file held before.
test('mobkit rows give exactly the numbers mobkit.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"CHAIN_CAP": 3, "AFTER_HIT_TICKS": 90, "EXHAUSTED_BELOW": 25});
});

import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/gambit-rows.ts';

// gambit.ts's named numbers are rows (gambit-defs.json); the values must be exactly the literals the file held before.
test('gambit rows give exactly the numbers gambit.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"GAMBIT_KILL_FLOOR": 0.4});
});

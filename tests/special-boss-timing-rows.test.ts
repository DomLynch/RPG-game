import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-boss-timing-rows.ts';

// special-boss-timing.ts's named numbers are rows (special-boss-timing-defs.json); the values must be exactly the literals the file held before.
test('special-boss-timing rows give exactly the numbers special-boss-timing.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"BUILD": 30});
});

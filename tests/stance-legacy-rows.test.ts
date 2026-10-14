import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/stance-legacy-rows.ts';

// stance-legacy's tables are rows now; each must equal, key for key, the object the code held before.
test('LEGACY_DEFENSIVE rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.LEGACY_DEFENSIVE_ROWS)), {"defensive": {"damage": -50, "block": -150, "recover": 250, "window": 250, "counter": 250}});
  assert.deepEqual(Object.keys(R.LEGACY_DEFENSIVE_ROWS), ["defensive"]);
});

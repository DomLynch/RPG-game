import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/skill-impact-rows.ts';

// skill-impact's tables are rows now; each must equal, key for key, the object the code held before.
test('IMPACT rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.IMPACT_ROWS)), {"flash": 0.12, "flashSize": 0.9, "sparks": 10, "life": 0.4, "reach": 0.28});
  assert.deepEqual(Object.keys(R.IMPACT_ROWS), ["flash", "flashSize", "sparks", "life", "reach"]);
});

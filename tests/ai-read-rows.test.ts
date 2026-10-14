import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/ai-read-rows.ts';

// ai-read's tables are rows now; each must equal, key for key, the object the code held before.
test('READ rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.READ_ROWS)), {"feint": 0.16666666666666666, "after": 2, "parry": 0.5, "guardTicks": 180, "guardShare": 0.45, "roll": 0.4, "swings": 11, "lightShare": 0.7, "baitHold": 12, "parryBoost": 2, "parryCap": 0.85, "chargeBoost": 0.4, "kickBoost": 0.3, "anticipate": 8, "baitShare": 0.7, "parkShare": 0.5, "lateNotice": 6, "holdTicks": 6, "latch": 600, "plus": 2, "decay": 0});
  assert.deepEqual(Object.keys(R.READ_ROWS), ["feint", "after", "parry", "guardTicks", "guardShare", "roll", "swings", "lightShare", "baitHold", "parryBoost", "parryCap", "chargeBoost", "kickBoost", "anticipate", "baitShare", "parkShare", "lateNotice", "holdTicks", "latch", "plus", "decay"]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP } from '../src/fight/sim.ts';
import { CM_PER_M, MS_PER_SECOND, SEED_LIMIT, TICKS_PER_SECOND, UINT32_RANGE } from '../origins/server/units.ts';

test('writer units: the numbers they replaced, and the sim step they mirror', () => {
  assert.equal(1 / TICKS_PER_SECOND, STEP, 'TICKS_PER_SECOND is the sim step rate');
  assert.deepEqual([MS_PER_SECOND, CM_PER_M, SEED_LIMIT, UINT32_RANGE], [1000, 100, 2 ** 31, 2 ** 32]);
});

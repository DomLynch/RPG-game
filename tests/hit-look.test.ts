import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitFxFrom } from '../src/look-flag.ts';
import { EDGE } from '../src/hit-look.ts';

test('no hitfx flag builds nothing; hitfx or hitfx-edge turns the edge pulse on', () => {
  for (const search of ['', '?look=', '?look=souls', '?look=hitfxx', '?look=hitfx-rim', '?opponent=knight']) assert.equal(hitFxFrom(search), false, search);
  for (const search of ['?look=hitfx', '?look=hitfx-edge', '?look=souls,hitfx']) assert.equal(hitFxFrom(search), true, search);
});

test('the edge is the mirror of the side the blow came from', () => {
  assert.deepEqual(EDGE, { right: 'left', left: 'right', overhead: 'top', thrust: 'bottom', low: 'bottom' });
});

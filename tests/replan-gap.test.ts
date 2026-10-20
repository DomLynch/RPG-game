import test from 'node:test';
import assert from 'node:assert/strict';
import { replanGapRow } from '../origins/preview/replan-gap.ts';

test('the usual gap until the zone-ready check finds something streamed in', () => {
  assert.equal(replanGapRow(-1, -1), 'replanGap');
});
test('after a deferral and before zone ready the confirming plan follows the drain at once', () => {
  assert.equal(replanGapRow(1200, -1), 'lateReplanGap');
});
test('once the zone is ready the usual 3 s cadence is back (no full scene walk every few frames for the session)', () => {
  assert.equal(replanGapRow(1200, 9000), 'replanGap');
  assert.equal(replanGapRow(-1, 9000), 'replanGap');
});

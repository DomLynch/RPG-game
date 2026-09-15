import test from 'node:test';
import assert from 'node:assert/strict';
import { FLICK_THRESHOLD, swipeAction } from '../src/gestures.ts';
test('the weapon disc reads a stroke direction: jitter and invalid input are nothing, diagonals resolve to the nearest axis', () => {
  for (const pair of [[0, 0], [12, 20], [NaN, 40], [Infinity, 0], [FLICK_THRESHOLD - 1, 0]]) assert.equal(swipeAction(...pair as [number, number]), null);
  assert.equal(swipeAction(-40, 5), 'left'); assert.equal(swipeAction(40, -5), 'right');
  assert.equal(swipeAction(2, -40), 'up'); assert.equal(swipeAction(-2, 40), 'down');
  assert.equal(swipeAction(40, 30), 'right'); assert.equal(swipeAction(-30, -40), 'up'); assert.equal(swipeAction(40, 40), 'right', 'a perfect diagonal favours the cut');
});

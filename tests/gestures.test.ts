import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeAction } from '../src/gestures.ts';
test('gesture trial distinguishes deliberate attacks from jitter, diagonals and invalid input', () => {
  for(const pair of [[0,0],[12,20],[40,40],[NaN,40],[Infinity,0]])assert.equal(swipeAction(...pair as [number,number]),null);
  assert.equal(swipeAction(-40,5),'light_left');assert.equal(swipeAction(40,-5),'light_right');
  assert.equal(swipeAction(2,-40),'heavy');assert.equal(swipeAction(-2,40),'dodge');
});

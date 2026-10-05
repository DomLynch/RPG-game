import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyHides } from '../src/see-through.ts';

const hero = { x: 0, z: 0 }, eye = { x: 0, y: 3.2, z: 4.5 };   // the lock camera sits behind him, high

test('a foe behind the hero at chest height is hidden', () => {
  assert.equal(bodyHides(eye, { x: 0, y: 1.1, z: -1 }, hero), true);
});
test('a foe in front of the hero is never hidden by him', () => {
  assert.equal(bodyHides(eye, { x: 0, y: 1.1, z: 2 }, hero), false);
});
test('a point beside the body, or well above it, is in the clear', () => {
  assert.equal(bodyHides(eye, { x: 1.2, y: 1.1, z: -1 }, hero), false);
  assert.equal(bodyHides(eye, { x: 0, y: 3, z: -1 }, hero), false);
});
test('the eye on the point, or over the hero, hides nothing', () => {
  assert.equal(bodyHides(eye, eye, hero), false);
  assert.equal(bodyHides({ x: 0, y: 3, z: 0 }, { x: 0, y: 1, z: -1 }, hero), false);
});

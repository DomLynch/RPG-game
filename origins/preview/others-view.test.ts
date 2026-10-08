import test from 'node:test';
import assert from 'node:assert/strict';
import { TAG_COLOUR, follow, gaitOf, plateColour, plateText, type Tagged } from './others-view.ts';

const o = (extra: Partial<Tagged> = {}): Tagged => ({ id: 1, x: 0, z: 0, heading: 0, anim: 0, flags: 0, ...extra });

test('plate: the server fields drive it; without them the figure is drawn and the plate is empty', () => {
  assert.equal(plateText(o()), ''); assert.equal(plateColour(o()), TAG_COLOUR.none);
  assert.equal(plateText(o({ name: 'Rook', level: 7 })), 'Rook Lv 7');
  assert.equal(plateText(o({ name: 'Newt', level: 2, protected: true })), '🛡 Newt Lv 2', 'the shield by a protected newcomer');
  assert.equal(plateColour(o({ tag: 'grey' })), TAG_COLOUR.grey); assert.equal(plateColour(o({ tag: 'red' })), TAG_COLOUR.red); assert.equal(plateColour(o({ tag: null })), TAG_COLOUR.none);
});

test('follow: eases toward the packet, snaps over 12 m, and reports the speed the gait reads', () => {
  let at = { x: 0, z: 0 }; for (let i = 0; i < 120; i++) at = follow(at, { x: 4, z: 0 }, 1 / 60);
  assert.ok(Math.abs(at.x - 4) < 0.05, 'arrives'); assert.equal(follow({ x: 0, z: 0 }, { x: 40, z: 0 }, 1 / 60).x, 40, 'a respawn is taken at once');
  assert.equal(follow({ x: 0, z: 0 }, { x: 0, z: 0 }, 1 / 60).speed, 0); assert.ok(follow({ x: 0, z: 0 }, { x: 3, z: 0 }, 1 / 60).speed > 3.6, 'a far packet reads as a run');
  assert.deepEqual([gaitOf(0), gaitOf(1.5), gaitOf(5)], [0, 1, 3], 'Idle / Walk / Run');
});

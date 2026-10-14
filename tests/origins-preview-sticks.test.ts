// The two thumb sticks (origins/preview/sticks.ts): walk, run past the rim, strafe, turn, tilt, and the resting-thumb dead zone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEAD, LOOK_GAIN, RUN_PUSH, STICK_R, intent, type Pad } from '../origins/preview/sticks.ts';

const pad = (dx: number, dy: number): Pad => ({ x0: 100, y0: 300, x: 100 + dx, y: 300 + dy });   // dy < 0 is a push UP the screen
const NONE = { forward: 0, strafe: 0, turn: 0, pitch: 0, running: false };

test('no touch, or a resting thumb, is no intent', () => {
  assert.deepEqual(intent(null, null), NONE);
  assert.deepEqual(intent(pad(2, -2), pad(-3, 3)), NONE, `inside the ${DEAD} dead zone`);
});

test('left stick: up walks, down backs off slower, sideways strafes', () => {
  assert.equal(intent(pad(0, -STICK_R / 2), null).forward, 0.5, 'half a push is half a walk');
  assert.equal(intent(pad(0, -STICK_R), null).forward, 1, 'the rim is a full walk');
  assert.ok(Math.abs(intent(pad(0, STICK_R), null).forward - -0.6) < 1e-9, 'backward is capped at 0.6');
  assert.ok(intent(pad(STICK_R, 0), null).strafe > 0, 'right is +strafe');
  assert.ok(intent(pad(-STICK_R, 0), null).strafe < 0, 'left is -strafe');
});

test('pushed well past the rim, forward RUNS (the Pit\'s deliberate push); never on the rim and never backwards', () => {
  const rim = intent(pad(0, -STICK_R * (RUN_PUSH - 0.05)), null);
  assert.equal(rim.running, false); assert.equal(rim.forward, 1);
  const run = intent(pad(0, -STICK_R * (RUN_PUSH + 0.1)), null);
  assert.equal(run.running, true); assert.equal(run.forward, 2);
  const back = intent(pad(0, STICK_R * 2), null);
  assert.equal(back.running, false, 'a long pull back is not a run');
  assert.ok(back.forward < 0 && back.forward >= -0.6);
});

test('right stick: right turns right (negative turn, like key D), up tilts the camera up, and it never moves the hero', () => {
  const r = intent(null, pad(STICK_R, -STICK_R));
  assert.equal(r.turn, -LOOK_GAIN); assert.equal(r.pitch, LOOK_GAIN); assert.equal(r.forward, 0);
  const l = intent(null, pad(-STICK_R, STICK_R));
  assert.equal(l.turn, LOOK_GAIN); assert.equal(l.pitch, -LOOK_GAIN);
  assert.equal(intent(null, pad(10 * STICK_R, 0)).turn, -LOOK_GAIN, 'turn is clamped to a full push');
  assert.equal(LOOK_GAIN, 0.5, 'Dom: the look stick was twice too quick');
});

test('both thumbs at once combine into one intent', () => {
  const both = intent(pad(0, -STICK_R), pad(-STICK_R / 2, 0));
  assert.equal(both.forward, 1); assert.equal(both.turn, 0.5 * LOOK_GAIN);
});

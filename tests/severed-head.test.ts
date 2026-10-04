import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { launchSeveredHead, stepSeveredHead } from '../src/severed-head.ts';

const head = (axisHeading = 0, killHeading = Math.PI / 2, y = 1.6) => {
  const group = new Group(); group.position.set(0, y, 0);
  return launchSeveredHead(group, 0.11, { x: Math.sin(axisHeading), z: Math.cos(axisHeading) }, killHeading);
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('the pop: a short lateral fall off the killer→fallen axis, spinning about the killing blow', () => {
  const h = head(0, Math.PI / 2);   // axis along +z: the lateral (−axis.z, ·, axis.x) is −x
  assert.deepEqual(h.velocity.toArray().map(v => +v.toFixed(9)), [-1.1, 1.8, 0]);
  assert.ok(near(h.spin.length(), 9) && near(h.spin.x, 0) && near(h.spin.z, -9), 'spin axis is the blow heading, 9 rad/s');
  assert.equal(h.radius, 0.11); assert.equal(h.resting, false);
});

test('flight: gravity at 12 m/s², the spin turns the head, a hard landing bounces at 0.28 with 0.68 of its run kept', () => {
  const h = head();
  const q0 = h.group.quaternion.clone();
  stepSeveredHead(h, 1 / 60);
  assert.ok(near(h.velocity.y, 1.8 - 12 / 60), 'gravity');
  assert.ok(near(h.group.position.y, 1.6 + h.velocity.y / 60), 'position integrates the new velocity');
  assert.ok(h.group.quaternion.angleTo(q0) > 0.1, 'the head turns while it spins');
  // Drive it into the ground fast enough to bounce.
  h.group.position.y = 0.05; h.velocity.set(-1, -3, 0);
  stepSeveredHead(h, 1 / 60);
  assert.equal(h.group.position.y, h.radius, 'never below the ground');
  const vyAfter = -(-3 - 12 / 60) * 0.28;
  assert.ok(near(h.velocity.y, vyAfter) && near(h.velocity.x, -0.68), 'bounce: y reflected at 0.28, run damped to 0.68');
  assert.equal(h.resting, false);
});

test('roll: a soft landing kills the vertical, friction decays the run (1 − 2.1 dt), spin follows the roll, and the head rests under 0.05 m/s', () => {
  const h = head();
  h.group.position.y = 0.05; h.velocity.set(1, -0.5, 0);
  stepSeveredHead(h, 1 / 60);
  assert.equal(h.velocity.y, 0, 'soft landing: no bounce');
  assert.ok(near(h.velocity.x, 1 - 2.1 / 60), 'rolling friction: the run decays by 1 − 2.1 dt');
  assert.ok(near(h.spin.z, -h.velocity.x / h.radius) && near(h.spin.x, 0), 'rolling without slipping: ω = v / r');
  let steps = 0;
  while (!h.resting && steps++ < 10_000) stepSeveredHead(h, 1 / 60);
  assert.ok(h.resting, 'friction brings it to rest');
  assert.ok(Math.hypot(h.velocity.x, h.velocity.z) <= 0.05 + 1e-9);
  const at = h.group.position.clone(), q = h.group.quaternion.clone();
  stepSeveredHead(h, 1 / 60);
  assert.ok(h.group.position.equals(at) && h.group.quaternion.equals(q), 'a resting head does not move');
  const frozen = head(); const p = frozen.group.position.clone();
  stepSeveredHead(frozen, 0);
  assert.ok(frozen.group.position.equals(p) && new Vector3(-1.1, 1.8, 0).equals(frozen.velocity), 'dt 0 (a frozen frame) changes nothing');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, initialState, RADIUS, STEP, TARGET, wrapAngle } from '../src/sim.ts';

test('one second walks three metres; diagonals cannot move faster', () => {
  for (const input of [{ x: 1, z: 0 }, { x: 1, z: 1 }, { x: 100, z: 100 }]) {
    let state = { ...initialState(), x: 0, z: 0 };
    for (let tick = 0; tick < 60; tick++) state = advance(state, { ...input, yaw: 0, run: false });
    assert.ok(Math.abs(Math.hypot(state.x, state.z) - 3) < 1e-10);
  }
});
test('sprint, analog input and camera-relative movement have explicit behavior', () => {
  const state = { ...initialState(), z: 0 };
  assert.ok(Math.abs(advance(state, { x: 1, z: 0, yaw: 0, run: true }).x - 5.2 * STEP) < 1e-12);
  assert.ok(Math.abs(advance(state, { x: 0.5, z: 0, yaw: 0, run: false }).x - 1.5 * STEP) < 1e-12);
  const rotated = advance(state, { x: 0, z: -1, yaw: Math.PI / 2, run: false });
  assert.ok(Math.abs(rotated.x + 3 * STEP) < 1e-12);
  assert.ok(Math.abs(rotated.z) < 1e-12);
});
test('idle does not mutate caller state and rejects non-finite inputs', () => {
  const state = Object.freeze(initialState());
  for (const input of [{ x: 0, z: 0, yaw: 0 }, { x: NaN, z: 1, yaw: 0 }, { x: 1, z: 0, yaw: Infinity }]) {
    assert.deepEqual(advance(state, { ...input, run: false }), state);
  }
});
test('seeded randomized input replay stays bounded, separated and reproducible', () => {
  let seed = 7391;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const inputs = Array.from({ length: 20000 }, () => ({ x: random() * 2 - 1, z: random() * 2 - 1, yaw: random() * Math.PI * 2, run: random() > 0.5 }));
  const replay = () => inputs.reduce((state, input) => {
    const next = advance(state, input);
    assert.ok(Number.isFinite(next.x + next.z + next.heading));
    assert.ok(Math.hypot(next.x, next.z) <= RADIUS + 1e-10);
    assert.ok(Math.hypot(next.x - TARGET.x, next.z - TARGET.z) >= 0.85 - 1e-10);
    return next;
  }, initialState());
  assert.deepEqual(replay(), replay());
});
test('sustained input cannot leave arena or enter the target', () => {
  for (const direction of [-1, 1]) {
    let state = initialState();
    for (let i = 0; i < 5000; i++) state = advance(state, { x: 0, z: direction, yaw: 0, run: true });
    assert.ok(Math.hypot(state.x, state.z) <= RADIUS + 1e-10);
    assert.ok(Math.hypot(state.x - TARGET.x, state.z - TARGET.z) >= 0.85 - 1e-10);
  }
});
test('heading interpolation takes short path across wraparound', () => {
  assert.ok(Math.abs(wrapAngle(-Math.PI + 0.1 - (Math.PI - 0.1)) - 0.2) < 1e-10);
});

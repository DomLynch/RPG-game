import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice, SWORD, type Practice } from '../src/combat.ts';
import { TARGET } from '../src/sim.ts';
const idle = { x: 0, z: 0, yaw: 0, run: false };
function tick(state: Practice, count: number) { for (let i = 0; i < count; i++) state = stepPractice(state, idle, false, false); return state; }
function ready(distance = 1.2, heading = Math.PI): Practice {
  return { ...initialPractice(), phase: 'ready', fighter: { x: 0, z: TARGET.z + distance, heading, distance: 0 } };
}

test('drawing cannot damage and movement stops during committed actions', () => {
  const start = initialPractice();
  const drawing = stepPractice(start, { ...idle, z: -1 }, true, true);
  assert.equal(drawing.phase, 'draw'); assert.deepEqual(drawing.fighter, start.fighter);
  assert.equal(tick(drawing, SWORD.draw - 1).phase, 'draw');
  assert.equal(tick(drawing, SWORD.draw).phase, 'ready');
  assert.equal(tick(drawing, 200).health, 100);
  const before = ready(), attacking = stepPractice(before, { ...idle, x: 1 }, true, false);
  assert.deepEqual(attacking.fighter, before.fighter);
});

test('one strike damages exactly once on contact, never on input or repeated requests during recovery', () => {
  const attacking = stepPractice(ready(), idle, true, false);
  assert.equal(attacking.health, 100);
  const before = tick(attacking, SWORD.contact - 1); assert.equal(before.health, 100);
  const hit = stepPractice(before, idle, true, false);
  assert.equal(hit.health, 75); assert.equal(hit.hits, 1); assert.equal(hit.result, 'hit');
  let state = hit;
  while (state.phase === 'attack') state = stepPractice(state, idle, true, false);
  assert.equal(state.health, 75); assert.equal(state.hits, 1);
});

test('range and facing cause real misses; lock fixes aim only when a strike begins', () => {
  for (const state of [ready(SWORD.reach + .001), ready(1.2, 0)]) {
    const result = tick(stepPractice(state, idle, true, false), SWORD.contact);
    assert.equal(result.health, 100); assert.equal(result.result, 'miss');
  }
  assert.equal(tick(stepPractice(ready(1.2, 0), idle, true, true), SWORD.contact).health, 75);
  assert.equal(tick(stepPractice(ready(SWORD.reach), idle, true, false), SWORD.contact).health, 75);
});

test('four confirmed hits defeat the warden; later inputs cannot deal extra damage', () => {
  let state = ready();
  for (let i = 0; i < 4; i++) state = tick(stepPractice(state, idle, true, false), SWORD.recovery);
  assert.equal(state.health, 0); assert.equal(state.hits, 4);
  for (let i = 0; i < 200; i++) state = stepPractice(state, idle, true, true);
  assert.equal(state.health, 0); assert.equal(state.hits, 4);
});

test('seeded movement and strike sequences replay identically without mutating previous state', () => {
  let seed = 71;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const inputs = Array.from({ length: 10000 }, () => ({ input: { x: random() * 2 - 1, z: random() * 2 - 1, yaw: random() * 6, run: random() < .2 }, strike: random() < .1, locked: random() < .5 }));
  const run = () => inputs.reduce((state, frame) => {
    const before = structuredClone(state); Object.freeze(state.fighter); Object.freeze(state);
    const next = stepPractice(state, frame.input, frame.strike, frame.locked);
    assert.deepEqual(state, before); assert.ok(next.health >= 0 && next.health <= 100);
    return next;
  }, initialPractice());
  assert.deepEqual(run(), run());
});

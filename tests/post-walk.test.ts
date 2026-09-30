import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE_REACH, WALK, reachAt, walk, walkerFrom } from '../src/post-walk.ts';
import { LAYOUT } from '../src/arena.ts';
import { RADIUS } from '../src/sim.ts';

// docs/pit-design.md §9 (D2): after a win the stick walks the winner round the sand; the gate's arc lets him on to the wall line.
const UP = { x: 0, z: -1 };   // input.ts: z −1 is the stick pushed forward
const toGate = (w: { x: number; z: number }) => Math.atan2(w.x - Math.sin(LAYOUT.gate) * LAYOUT.wall.inner, w.z - Math.cos(LAYOUT.gate) * LAYOUT.wall.inner);   // camera.ts gate yaw: the eye behind him on the line from the gate
const run = (w: ReturnType<typeof walkerFrom>, move: { x: number; z: number }, yaw: (w: ReturnType<typeof walkerFrom>) => number, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) w = walk(w, move, yaw(w), 1 / 60);
  return w;
};

test('the walk: a full stick walks at WALK, a half stick at half, no stick stands him still', () => {
  const start = walkerFrom({ x: 0, z: 4, heading: Math.PI });
  const full = walk(start, UP, 0, 0.5), half = walk(start, { x: 0, z: -0.5 }, 0, 0.5), none = walk(start, { x: 0, z: 0 }, 0, 0.5);
  assert.ok(Math.abs(full.speed - WALK) < 1e-9 && Math.abs(Math.hypot(full.x - start.x, full.z - start.z) - WALK * 0.5) < 1e-9, 'full stick: WALK m/s');
  assert.ok(Math.abs(half.speed - WALK / 2) < 1e-9, 'half stick: half speed');
  assert.deepEqual([none.x, none.z, none.speed], [start.x, start.z, 0], 'no stick: he stands');
});

test('the walk: with the gate camera\'s yaw, the stick pushed up walks him to the gate and into the passage, stopping at the wall line', () => {
  const w = run(walkerFrom({ x: 1.5, z: 3, heading: Math.PI }), UP, toGate, 12);
  const r = Math.hypot(w.x, w.z), angle = Math.atan2(w.x, w.z);
  assert.ok(r > RADIUS + 1, `past the sand circle into the passage (r ${r.toFixed(2)})`);
  assert.ok(r <= GATE_REACH + 1e-9 && GATE_REACH - r < WALK / 60, `held at the wall line, within one step (r ${r.toFixed(3)} vs ${GATE_REACH})`);
  assert.ok(Math.abs(Math.atan2(Math.sin(angle - LAYOUT.gate), Math.cos(angle - LAYOUT.gate))) * r < LAYOUT.gateWidth / 2, 'inside the gate arc');
  assert.ok(w.speed < 1e-9, 'a walk into the wall stands him still, never treading on the spot');
});

test('the walk: outside the gate arc he stops at the sand circle, sliding round it', () => {
  const east = run(walkerFrom({ x: 0, z: 0, heading: 0 }), { x: 1, z: 0 }, () => 0, 8);   // yaw 0: stick right walks +x, away from the gate at −z
  assert.ok(Math.abs(Math.hypot(east.x, east.z) - RADIUS) < 1e-6, 'held at RADIUS');
  assert.equal(reachAt(Math.PI / 2, RADIUS), RADIUS, 'the sand circle at the side');
  assert.equal(reachAt(LAYOUT.gate, RADIUS), GATE_REACH, 'the wall line through the arc');
});

test('the walk: in the passage a sideways push never snaps him back to the circle', () => {
  let w = walkerFrom({ x: 0, z: -10, heading: Math.PI });
  const before = Math.hypot(w.x, w.z);
  for (let i = 0; i < 120; i++) {
    const next = walk(w, { x: 1, z: 0 }, 0, 1 / 60);   // yaw 0: stick right is +x, across the passage
    assert.ok(Math.hypot(next.x - w.x, next.z - w.z) <= WALK / 60 + 1e-9, `step ${i}: no jump`);
    w = next;
  }
  assert.ok(Math.hypot(w.x, w.z) > RADIUS && Math.abs(w.z - -10) < 1e-9, `he stays in the passage at the same depth (${w.x.toFixed(2)}, ${w.z.toFixed(2)}; from r ${before})`);
});

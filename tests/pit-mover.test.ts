// The Pit's walk (src/pit/mover.ts): the stick means what it means in the fight, the room bounds him, and the zone picks the camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, EYE_BACK, EYE_GAP, walk, WALK, yawOf, zoneAt } from '../src/pit/mover.ts';
import { advance } from '../src/sim.ts';

const still = { x: 0, z: 0, heading: 0, speed: 0 };

test('the stick turns by the camera yaw exactly as the fight does (sim.ts advance)', () => {
  for (const yaw of [0, 0.7, -2.1, Math.PI]) for (const move of [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: -0.6, z: 0.3 }]) {
    const pit = walk(still, move, yaw, 0.1), fight = advance({ x: 0, z: 0, heading: 0, distance: 0 }, { ...move, yaw, run: false }, { x: 100, z: 100 });   // the foe far off: direction only
    const angle = (a: { x: number; z: number }) => Math.atan2(a.x, a.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(angle(pit) - angle(fight)), Math.cos(angle(pit) - angle(fight)))) < 1e-9, `yaw ${yaw} move ${JSON.stringify(move)}`);
  }
});

test('a full stick walks at WALK; no stick stands still; the room bounds him and a wall stops his gait', () => {
  const w = walk(still, { x: 0, z: -1 }, 0, 0.1);
  assert.ok(Math.abs(w.speed - WALK) < 1e-9);
  assert.equal(walk(w, { x: 0, z: 0 }, 0, 0.1).speed, 0);
  let at = still;
  for (let i = 0; i < 200; i++) at = walk(at, { x: -1, z: 0 }, 0, 0.1);
  assert.equal(at.x, BOUNDS.x[0]);
  assert.equal(at.speed, 0, 'pressed into the rack he stands, not treads');
  for (let i = 0; i < 200; i++) at = walk(at, { x: 0, z: 1 }, 0, 0.1);
  assert.ok(EYE_BACK - at.z >= EYE_GAP - 1e-9, 'backed to the ramp he stays in front of the camera, not inside its lens');
});

test('zones: rack left, trophies right, gate at the far wall\'s middle, open floor between', () => {
  assert.equal(zoneAt(-3, 0), 'rack');
  assert.equal(zoneAt(2.5, 1), 'trophies');
  assert.equal(zoneAt(0, -2), 'gate');
  assert.equal(zoneAt(0, 0.5), null);
  assert.ok(Math.abs(yawOf([0, 1.6, 3], [0, 1.2, -2])) < 1e-12, 'a camera behind on +z looking at -z has yaw 0');
});

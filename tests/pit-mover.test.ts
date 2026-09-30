// The Pit's walk (src/pit/mover.ts): the stick means what it means in the fight, the room bounds him, and the zone picks the camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BOUNDS, EYE_BACK, EYE_GAP, LOOK, orbitEye, walk, WALK, yawOf, zoneAt } from '../src/pit/mover.ts';
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

test('the right-finger look swings the eye round the look point at its distance, dips and rises with the pitch, and stays in the room', () => {
  const look = new THREE.Vector3(0, 1.15, 0), eye = new THREE.Vector3(0, 2.15, 2.5);
  orbitEye(eye, look, Math.PI, 0);
  assert.ok(Math.abs(eye.x) < 1e-9 && Math.abs(eye.z + 2.5) < 1e-9 && eye.y === 2.15, `half a turn puts the eye on the far side at the same distance: ${eye.toArray()}`);
  orbitEye(eye.set(0, 2.15, 2.5), look, Math.PI / 2, 0);
  assert.ok(Math.abs(eye.x - 2.5) < 1e-9 && Math.abs(eye.z) < 1e-9, 'a quarter turn goes to his right');
  orbitEye(eye.set(0, 2.15, 2.5), look, 0, 0.3);
  assert.ok(eye.y > 2.15 && eye.y <= LOOK.eye.y[1], 'a pitch up raises the eye, under the ceiling');
  orbitEye(eye.set(0, 2.15, 2.5), look, 0, -5);
  assert.ok(eye.y >= LOOK.eye.y[0], 'the pitch is clamped: the eye never goes under the floor');
  orbitEye(eye.set(0, 2.15, 2.5), look.set(3, 1.15, 2), Math.PI / 2, 0);
  assert.ok(eye.x <= LOOK.eye.x && eye.z <= LOOK.eye.z[1], `the eye stays inside the room: ${eye.toArray()}`);
});

test('a full drag keeps him framed: at every yaw the eye looks at him from its distance and he sits at the frame\'s centre', () => {
  const him = new THREE.Vector3(-3.0, 1.15, 1.2), camera = new THREE.PerspectiveCamera(62, 375 / 812);   // at the rack, a phone
  for (let i = 0; i <= 24; i++) {
    const eye = orbitEye(new THREE.Vector3(him.x - 1.6, 2.15, him.z + 2.5), him, i * Math.PI / 12, 0.2);
    camera.position.copy(eye); camera.lookAt(him); camera.updateMatrixWorld();
    const head = him.clone().setY(1.75).project(camera), feet = him.clone().setY(0).project(camera);
    assert.ok(Math.abs(head.x) < 0.35 && Math.abs(feet.x) < 0.35, `yaw ${i}: he is centred (${head.x.toFixed(2)}, ${feet.x.toFixed(2)})`);
    assert.ok(head.y < 1 && feet.y > -1, `yaw ${i}: head and feet are in frame (${head.y.toFixed(2)}, ${feet.y.toFixed(2)})`);
    assert.ok(eye.distanceTo(him) > 1.0, `yaw ${i}: the eye is not inside him (${eye.distanceTo(him).toFixed(2)} m)`);
  }
});

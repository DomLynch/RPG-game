// First person (the ☰ menu's View setting, Dom 2026-10-17): with `fp` on the follow state the camera IS the hero's head: it stands where the rows say, looks along the heading, never eases (a lagging eye makes a phone sick), bobs only while walking
// and only when the setting allows, and with `fp` absent the camera is exactly what it was. The rows come from fx-rows.json (fp.*), read by the page; here the camera is given plain numbers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFollowCamera, type FirstPerson, type FollowState } from '../src/fight/follow-camera.ts';

const FP: FirstPerson = { eye: 1.6, fwd: 0.14, tilt: 6, down: 1.2, fovAdd: 5, bobAmp: 0.03, bobStep: 8, bobSpeedCap: 3.2, bobJumpM: 2, bobWalkMps: 0.3, bobFade: 8 };
const at = (x: number, z: number, heading = 0, fp?: FirstPerson): FollowState => ({ x, z, heading, pitch: 0, groundY: 0.5, ...(fp ? { fp } : {}) });

test('first person puts the eye at the head, ahead of the centre, looking along the heading', () => {
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c);
  f.update(1 / 60, at(3, 4, Math.PI / 2, { ...FP, bobAmp: 0 }));   // heading +x
  assert.ok(Math.abs(c.position.x - (3 + FP.fwd)) < 1e-9 && Math.abs(c.position.z - 4) < 1e-9, `ahead of the centre along the heading: ${c.position.toArray()}`);
  assert.ok(Math.abs(c.position.y - (0.5 + FP.eye)) < 1e-9, 'eye height above the ground under him');
  const dir = c.getWorldDirection(new THREE.Vector3()); assert.ok(dir.x > 0.99 && dir.y < 0 && dir.y > -0.2, `looking along +x with a slight look-down: ${dir.toArray()}`);
  assert.equal(f.view.fov, FP.fovAdd); assert.equal(f.view.zoom, 1); assert.equal(f.view.shiftY, 0);
});

test('it never eases: the eye is on the head on the first frame and on the frame after a long move', () => {
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c);
  f.update(1 / 60, at(0, 0, 0, FP)); f.update(1 / 60, at(30, 30, 0, FP));
  assert.ok(Math.abs(c.position.x - (30 + 0)) < 1e-9 && Math.abs(c.position.z - (30 + FP.fwd)) < 1e-9, 'no lag behind the hero');
});

test('head bob: none standing still, a rise and fall while walking, none when the setting is off, none for a respawn jump', () => {
  const heights = (fp: FirstPerson, speed: number, seconds: number) => {
    const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); let z = 0, lo = Infinity, hi = -Infinity;
    for (let t = 0; t < seconds * 60; t++) { z += speed / 60; f.update(1 / 60, at(0, z, 0, fp)); lo = Math.min(lo, c.position.y); hi = Math.max(hi, c.position.y); }
    return hi - lo;
  };
  assert.ok(heights(FP, 0, 2) < 1e-9, 'standing still: no bob');
  assert.ok(heights(FP, 2, 3) > FP.bobAmp, 'walking: it rises and falls');
  assert.ok(heights({ ...FP, bobAmp: 0 }, 2, 3) < 1e-9, 'the setting off: no bob');
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); f.update(1 / 60, at(0, 0, 0, FP)); f.update(1 / 60, at(0, 50, 0, FP));
  assert.ok(Math.abs(c.position.y - (0.5 + FP.eye)) < 1e-9, 'a jump of more than bobJumpM in one frame is not a step');
});

test('with no fp the camera is exactly the walking camera (the Pit and every listed zone are untouched)', () => {
  const a = new THREE.PerspectiveCamera(), b = new THREE.PerspectiveCamera(), fa = createFollowCamera(a), fb = createFollowCamera(b);
  for (let t = 0; t < 120; t++) { fa.update(1 / 60, at(1, 2, 0.3)); fb.update(1 / 60, at(1, 2, 0.3)); }
  assert.ok(a.position.distanceTo(b.position) < 1e-12 && a.position.y > 0.5 + FP.eye, 'the default over-the-shoulder camera stands higher and further back than the head');
});

// A swing moves the view (the arm's kick) through the engine's camera: a lean rolls it, a lunge carries it along the heading, a zero kick moves nothing. (The page used to place the camera itself: the K7 camera row.)
test('kick: a lean rolls the view, a lunge moves it along the heading, no kick moves nothing', () => {
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c);
  f.update(1 / 60, { x: 0, z: 0, heading: 0, pitch: 0, groundY: 0, fp: FP });
  const before = c.position.clone(), turned = c.quaternion.clone();
  f.kick({ lat: 0, fwd: 0 }, 0, { roll: 1, yaw: 1, lunge: 1 });
  assert.ok(c.position.distanceTo(before) < 1e-12 && c.quaternion.angleTo(turned) < 1e-12, 'no kick: nothing moves');
  f.kick({ lat: 0, fwd: 1 }, 0, { roll: 1, yaw: 1, lunge: 0.5 });
  assert.ok(Math.abs(c.position.z - before.z - 0.5) < 1e-9 && Math.abs(c.position.x - before.x) < 1e-9, 'a lunge of 1 at scale 0.5 carries the view 0.5 m ahead (heading 0 = +z)');
  const rolled = c.quaternion.clone(); f.kick({ lat: 0.4, fwd: 0 }, 0, { roll: 1, yaw: 0, lunge: 0 });
  assert.ok(c.quaternion.angleTo(rolled) > 0.3, 'a lean rolls the view');
});

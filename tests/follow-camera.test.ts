// The world follow camera (src/fight/follow-camera.ts): the numbers main.ts used inline before it moved, pinned; a passage is a parameter a zone supplies.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFollowCamera, inPassage } from '../src/fight/follow-camera.ts';

const S = { x: 3, z: 10, heading: Math.PI / 2, pitch: 0, groundY: 0.4 };
const cam = () => new THREE.PerspectiveCamera();

test('the open walk: 5.2 behind and 2.7 above (plus the hills), looking 3 m ahead, snapped on the first frame', () => {
  const c = cam(); createFollowCamera(c).update(1 / 60, S);
  assert.ok(Math.abs(c.position.x - (3 - 5.2)) < 1e-9 && Math.abs(c.position.y - 3.1) < 1e-9 && Math.abs(c.position.z - 10) < 1e-6);
  const dir = new THREE.Vector3(); c.getWorldDirection(dir); assert.ok(dir.x > 0.9, 'looks along the heading');
});

test('the passage tightens to 3.4 / 2.1 only where the zone says; no passage, no tightening (Zone 2 passes none)', () => {
  const passage = { zMax: -9, zMin: -30, halfWidth: 20, back: 3.4, up: 2.1 }, at = { ...S, x: 0, z: -15, heading: 0 };
  const tight = cam(), open = cam();
  createFollowCamera(tight, { passage }).update(1 / 60, at); createFollowCamera(open).update(1 / 60, at);
  assert.ok(Math.abs(tight.position.z - (-15 - 3.4)) < 1e-9 && Math.abs(tight.position.y - 2.5) < 1e-9);
  assert.ok(Math.abs(open.position.z - (-15 - 5.2)) < 1e-9 && Math.abs(open.position.y - 3.1) < 1e-9);
  assert.equal(inPassage(passage, 25, -15), false, 'past the half width it is open ground');
  assert.equal(inPassage({ zMax: -9, zMin: -30, back: 3.4, up: 2.1 }, 25, -15), true, 'no half width: any x');
});

test('the camera eases to the eye and snap() restarts at it; the stick pitch lowers the eye and raises the gaze', () => {
  const c = cam(), f = createFollowCamera(c); f.update(1 / 60, S);
  const first = c.position.clone(); f.update(0.5, { ...S, x: 13 });
  assert.ok(c.position.x > first.x && c.position.x < 13 - 5.2 + 1e-9 + 5.2, 'moved toward the new eye, not onto it');
  f.snap(); f.update(0.5, { ...S, x: 13 }); assert.ok(Math.abs(c.position.x - (13 - 5.2)) < 1e-9, 'snap puts it on the eye');
  const p = cam(); createFollowCamera(p).update(1 / 60, { ...S, pitch: 1 }); assert.ok(Math.abs(p.position.y - (3.1 - 0.9)) < 1e-9);
});

// K7 camera row: a page under origins/ never places the camera itself; the engine's follow/duel camera does.
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : /\.(ts|mjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(d, e.name)] : []);
const PLACES = /\bcamera\.(position\.(set|copy|lerp|add\w*)|lookAt)\s*\(/;
test('K7: nothing under origins/ places the camera (camera.position / lookAt): it goes through src/fight', () => {
  assert.deepEqual(walk('origins').filter((f) => PLACES.test(readFileSync(f, 'utf8'))), []);
  assert.ok(PLACES.test('camera.position.copy(a); camera.lookAt(b)'), 'the detector sees a placed camera (mutation)');
});

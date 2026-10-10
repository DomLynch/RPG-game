// The world follow camera (src/fight/follow-camera.ts): the numbers main.ts used inline before it moved, pinned; a passage is a parameter a zone supplies.
import assert from 'node:assert/strict';
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

test('Zone 1 carries the passage Zone 1 had in code (PASSAGE.to - 1.5, 3.4 / 2.1); Zone 2 carries none', async () => {
  const { loadZone } = await import('../origins/zones/loader.ts'), { PASSAGE } = await import('../origins/preview/exchange.ts');
  const one = loadZone('1'), two = loadZone('2'), p = one.fields!['camera.passage'] as { zMax: number; zMin: number; halfWidth: number; back: number; up: number };
  assert.ok(one.set?.includes('camera.passage') && Math.abs(p.zMin - (PASSAGE.to - 1.5)) < 1e-9 && p.zMax === -9 && p.halfWidth === 20 && p.back === 3.4 && p.up === 2.1);
  assert.ok(!two.set?.includes('camera.passage'), 'Zone 2 sets none');
});

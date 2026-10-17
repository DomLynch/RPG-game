// The combat camera (Dom 2026-10-17: in a fight the thumb buttons hid the hero and the foe was too close): the follow camera eases into a zone's combat framing and back, never cuts, and does nothing outside a fight.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFollowCamera, type CombatCam } from '../src/fight/follow-camera.ts';

const S = { x: 0, z: 0, heading: 0, pitch: 0, groundY: 0 };
const CAM: CombatCam = {
  label: 'test',
  portrait: { back: 6, up: 3, side: 0, ahead: 2, lookY: 1, mid: 0.5, perSep: 0.5, perSize: 1, shiftY: 0.1, fov: 4, zoom: 0.9 },
  landscape: { back: 5, up: 2.5, side: 0, ahead: 2, lookY: 1, mid: 0.5, zoom: 0.8 },
};
const run = (f: ReturnType<typeof createFollowCamera>, seconds: number, input?: Parameters<typeof f.update>[2]) => { for (let t = 0; t < seconds * 60; t++) f.update(1 / 60, S, input); };

test('outside a fight nothing changes: no input, or input with no foe, is the walking camera exactly', () => {
  const a = new THREE.PerspectiveCamera(), b = new THREE.PerspectiveCamera(), fa = createFollowCamera(a), fb = createFollowCamera(b);
  run(fa, 2); run(fb, 2, { cam: CAM, portrait: true, foe: null });
  assert.ok(a.position.distanceTo(b.position) < 1e-9, 'the same eye'); assert.deepEqual(fb.view, { shiftY: 0, fov: 0, zoom: 1 }); assert.equal(fb.fighting(), 0);
});

test('a fight eases the camera back and up, never cuts, and returns when it ends', () => {
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 2);
  const walk = c.position.clone(), foe = { x: 0, z: 3, size: 1.8 };
  f.update(1 / 60, S, { cam: CAM, portrait: false, foe }); assert.ok(c.position.distanceTo(walk) < 0.2, 'the first frame of a fight is not a jump');
  run(f, 4, { cam: CAM, portrait: false, foe });
  assert.ok(f.fighting() > 0.99 && c.position.z < walk.z - 0.5 && c.position.y > walk.y, `further back and higher in the fight: ${c.position.toArray()} vs ${walk.toArray()}`);
  run(f, 4, { cam: CAM, portrait: false, foe: null });
  assert.ok(f.fighting() === 0 && c.position.distanceTo(walk) < 1e-3, 'back to the walking camera when the fight ends');
});

test('a bigger foe and a wider gap push the camera back (perSize, perSep); the lens extras follow the screen shape', () => {
  const at = (foe: { x: number; z: number; size: number }, portrait: boolean) => { const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 6, { cam: CAM, portrait, foe }); return { z: c.position.z, view: { ...f.view } }; };
  const small = at({ x: 0, z: 3, size: 1.8 }, true), big = at({ x: 0, z: 3, size: 6 }, true), far = at({ x: 0, z: 9, size: 1.8 }, true);
  assert.ok(big.z < small.z - 3, `a 6 m foe stands the camera back more than a man: ${big.z} vs ${small.z}`); assert.ok(far.z < small.z - 2, 'and a wider gap does too');
  assert.ok(Math.abs(small.view.shiftY - 0.1) < 1e-3 && Math.abs(small.view.fov - 4) < 1e-3 && Math.abs(small.view.zoom - 0.9) < 1e-3, 'portrait lifts the picture off the thumbs, opens the lens, and zooms');
  const wide = at({ x: 0, z: 3, size: 1.8 }, false); assert.ok(wide.view.shiftY === 0 && Math.abs(wide.view.zoom - 0.8) < 1e-3, 'landscape has its own numbers');
});

test('the player zoom step scales the combat framing (Near < Mid < Far)', () => {
  const at = (zoom: number) => { const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 6, { cam: CAM, portrait: false, foe: { x: 0, z: 3, size: 1.8 }, zoom }); return c.position.z; };
  assert.ok(at(1.6) < at(1) && at(1) < at(0.8), 'a bigger step stands further back (more negative z)');
});

test('the Test Zone offers three combat cameras as data, each complete; the real zones offer none', async () => {
  process.env.VITE_UNLISTED_ZONES = '1'; (globalThis as { location?: unknown }).location = { pathname: '/zone/90/', search: '' };   // the sandbox page, as tests/test-zone.test.ts opens it
  try {
    const { loadZone } = await import('../origins/zones/loader.ts'), { zoneCombatCams, zoneCombatPreset } = await import('../origins/world/goblin-field-rules.ts');
    const zone = loadZone('90'), cams = zoneCombatCams(zone);
    assert.deepEqual(Object.keys(cams).sort(), ['1', '2', '3'], 'three options'); assert.equal(zoneCombatPreset(zone), '', 'none in use until Dom picks one');
    for (const [id, cam] of Object.entries(cams)) for (const shape of [cam.portrait, cam.landscape]) assert.ok(shape.back > 0 && shape.up > 0 && (shape.shiftY ?? 0) >= 0 && (shape.shiftY ?? 0) < 0.4, `${id}: a framing that is a camera`);
    assert.ok(cams['3']!.zoom && cams['3']!.zoom.steps.length === cams['3']!.zoom.labels.length && cams['3']!.zoom.start < cams['3']!.zoom.steps.length, 'option 3 is the one with a player zoom');
    for (const id of ['1', '2', '3', '4']) assert.deepEqual(zoneCombatCams(loadZone(id)), {}, `zone ${id} has no combat camera`);
  } finally { delete (globalThis as { location?: unknown }).location; delete process.env.VITE_UNLISTED_ZONES; }
});

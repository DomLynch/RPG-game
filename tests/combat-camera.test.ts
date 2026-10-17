// The combat camera (Dom 2026-10-17: in a fight the thumb buttons hid the hero and the foe was too close): the follow camera eases into a zone's combat framing and back, never cuts, and does nothing outside a fight.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFollowCamera, type CombatCam } from '../src/fight/follow-camera.ts';

const S = { x: 0, z: 0, heading: 0, pitch: 0, groundY: 0 };
const CAM: CombatCam = {
  label: 'test', ease: { in: 3, out: 1.8 },
  portrait: { back: 8, up: 4, side: 0, ahead: 2, lookY: 1, mid: 0.5, perSep: 0.5, perSize: 1, sizeFrom: 1.8, shiftY: 0.1, fov: 4, zoom: 0.9 },   // further back and higher than the default walking camera (5.2 / 2.7)
  landscape: { back: 7, up: 3.5, side: 0, ahead: 2, lookY: 1, mid: 0.5, zoom: 0.8 },
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
  run(f, 8, { cam: CAM, portrait: false, foe: null });   // the exit is slower than the entry (ease.out < ease.in)
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

test('the fit may not change faster than fitRate: a lunging foe does not pump the camera', () => {
  const cam: CombatCam = { ...CAM, portrait: { ...CAM.portrait, fitRate: 1, mid: 0, perSep: 1, perSize: 0, zoom: 1 }, landscape: CAM.landscape };
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 3, { cam, portrait: true, foe: { x: 0, z: 2, size: 1.8 } });
  const before = c.position.z; f.update(1 / 60, S, { cam, portrait: true, foe: { x: 0, z: 12, size: 1.8 } });   // the foe jumps 10 m away in one frame
  assert.ok(Math.abs(c.position.z - before) < 0.2, `the camera did not jump: ${before} -> ${c.position.z}`);
  run(f, 12, { cam, portrait: true, foe: { x: 0, z: 12, size: 1.8 } }); assert.ok(c.position.z < before - 5, 'and it does follow once given time');
});

test('minBack and maxBack: never closer than the floor; past the cap the camera rises instead of coming in', () => {
  const cam = (back: number, extra: object): CombatCam => ({ ...CAM, portrait: { ...CAM.portrait, back, mid: 0, perSep: 0, perSize: 0, zoom: 1, ...extra }, landscape: CAM.landscape });
  const at = (cm: CombatCam) => { const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 6, { cam: cm, portrait: true, foe: { x: 0, z: 3, size: 1.8 } }); return { z: c.position.z, y: c.position.y }; };
  const floored = at(cam(2, { minBack: 4 })), free = at(cam(2, {})); assert.ok(floored.z < free.z - 1.5 && Math.abs(floored.z + 4) < 0.05, `floor holds the camera at 4 m back: ${floored.z}`);
  const capped = at(cam(20, { maxBack: 9 })), uncapped = at(cam(20, {})); assert.ok(Math.abs(capped.z + 9) < 0.05 && capped.y > uncapped.y - 6 && capped.y > at(cam(9, {})).y, 'the cap holds the distance and gives the lost metres to height');
});

test('the exit eases slower than the entry, so a kill does not snap the view', () => {
  const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 0.5, { cam: CAM, portrait: false, foe: { x: 0, z: 3, size: 1.8 } }); const enteredIn = f.fighting();
  run(f, 4, { cam: CAM, portrait: false, foe: { x: 0, z: 3, size: 1.8 } }); run(f, 0.5, { cam: CAM, portrait: false, foe: null }); const leftIn = 1 - f.fighting();
  assert.ok(enteredIn > leftIn + 0.1, `half a second in goes further (${enteredIn.toFixed(2)}) than half a second out (${leftIn.toFixed(2)})`);
});

test('the shoulder is mirrored by the setting, never by the camera', () => {
  const cam: CombatCam = { ...CAM, portrait: { ...CAM.portrait, side: 0.9, mid: 0 }, landscape: CAM.landscape };
  const at = (flip?: number) => { const c = new THREE.PerspectiveCamera(), f = createFollowCamera(c); run(f, 6, { cam, portrait: true, foe: { x: 0, z: 3, size: 1.8 }, ...(flip ? { flip } : {}) }); return c.position.x; };
  assert.ok(at() > 0.5 && Math.abs(at(-1) + at()) < 1e-6, 'a mirror image about the hero');
});

test('the Test Zone offers four combat cameras as data, each complete; the real zones offer none', async () => {
  process.env.VITE_UNLISTED_ZONES = '1'; (globalThis as { location?: unknown }).location = { pathname: '/zone/90/', search: '' };   // the sandbox page, as tests/test-zone.test.ts opens it
  try {
    const { loadZone } = await import('../origins/zones/loader.ts'), { zoneCombatCams, zoneCombatPreset } = await import('../origins/world/goblin-field-rules.ts');
    const zone = loadZone('90'), cams = zoneCombatCams(zone);
    assert.deepEqual(Object.keys(cams).sort(), ['1', '2', '3'], 'three looks (1 tight over the shoulder, 2 wide auto-fit, 3 elevated), not three numbers');
    assert.ok(Object.values(cams).every((c) => c.ease.out < c.ease.in), 'every exit is slower than its entry');
    for (const id of ['2', '3']) for (const shape of [cams[id]!.portrait, cams[id]!.landscape]) assert.ok(shape.fitRate! > 0 && shape.minBack! > 0 && shape.maxBack! > shape.minBack! && shape.shiftY! > 0, `${id}: the fitting cameras have their speed limit, floor, cap and a lift in both orientations`);
    assert.ok(cams['2']!.zoom && !cams['2']!.portrait.side && cams['1']!.portrait.side, 'option 2 carries the zoom setting; option 1 is the one with a shoulder');
    const pitch = (f: { back: number; up: number; lookY?: number }) => Math.atan2(f.up - (f.lookY ?? 1), f.back) * 180 / Math.PI;   // how steeply down the camera looks at the hero
    assert.ok(pitch(cams['1']!.portrait) < pitch(cams['2']!.portrait) + 1 && pitch(cams['2']!.portrait) < pitch(cams['3']!.portrait) && pitch(cams['3']!.portrait) < 25, 'getting steeper from 1 to 3, but never so steep the skyline is lost (Dom)');
    assert.ok(cams['3']!.portrait.back > cams['2']!.portrait.back && cams['2']!.portrait.back > cams['1']!.portrait.back * 2, 'each stands clearly further back than the one before (twice from 1 to 2)'); assert.equal(zoneCombatPreset(zone), '', 'none in use until Dom picks one');
    for (const [id, cam] of Object.entries(cams)) for (const shape of [cam.portrait, cam.landscape]) assert.ok(shape.back > 0 && shape.up > 0 && (shape.shiftY ?? 0) >= 0 && (shape.shiftY ?? 0) < 0.4, `${id}: a framing that is a camera`);
    assert.ok(cams['2']!.zoom!.steps.length === cams['2']!.zoom!.labels.length && cams['2']!.zoom!.start < cams['2']!.zoom!.steps.length, 'the zoom steps are labelled and the start is one of them');
    for (const id of ['1', '2', '3', '4']) assert.deepEqual(zoneCombatCams(loadZone(id)), {}, `zone ${id} has no combat camera`);
  } finally { delete (globalThis as { location?: unknown }).location; delete process.env.VITE_UNLISTED_ZONES; }
});

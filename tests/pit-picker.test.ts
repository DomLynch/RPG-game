// The Pit's picker (Lead 2026-09-30, PR A): a tap on the canvas is a ray from the Pit camera and picks the nearest of the room's pick
// volumes; the room's volumes cover the rack, the trophy wall and the gate; a pick opens that zone's sheet until he walks; main.ts turns
// a press that never became a drag into the tap and drains it once a frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createPicker } from '../src/pit/picker.ts';
import { buildRoom, FOCUS, POSES } from '../src/pit/room.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import type { Stage } from '../src/pit/stage.ts';

const camera = (from: THREE.Vector3Tuple, at: THREE.Vector3Tuple) => {
  const c = new THREE.PerspectiveCamera(62, 0.46, 0.1, 50);
  c.position.set(...from); c.lookAt(...at); c.updateMatrixWorld();
  return c;
};
// Where a world point lands on the screen, as a tap: the same NDC main.ts computes from the canvas rect.
const tapAt = (c: THREE.Camera, p: THREE.Vector3Tuple) => { const v = new THREE.Vector3(...p).project(c); return { x: v.x, y: v.y }; };

test('the nearest volume on the ray wins; a ray through none picks nothing', () => {
  const c = camera([0, 1, 5], [0, 1, 0]);
  const near = { id: 'near', box: new THREE.Box3(new THREE.Vector3(-1, 0, 1), new THREE.Vector3(1, 2, 2)) };
  const far = { id: 'far', box: new THREE.Box3(new THREE.Vector3(-1, 0, -3), new THREE.Vector3(1, 2, -2)) };
  const pick = createPicker(c, () => [far, near]);
  assert.equal(pick({ x: 0, y: 0 }), 'near', 'both on the ray: the nearer');
  assert.equal(pick(tapAt(c, [0, 1, -2.5])), 'near', 'a tap on the far one still passes through the near one first');
  assert.equal(pick({ x: 0, y: 0.95 }), null, 'the ceiling');
  assert.equal(createPicker(c, () => [far])(tapAt(c, [0, 1, -2.5])), 'far');
});

function stage(): Stage {
  return {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(51, 0.46), renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }),
  };
}

test('the room\'s volumes: each pose camera taps its own zone at its focus, and the open floor picks nothing', () => {
  const s = stage(), room = buildRoom(s);
  try {
    assert.deepEqual(room.targets.map((t) => t.id), ['rack', 'trophies', 'gate']);
    for (const zone of ['rack', 'trophies', 'gate'] as const) {
      const c = camera(POSES[zone].camera, POSES[zone].target), pick = createPicker(c, () => room.targets);
      assert.equal(pick(tapAt(c, FOCUS[zone])), zone, `${zone}: a tap on what the camera leans toward`);
    }
    const c = camera([0, 2.15, 2.85], [0, 1.15, 0]), pick = createPicker(c, () => room.targets);   // the arrival camera
    assert.equal(pick(tapAt(c, [0, 0, 0])), null, 'the floor under him');
    assert.equal(pick(tapAt(c, [-3.7, 1.6, 0])), 'rack', 'the rack across the room');
    assert.equal(pick(tapAt(c, [3.6, 0.8, -0.6])), 'trophies', 'the chests across the room');
    assert.equal(pick(tapAt(c, [0, 1.3, -3])), 'gate', 'the gate ahead');
  } finally { room.dispose(); }
});

// The full stage builds the sheet (sheet.ts), and node has no document: the least element that satisfies it, so the test is what it shows.
const element = () => ({ hidden: false, textContent: '', childElementCount: 0, setAttribute() {}, append() {}, replaceChildren() {}, addEventListener() {}, remove() {} });
test('a tap on the rack from the door opens the rack sheet where he stands; walking, or a tap on nothing, gives the sheet his zone back', () => {
  const made: ReturnType<typeof element>[] = [];
  (globalThis as { document?: unknown }).document = { createElement: () => { const e = element(); made.push(e); return e; }, body: element() };
  try {
    let tap: { x: number; y: number } | null = null, move = { x: 0, z: 0 };
    const s = stage();
    Object.assign(s, { readMove: () => move, readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }) });
    const pit = enter(s, 'win');
    const title = made[1]!;   // createSheet makes section, h2, div
    const frame = () => pit.frame(1 / 60);
    frame();
    assert.equal(title.textContent, 'The Pit', 'arrived at the ramp: the open floor');
    s.camera.updateMatrixWorld();
    tap = tapAt(s.camera, FOCUS.rack); frame();
    assert.equal(title.textContent, 'The rack', 'the tap picked the rack from the ramp');
    frame(); assert.equal(title.textContent, 'The rack', 'and it stays while he stands');
    tap = tapAt(s.camera, [0, 0.05, 0.5]); frame();
    assert.equal(title.textContent, 'The Pit', 'a tap on the floor clears it');
    tap = tapAt(s.camera, FOCUS.trophies); frame(); assert.equal(title.textContent, 'Trophies');
    move = { x: 0, z: -1 }; frame();
    assert.equal(title.textContent, 'The Pit', 'a step clears it: the sheet is his zone again');
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('main.ts: a press that lifts under 8 px is the Pit\'s tap, in NDC from the canvas rect, drained by readTap', () => {
  const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /TAP_PX = 8/);
  assert.match(main, /canvas\.addEventListener\('pointerup', \(event\) => \{\n {2}if \(event\.pointerId !== orbitId \|\| !pit \|\| Math\.hypot\(event\.clientX - pressX, event\.clientY - pressY\) >= TAP_PX\) return;/);
  assert.match(main, /pitTap = \{ x: \(\(event\.clientX - rect\.left\) \/ rect\.width\) \* 2 - 1, y: 1 - \(\(event\.clientY - rect\.top\) \/ rect\.height\) \* 2 \}/);
  assert.match(main, /readTap: \(\) => \{ const tap = pitTap; pitTap = null; return tap; \}/);
});

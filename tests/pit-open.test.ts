// The Pit's entry is safe to abandon and safe to fail (Code Quality P1/P2 on #1122, GPT's recheck): a chunk that lands after the player
// moved on changes nothing, and a build that throws hands the arena back exactly as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { openPit } from '../src/pit-coordinator.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import type { Stage } from '../src/pit/stage.ts';
import type { Loot } from '../src/loot.ts';

function stage(loot: () => Loot = () => ({ owned: [], equipped: {} })) {
  const arena: boolean[] = [], scene = new THREE.Scene(), sun = new THREE.DirectionalLight('#fff', 2);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(51, 0.46);   // a phone held upright: enter() widens the lens
  const s: Stage = {
    scene, camera, renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible(on) { arena.push(on); }, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot,
  };
  return { s, arena, sun, camera, scene };
}

test('P1: a chunk that lands after the player moved on (a Rematch) never enters: no hide, no light, no lens, no pit', async () => {
  const { s, arena, sun, camera, scene } = stage();
  const pit = await openPit(s, 'defeat', undefined, () => false);
  assert.equal(pit, undefined);
  assert.deepEqual(arena, [], 'the arena was never hidden');
  assert.equal(sun.intensity, 2); assert.equal(camera.fov, 51);
  assert.deepEqual(scene.children, [sun], 'nothing was built into the fight\'s scene');
  const wanted = await openPit(s, 'defeat');   // the same tap still wanted: it enters
  assert.ok(wanted); assert.deepEqual(arena, [false]);
  wanted.dispose(); assert.deepEqual(arena, [false, true]);
});

test('P1: main.ts asks the tap\'s op id before enter(), and every new fight and pagehide moves it on', () => {
  const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const began = main.slice(main.indexOf('function began() {'), main.indexOf('\n}\n', main.indexOf('function began() {')));
  assert.match(began, /pitOp\+\+/, 'a fight start (Rematch, Next, a new rung) bumps pitOp');
  assert.match(main, /const op = \+\+pitOp;[\s\S]{0,700}?openPit\(pitStage\(\), entry, undefined, \(\) => op === pitOp/, 'the door\'s open is guarded by its op id (D2: the entry is decided above, and the walk\'s pace rides along)');
  assert.match(main, /addEventListener\('pagehide', \(event\) => \{ if \(!event\.persisted\) \{ pitOp\+\+; disposePit\(\); \} \}\)/);
});

test('P2: a build that throws gives the arena back, leaves lights, lens and scene untouched, and the next open works', () => {
  disposeRoom();
  const { s, arena, sun, camera, scene } = stage(() => { throw new Error('the loot read failed'); });
  assert.throws(() => enter(s, 'win'), /the loot read failed/);
  assert.deepEqual(arena, [false, true], 'hidden for the build, then given back');
  assert.equal(sun.intensity, 2, 'the arena\'s lights are not left dimmed');
  assert.equal(camera.fov, 51, 'the fight\'s lens is not left widened');
  assert.deepEqual(scene.children, [sun], 'no half-built room left in the scene');
  s.loot = () => ({ owned: [], equipped: {} });
  const pit = enter(s, 'win');
  assert.equal(camera.fov, 62); assert.ok(sun.intensity < 2);
  assert.ok(pit.ready instanceof Promise, 'the visit says when its pieces are placed (the memory row samples after it)');
  pit.dispose();
  assert.equal(camera.fov, 51); assert.equal(sun.intensity, 2); assert.deepEqual(arena, [false, true, false, true]);
  // A re-entry restocks the room, and its ready is THAT stock, not the first build's (Code Quality on #1151: the memory row compares
  // visits 2-10, which are all re-entries). leave() keeps the room, so the next enter() restocks it.
  const first = pit.ready; pit.leave();
  const again = enter(s, 'win');
  assert.notEqual(again.ready, first, 'the second visit waits on its own restock');
  again.dispose();
});

test('P2: the room builds and then the sheet throws: the room is hidden, not left drawn over the arena', () => {
  disposeRoom();
  const { s, arena, sun, camera } = stage();
  // A full game stage, so enter() builds the sheet; node has no document, so createSheet throws after the room is in the scene.
  Object.assign(s, { readMove: () => ({ x: 0, z: 0 }), rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }) });
  assert.throws(() => enter(s, 'win'), /document/);
  const room = s.scene.getObjectByName('Pit');
  assert.ok(room, 'the room was built');
  assert.equal(room.visible, false, 'the half-entered room is hidden');
  assert.deepEqual(arena, [false, true]); assert.equal(sun.intensity, 2); assert.equal(camera.fov, 51);
  disposeRoom();
});

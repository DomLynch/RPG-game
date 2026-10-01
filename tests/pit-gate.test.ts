// D2 (docs/pit-design.md §9): the gate is the way in. The line he crosses on foot, the door's hide/return rule while he walks, his arrival
// in the room at the pace he had, and main.ts's wiring: one open per crossing, the hold at the line, the fade, and began() clearing it all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { atGateLine, doorHidden, DOOR_STILL, GATE_LINE } from '../src/pit-coordinator.ts';
import { LAYOUT } from '../src/arena.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import type { Stage } from '../src/pit/stage.ts';

test('the gate line: 1.5 m inside the wall, inside the gate arc only', () => {
  const at = (r: number, angle = LAYOUT.gate) => atGateLine(Math.sin(angle) * r, Math.cos(angle) * r);
  assert.equal(GATE_LINE, LAYOUT.wall.inner - 1.5);
  assert.equal(at(GATE_LINE + 0.05), true, 'just past the line, in the arc');
  assert.equal(at(GATE_LINE - 0.05), false, 'just short of it');
  assert.equal(at(GATE_LINE + 0.05, LAYOUT.gate + 0.6), false, 'the same radius outside the arc is the wall, not the gate');
  assert.equal(at(3), false, 'the middle of the sand');
});

test('main.ts decides the door\'s hide/return in updateHud, the one place that sets hidden (the frame loop only records the move)', () => {
  const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /pitButton\.hidden = !door \|\| \(walker !== null && doorHidden\(lastMoveAt, performance\.now\(\)\)\);/);
  assert.equal((main.match(/pitButton\.hidden = /g) ?? []).length, 1, 'one assignment: a second one later in the frame put the door back (VPS probe 2026-09-30: the door stayed at opacity 1 through a walk)');
});

test('the door hides as soon as the stick moves him and returns after 3 s still', () => {
  assert.equal(doorHidden(null, 5000), false, 'never moved: shown');
  assert.equal(doorHidden(1000, 1500), true, 'moving: hidden');
  assert.equal(doorHidden(1000, 1000 + DOOR_STILL - 1), true, 'still, but not yet 3 s');
  assert.equal(doorHidden(1000, 1000 + DOOR_STILL), false, 'still for 3 s: back');
});

function gameStage(read: () => { x: number; z: number }, placed: { z: number; speed: number }[]): Stage {
  return {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(51, 0.46), renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible() {}, hero: { place(_x, z, _h, speed) { placed.push({ z, speed }); } }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }),
    readMove: read, rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }),
  };
}

// The full stage builds the sheet (sheet.ts), and node has no document: the least element that satisfies it, so the test is the walk.
const element = () => ({ hidden: false, textContent: '', childElementCount: 0, setAttribute() {}, append() {}, replaceChildren() {}, addEventListener() {}, remove() {} });
const withDocument = (run: () => void) => {
  (globalThis as { document?: unknown }).document = { createElement: element, body: element() };
  try { run(); } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
};

test('arriving through the gate he keeps his pace into the room for a moment; the stick ends it, or takes over at once', () => withDocument(() => {
  disposeRoom();
  const placed: { z: number; speed: number }[] = [];
  let stick = { x: 0, z: 0 };
  const pit = enter(gameStage(() => stick, placed), 'win', undefined, 1.9);
  for (let i = 0; i < 4; i++) pit.frame(0.1);
  assert.ok(placed.every((p) => p.speed > 1), `he walks in on his own momentum: ${placed.map((p) => p.speed.toFixed(2)).join(' ')}`);
  assert.ok(placed[3]!.z < placed[0]!.z, 'into the room (−z), away from the ramp');
  for (let i = 0; i < 5; i++) pit.frame(0.1);   // 0.9 s: the momentum is spent
  assert.equal(placed.at(-1)!.speed, 0, 'then he stands');
  const stood = placed.at(-1)!.z;
  stick = { x: 0, z: -1 }; pit.frame(0.1);
  assert.ok(placed.at(-1)!.z < stood && placed.at(-1)!.speed > 0, 'the stick walks him again');
  pit.dispose();
  const sideways: { z: number; speed: number }[] = [];
  const again = enter(gameStage(() => ({ x: 1, z: 0 }), sideways), 'win', undefined, 1.9);
  again.frame(0.1); again.frame(0.1);
  assert.ok(Math.abs(sideways[1]!.z - sideways[0]!.z) < 0.05 && sideways[1]!.speed > 0, 'a stick on arrival takes over at once: he goes where it points, not on into the room');
  again.dispose();
  const plain: { z: number; speed: number }[] = [];
  const noWalk = enter(gameStage(() => ({ x: 0, z: 0 }), plain), 'win');
  noWalk.frame(0.1);
  assert.equal(plain[0]!.speed, 0, 'the button\'s open (no walk) arrives standing, as before');
  noWalk.dispose();
}));

test('main.ts: one open per crossing, the hold and the auto-walk in the frame, the fade, and began() clears the gate state', () => {
  const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const frame = main.slice(main.indexOf('function frame(now: number) {'));
  assert.match(frame, /const intent = gateHold \? \{ x: 0, z: 0 \} : gateAuto \? \{ x: 0, z: -1 \} : controls\.intent\(\);/, 'held at the line, or walked the last metres, or the stick');
  assert.match(frame, /if \(walker\.speed > 0\.05\) lastMoveAt = now;/, 'the frame records the move; updateHud (every frame) decides the door from it');
  assert.match(frame, /if \(atGateLine\(walker\.x, walker\.z\)\) \{ if \(!crossed\) \{ crossed = true; openGate\(false\); \} \} else crossed = false;/, 'one open per crossing');
  const began = main.slice(main.indexOf('function began() {'), main.indexOf('\n}\n', main.indexOf('function began() {')));
  assert.match(began, /view\?\.raiseGate\(false\); gateAuto = gateHold = crossed = false; lastMoveAt = null; document\.documentElement\.classList\.toggle\('gate-fade', false\);/);
  assert.match(main, /Promise\.all\(\[loadPit\(\), barsUp\]\)\.then\(fade\)\.then\(\(\) => openPit\(pitStage\(\), entry, undefined, \(\) => op === pitOp, walker\?\.speed \?\? 0\)\)/, 'the chunk and the rising bars, then the fade, then the room at his pace');
  assert.match(main, /pitButton\.addEventListener\('click', \(\) => openGate\(true\)\)/, 'the shortcut walks him the last metres');
});

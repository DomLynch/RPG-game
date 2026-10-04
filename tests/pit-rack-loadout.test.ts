// Dom 2026-10-01 (live 4da6b84f): the rack showed only a loot card ("Crixus's trident · Wear"). The rack opens the full loadout sheet (the
// journal's Gear & pack: worn, stored, weapons and armour on and off). No merge lost it (sheet.ts has only ever drawn rack rows; Web's #1155
// was the open piece), so this is the Pit's half: a tap on the rack, and a button on the rack's sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FOCUS } from '../src/pit/room.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import type { Stage } from '../src/pit/stage.ts';

type El = { hidden: boolean; textContent: string; className: string; type: string; childElementCount: number; listeners: Record<string, () => void>; setAttribute(): void; append(...n: unknown[]): void; replaceChildren(...n: unknown[]): void; addEventListener(t: string, f: () => void): void; remove(): void; children: El[] };
const element = (): El => { const e: El = { hidden: false, textContent: '', className: '', type: '', childElementCount: 0, listeners: {}, children: [], setAttribute() {}, append(...n) { e.children.push(...(n as El[])); }, replaceChildren(...n) { e.children = n as El[]; }, addEventListener(t, f) { e.listeners[t] = f; }, remove() {} }; return e; };
const tapAt = (c: THREE.Camera, p: THREE.Vector3Tuple) => { const v = new THREE.Vector3(...p).project(c); return { x: v.x, y: v.y }; };
const stage = (): Stage => ({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 0.46, 0.1, 50), renderer: undefined as unknown as THREE.WebGLRenderer,
  setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }),
});

test('a tap on the rack opens the loadout sheet once per tap; the rack\'s sheet carries an Open loadout button; a tap elsewhere opens nothing', () => {
  const made: El[] = [];
  (globalThis as { document?: unknown }).document = { createElement: () => { const e = element(); made.push(e); return e; }, body: element() };
  try {
    let tap: { x: number; y: number } | null = null, opened = 0;
    const s = Object.assign(stage(), { readMove: () => ({ x: 0, z: 0 }), readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }), openJournal: () => { opened++; } });
    const pit = enter(s, 'win');
    const frame = () => pit.frame(1 / 60);
    frame(); s.camera.updateMatrixWorld();
    tap = tapAt(s.camera, [0, 0.05, 0.5]); frame();
    assert.equal(opened, 0, 'a tap on the floor opens nothing');
    tap = tapAt(s.camera, FOCUS.trophies); frame();
    assert.equal(opened, 0, 'nor does the trophy wall');
    tap = tapAt(s.camera, FOCUS.rack); frame();
    assert.equal(opened, 1, 'a tap on the rack opens the loadout');
    const button = made.find((e) => e.className === 'pit-go' && e.textContent === 'Open loadout');
    assert.ok(button, 'the rack sheet offers Open loadout');
    button.listeners['click']!();
    assert.equal(opened, 2, 'and the button opens it too');
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('without the loadout opener (the look stills) the rack sheet has no button and a rack tap does nothing', () => {
  const made: El[] = [];
  (globalThis as { document?: unknown }).document = { createElement: () => { const e = element(); made.push(e); return e; }, body: element() };
  try {
    let tap: { x: number; y: number } | null = null;
    const s = Object.assign(stage(), { readMove: () => ({ x: 0, z: 0 }), readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }) });
    const pit = enter(s, 'win'); pit.frame(1 / 60); s.camera.updateMatrixWorld();
    tap = tapAt(s.camera, FOCUS.rack); pit.frame(1 / 60);
    assert.equal(made.some((e) => e.textContent === 'Open loadout'), false);
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('main.ts hands the Pit the journal\'s opener on its Gear & pack tab, and the ☰ button shares the same opener', async () => {
  const main = (await import('node:fs')).readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /openJournal: \(\) => \{ if \(journal\.open\) return; element<HTMLInputElement>\('journal-tab-profile'\)\.checked = true; openJournal\(\); \}/);
  assert.match(main, /element\('journal-button'\)\.addEventListener\('click', openJournal\);/);
});

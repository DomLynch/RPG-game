// Dom 2026-10-01 (live 4da6b84f): the rack showed only a loot card ("Crixus's trident · Wear"). The rack opens the full loadout sheet (the
// journal's Gear & pack: worn, stored, weapons and armour on and off). No merge lost it (sheet.ts has only ever drawn rack rows; Web's #1155
// was the open piece), so this is the Pit's half: a tap on the rack, and a button on the rack's sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FOCUS, RACK_SLOTS, ladderOrder, pieceLevel, rackIds } from '../src/pit/room.ts';
import type { Loot, LootId, Provenance } from '../src/loot.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import { PORTRAIT_KEYS } from '../src/legends.ts';
import type { Stage } from '../src/pit/stage.ts';

type El = { hidden: boolean; textContent: string; className: string; type: string; childElementCount: number; listeners: Record<string, () => void>; setAttribute(): void; append(...n: unknown[]): void; replaceChildren(...n: unknown[]): void; addEventListener(t: string, f: () => void): void; remove(): void; children: El[] };
const element = (): El => { const e: El = { hidden: false, textContent: '', className: '', type: '', childElementCount: 0, listeners: {}, children: [], setAttribute() {}, append(...n) { e.children.push(...(n as El[])); }, replaceChildren(...n) { e.children = n as El[]; }, addEventListener(t, f) { e.listeners[t] = f; }, remove() {} }; return e; };
const tapAt = (c: THREE.Camera, p: THREE.Vector3Tuple) => { const v = new THREE.Vector3(...p).project(c); return { x: v.x, y: v.y }; };
const stage = (): Stage => ({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 0.46, 0.1, 50), renderer: undefined as unknown as THREE.WebGLRenderer,
  setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }), legendKeys: () => PORTRAIT_KEYS,
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

// The trophy rack (Dom 2026-10-04): the best four pieces, by tier, then the opponent's place in the ladder, starters last.
const prov = (opponent: string, tier?: number): Provenance => ({ opponent, attempt: 1, healthLeft: 1, recordId: null, day: '2026-10-01', ...(tier ? { tier } : {}) }) as Provenance;
const lootOf = (owned: string[], taken: Record<string, Provenance>, equipped: Record<string, string> = {}): Loot => ({ owned, equipped, taken }) as unknown as Loot;
const ORDER = ladderOrder(PORTRAIT_KEYS);

test('ladderOrder: the opponents in the legend keys\' order, once each', () => {
  assert.deepEqual(ORDER.slice(0, 4), ['veteran', 'pitborn', 'goblin', 'nightborn']);
  assert.equal(ORDER.length, 10);
  assert.deepEqual(ladderOrder(['a-1', 'a-2', 'b-1', 'a-3']), ['a', 'b']);
});
test('pieceLevel: the tier, else the ladder place as a fraction below tier 1, else a starter ranks last', () => {
  const loot = lootOf(['a.Helmet', 'b.Body', 'goblin.Boots', 'witch.Arms', 'x.Gloves'], { 'a.Helmet': prov('goblin', 8), 'goblin.Boots': prov('goblin'), 'witch.Arms': prov('witch') });
  assert.equal(pieceLevel(loot, 'a.Helmet' as LootId, ORDER), 8);
  assert.equal(pieceLevel(loot, 'goblin.Boots' as LootId, ORDER), 0.03);
  assert.equal(pieceLevel(loot, 'witch.Arms' as LootId, ORDER), 0.09);
  assert.equal(pieceLevel(loot, 'b.Body' as LootId, ORDER), -1);
  assert.equal(pieceLevel(loot, 'goblin.Boots' as LootId, []), 0, 'an opponent not in the order sits below the ladder');
  assert.ok(pieceLevel(loot, 'witch.Arms' as LootId, ORDER) < 1);
});
test('rackIds: best level first, capped at four, ties by id, skipping worn and trophy pieces', () => {
  assert.equal(RACK_SLOTS, 4);
  const owned = ['starter.Z', 'nightborn.Helmet', 'goblin.Dagger', 'knight.Body', 'goblin.Arms', 'veteran.Boots', 'witch.Hat', 'witch.Cape', 'tie.B', 'tie.A'];
  const taken = {
    'nightborn.Helmet': prov('nightborn', 8), 'goblin.Dagger': prov('goblin', 3), 'knight.Body': prov('knight'), 'goblin.Arms': prov('goblin'),
    'veteran.Boots': prov('veteran'), 'witch.Hat': prov('witch', 8), 'witch.Cape': prov('witch', 8), 'tie.B': prov('veteran', 5), 'tie.A': prov('veteran', 5),
  };
  const loot = lootOf(owned, taken, { head: 'witch.Hat' });
  assert.deepEqual(rackIds(loot, [], undefined, ORDER), ['nightborn.Helmet', 'witch.Cape', 'tie.A', 'tie.B'], 'the worn tier-8 hat is out; tier 8 ties by id; then tier 5 ties by id');
  assert.deepEqual(rackIds(loot, ['nightborn.Helmet' as LootId], 6, ORDER), ['witch.Cape', 'tie.A', 'tie.B', 'goblin.Dagger', 'knight.Body', 'goblin.Arms'], 'a trophy leaves the rack; no-tier takes rank by ladder place (knight over goblin), real tiers before any of them');
  assert.deepEqual(rackIds(loot, [], 10, ORDER).slice(-2), ['veteran.Boots', 'starter.Z'], 'the first ladder place, then the starter, last');
  assert.deepEqual(rackIds(lootOf([], {}), []), []);
});

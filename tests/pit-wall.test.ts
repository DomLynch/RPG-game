// The skull wall (Dom 2026-10-04): ONE wall right of the arch, 6 x 5 = 30 niches, one skull per kill (computer or player), newest first; the record
// board is carved left of the arch. The skull is a swappable asset (Stage.prop) with bone markers until it lands; a tap on a niche picks `skull:<i>`,
// the board picks `board`, and the sheet shows the kill's card, the record, or the hint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { PORTRAIT_KEYS } from '../src/legends.ts';
import { NICHE, PANEL, buildWall, nicheGeometry, slots } from '../src/pit/wall.ts';
import { BOARD } from '../src/pit/board.ts';
import { demoKills, type Kill, type Kills } from '../src/pit/skulls.ts';
import { ROOM, buildRoom, POSES } from '../src/pit/room.ts';
import { createPicker } from '../src/pit/picker.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import type { Stage } from '../src/pit/stage.ts';
import type { Loot } from '../src/loot.ts';

const gateHalf = ROOM.gate.width / 2;

const kills = (n: number): Kills => Array.from({ length: n }, (_, i) => demoKills()[i % 12]!);

test('30 niches right of the arch (6 columns x 5 rows from the panel\'s inner edge), unique ids skull:0..29, the record board slab left of the arch', () => {
  const right = slots();
  assert.equal(right.length, 30);
  assert.deepEqual(right.map((s) => s.id), Array.from({ length: 30 }, (_, i) => `skull:${i}`));
  assert.deepEqual(slots(), right, 'stable');
  for (const s of right) {
    assert.ok(s.x >= PANEL.inner && s.x <= PANEL.outer, `${s.id} x ${s.x} in the panel`);
    assert.ok(s.x >= gateHalf + 0.1 && s.x <= ROOM.width / 2 - 0.2, `${s.id} at x ${s.x} clear of the gate and the corner`);
    assert.ok(s.y >= 0.5 && s.y <= ROOM.height - 0.3, `${s.id} at y ${s.y}`);
  }
  assert.equal(new Set(right.map((s) => s.x)).size, 6); assert.equal(new Set(right.map((s) => s.y)).size, 5);
  assert.deepEqual([right[0]!.x, right[0]!.y], [PANEL.inner + PANEL.colPitch / 2, PANEL.top], 'the first kill at the inner edge, top row');
  assert.ok(BOARD.x1 <= -gateHalf - 0.1 && BOARD.x0 >= -ROOM.width / 2 + 0.2, 'the slab is left of the arch and inside the room');
  assert.ok(Math.abs(BOARD.x1 - BOARD.x0 - 2.4) < 1e-6 && BOARD.y1 - BOARD.y0 > 2 && BOARD.y0 >= 0.5 && BOARD.y1 <= ROOM.height - 0.3);
});

function stage(loot: Loot = { owned: [], equipped: {} }, prop?: Stage['prop']): Stage {
  return {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(51, 0.46), renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => loot, legendKeys: () => PORTRAIT_KEYS, ...(prop ? { prop } : {}),
  };
}
const instanced = (group: THREE.Group, name: string) => group.getObjectByName(name) as THREE.InstancedMesh | undefined;

test('disposal before a deferred skull load prevents late mounting and releases only owned resources once', async () => {
  let resolve!: (asset: THREE.Mesh | null) => void;
  const pending = new Promise<THREE.Mesh | null>(done => { resolve = done; });
  const group = new THREE.Group(), bone = new THREE.MeshStandardMaterial();
  const asset = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  let sharedDisposals = 0, ownedDisposals = 0;
  for (const resource of [bone, asset.geometry, asset.material]) resource.addEventListener('dispose', () => sharedDisposals++);
  const wall = buildWall(stage(undefined, () => pending), group, -3, bone);
  const niches = instanced(group, 'skull-niches')!;
  niches.addEventListener('dispose', () => ownedDisposals++);
  niches.geometry.addEventListener('dispose', () => ownedDisposals++);
  (niches.material as THREE.Material).addEventListener('dispose', () => ownedDisposals++);
  wall.dispose(); wall.dispose();
  const count = group.children.length;
  resolve(asset); await wall.ready;
  wall.restock(kills(1)); wall.dispose();
  assert.equal(group.children.length, count);
  assert.equal(instanced(group, 'skulls'), undefined);
  assert.equal(ownedDisposals, 3);
  assert.equal(sharedDisposals, 0);
});

test('disposal after loading releases instances once, leaves shared skull resources intact, and prevents restock', async () => {
  const asset = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const group = new THREE.Group(), bone = new THREE.MeshStandardMaterial();
  let sharedDisposals = 0, instanceDisposals = 0;
  for (const resource of [bone, asset.geometry, asset.material]) resource.addEventListener('dispose', () => sharedDisposals++);
  const wall = buildWall(stage(undefined, async () => asset), group, -3, bone);
  await wall.ready; wall.restock(kills(1));
  const skulls = instanced(group, 'skulls')!;
  skulls.addEventListener('dispose', () => instanceDisposals++);
  wall.dispose(); wall.dispose(); wall.restock(kills(2));
  assert.equal(skulls.count, 1);
  assert.equal(instanceDisposals, 1);
  assert.equal(sharedDisposals, 0);
});

test('an empty niche is a carved cell: vertex-coloured rim, sides and dark back, proud of the wall by its depth', () => {
  const g = nicheGeometry();
  assert.ok(g.getAttribute('color'), 'one material, the colours in the vertices');
  g.computeBoundingBox();
  const b = g.boundingBox!;
  assert.ok(Math.abs(b.min.z) < 1e-6 && Math.abs(b.max.z - NICHE.d) < 1e-6, `from the wall plane forward by ${NICHE.d}: ${b.min.z}..${b.max.z}`);
  assert.ok(Math.abs(b.max.x - (NICHE.w / 2 + NICHE.lip)) < 1e-6 && Math.abs(b.max.y - (NICHE.h / 2 + NICHE.lip)) < 1e-6, 'the rim frames the opening');
  const c = g.getAttribute('color')!; let dark = 0, lit = 0, top = 0;
  for (let i = 0; i < c.count; i++) { top = Math.max(top, c.getX(i)); if (c.getX(i) < 0.04) dark++; else if (c.getX(i) > 0.12) lit++; }
  assert.ok(dark >= 4 && lit >= 4, 'a dark back and a lit arris');
  assert.ok(top <= 0.2, `the arris is a step above the wall's stone (~0.12 linear), never a white frame (Lead 2026-09-30): ${top}`);
  assert.ok(NICHE.w + 2 * NICHE.lip < PANEL.colPitch, 'neighbouring cells keep wall between them, not one joined grid');
  g.dispose();
});

test('nothing killed: every niche a dark carved cell and no skull; restock replaces; the first N niches fill, never more than 30', async () => {
  const s = stage(), group = new THREE.Group(), bone = new THREE.MeshStandardMaterial();
  const wall = buildWall(s, group, -3, bone);
  await wall.ready;
  assert.equal(instanced(group, 'skull-niches')?.count, 30);
  assert.equal(wall.targets.length, 30);
  const markers = instanced(group, 'skull-markers');
  assert.ok(markers, 'no asset: the bone marker stands in');
  wall.restock(undefined);
  assert.equal(markers.count, 0); assert.equal(markers.visible, false, 'no data: nothing drawn');
  wall.restock(kills(4));
  assert.equal(markers.count, 4); assert.equal(markers.visible, true);
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  markers.getMatrixAt(3, m); p.setFromMatrixPosition(m);
  const slot = slots()[3]!;
  assert.ok(Math.abs(p.x - slot.x) < 1e-6 && Math.abs(p.y - slot.y) < 1e-6 && p.z > -3 && p.z < -3 + NICHE.d, `the fourth kill sits inside the fourth cell: ${p.toArray()}`);
  wall.restock(kills(1));
  assert.equal(markers.count, 1, 'a restock replaces the set');
  wall.restock(kills(40));
  assert.equal(markers.count, 30, 'never more than the 30 niches');
  wall.dispose();
});

test('the skull asset, when the Stage has it, fills the beaten slots (fitted to the niche) and the marker is not used', async () => {
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6).translate(3, 3, 3), new THREE.MeshStandardMaterial());
  const s = stage(undefined, async () => skull), group = new THREE.Group();
  const wall = buildWall(s, group, -3, new THREE.MeshStandardMaterial());
  await wall.ready;
  const skulls = instanced(group, 'skulls');
  assert.ok(skulls && !instanced(group, 'skull-markers'));
  assert.equal(skulls.geometry, skull.geometry, 'the asset\'s own geometry, shared');
  wall.restock(kills(1));
  assert.equal(skulls.count, 1);
  const m = new THREE.Matrix4(); skulls.getMatrixAt(0, m);
  const p = new THREE.Vector3(3, 3, 3).applyMatrix4(m), scale = new THREE.Vector3().setFromMatrixScale(m), slot = slots()[0]!;   // the asset's own centre lands on the slot
  assert.ok(Math.abs(p.x - slot.x) < 1e-5 && Math.abs(p.y - slot.y) < 1e-5, `centred on the slot, the asset's own offset undone: ${p.toArray()}`);
  assert.ok(Math.abs(scale.x - NICHE.w / 1.0) < 1e-6, `a 1 m skull scaled to the niche's ${NICHE.w}: ${scale.x}`);
  wall.dispose();
});

test('the room stocks the wall from the loot\'s kills (no record yet) and a tap on a niche or the board from the gate camera picks it', async () => {
  const loot = { owned: [], equipped: {}, defeats: ['pitborn-3', 'witch-9', 'witch-2'] } as Loot;
  const s = stage(loot), room = buildRoom(s);
  try {
    await room.ready;
    const markers = instanced(room.group, 'skull-markers');
    assert.equal(markers?.count, 3, 'three kills on record, one skull each');
    assert.equal(room.targets.filter((t) => t.id.startsWith('skull:')).length, 30);
    assert.ok(room.group.getObjectByName('record-board'), 'the board is built beside the wall');
    const c = new THREE.PerspectiveCamera(62, 0.46, 0.1, 50); c.position.set(...POSES.gate.camera); c.lookAt(...POSES.gate.target); c.updateMatrixWorld();
    const pick = createPicker(c, () => room.targets), at = (x: { x: number; y: number }) => { const v = new THREE.Vector3(x.x, x.y, -ROOM.depth / 2).project(c); return { x: v.x, y: v.y }; };
    assert.equal(pick(at(slots()[0]!)), 'skull:0');
    assert.equal(pick(at(slots()[17]!)), 'skull:17', 'an empty niche picks too (its sheet shows the hint)');
    assert.equal(pick(at({ x: (BOARD.x0 + BOARD.x1) / 2, y: (BOARD.y0 + BOARD.y1) / 2 })), 'board');
    assert.equal(pick({ x: 0, y: -0.2 }), 'gate', 'the gate between the panels is still the gate');
    assert.ok(PANEL.colPitch * 2 <= NICHE.h * 2, 'a slot\'s pick box is its pitch, so the wall has no dead gaps');
  } finally { room.dispose(); }
});

test('the room hangs the stage\'s skulls now, then the fetched kills once they land, unless a later stock took over; the board likewise', async () => {
  let land!: (data: Kills) => void;
  const s = Object.assign(stage(), { skullsNow: () => kills(1), skulls: () => new Promise<Kills>((done) => { land = done; }), recordNow: () => undefined, record: async () => ({ kills: 5, wins: 5, losses: 1, streak: 2, highestRank: 3, computerKills: 4, duelKills: 1 }) }), room = buildRoom(s);
  try {
    await room.ready;
    const markers = instanced(room.group, 'skull-markers')!;
    assert.equal(markers.count, 1, 'the cached kills hang at once');
    land(kills(7));
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(markers.count, 7);
  } finally { room.dispose(); }
});

// The full stage builds the sheet (sheet.ts), and node has no document: a minimal element that keeps its children, so the sheet's text can be read.
type El = { hidden: boolean; textContent: string; className: string; src: string; alt: string; width: number; height: number; loading: string; children: El[]; childElementCount: number; setAttribute(): void; append(...n: El[]): void; replaceChildren(...n: El[]): void; addEventListener(): void; remove(): void };
const element = (): El => {
  const e: El = { hidden: false, textContent: '', className: '', src: '', alt: '', width: 0, height: 0, loading: '', children: [], childElementCount: 0, setAttribute() {}, addEventListener() {}, remove() {}, append(...n) { e.children.push(...n); e.childElementCount = e.children.length; }, replaceChildren(...n) { e.children = n; e.childElementCount = n.length; } };
  return e;
};
const textOf = (e: El): string[] => [e.textContent, ...e.children.flatMap(textOf)].filter(Boolean);
test('a tap on a computer kill shows its portrait, name, rank and date; a player kill its level, gear and date; an empty niche the hint; the board the record', () => {
  const made: El[] = [];
  (globalThis as { document?: unknown }).document = { createElement: () => { const e = element(); made.push(e); return e; }, body: element() };
  try {
    let tap: { x: number; y: number } | null = null;
    const data: Kill[] = [
      { kind: 'ai', key: 'veteran-7', name: 'Crixus', level: 7, gear: {}, at: '2026-10-03T19:20:00Z', opponent: 'veteran', rank: 7 },
      { kind: 'duel', key: 'u1', name: 'Marcus Vale', level: 24, gear: { head: 'knight.Helmet', weapon: 'veteran.Trident' }, at: '2026-10-02' },
      { kind: 'ai', key: 'dwarf', name: 'Dwarf', level: 0, gear: {}, at: null, opponent: 'dwarf', rank: null },
    ];
    const s = stage();
    Object.assign(s, {
      readMove: () => ({ x: 0, z: 0 }), readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }),
      skullsNow: () => data, pieceName: (id: string) => `<${id}>`,
      recordNow: () => ({ kills: 40, wins: 40, losses: null, streak: null, highestRank: 7, computerKills: 25, duelKills: 5 }),
      legend: (key: string) => ({ name: 'Crixus', opponent: `the ${key.split('-')[0]}`, rank: Number(key.split('-')[1]), source: '', backstory: '', portrait: `legends/${key}.webp`, beaten: true }),
    });
    const pit = enter(s, 'win'), [, title, body] = made.slice(-3) as [El, El, El];   // the board's canvas was made before the sheet's three
    pit.frame(1 / 60); s.camera.updateMatrixWorld();
    const at = (x: { x: number; y: number }) => { const v = new THREE.Vector3(x.x, x.y, -ROOM.depth / 2).project(s.camera); return { x: v.x, y: v.y }; };
    tap = at(slots()[0]!); pit.frame(1 / 60);
    assert.equal(title.textContent, 'Crixus');
    assert.equal(body.children[0]!.src, 'legends/veteran-7.webp');
    assert.deepEqual(body.children.slice(1).map((c) => c.textContent), ['Rank 7', '2026-10-03']);
    tap = at(slots()[1]!); pit.frame(1 / 60);
    assert.equal(title.textContent, 'Marcus Vale');
    assert.deepEqual(body.children.map((c) => c.textContent), ['Level 24', '<knight.Helmet>, <veteran.Trident>', 'Beaten 2026-10-02']);
    tap = at(slots()[2]!); pit.frame(1 / 60);
    assert.equal(body.children[0]!.src, 'legends/dwarf-1.webp', 'rank unknown: rank 1\'s portrait');
    assert.deepEqual(body.children.slice(1).map((c) => c.textContent), ['Rank unknown', 'long ago']);
    tap = at(slots()[3]!); pit.frame(1 / 60);
    assert.deepEqual(body.children.map((c) => c.textContent), ['Kills hang here, newest first. Beat an opponent to hang the first skull.']);
    tap = at({ x: (BOARD.x0 + BOARD.x1) / 2, y: (BOARD.y0 + BOARD.y1) / 2 }); pit.frame(1 / 60);
    assert.equal(title.textContent, 'The record');
    assert.deepEqual(body.children.map((c) => c.textContent), ['Kills: 40', 'Wins: 40 \u00b7 Losses: \u2014', 'Win streak: \u2014', 'Highest rank beaten: 7', 'Computer kills (latest 30): 25 \u00b7 Duel kills (latest 30): 5']);
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('the bull skull rides the same prop path: nothing drawn without the asset, the fitted model over the chests with it', async () => {
  const bare = buildRoom(stage());
  try { await bare.ready; assert.equal(bare.group.getObjectByName('bull-skull'), undefined, 'no primitive skull stands in'); } finally { bare.dispose(); }
  const model = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1).translate(5, 0, 0), new THREE.MeshStandardMaterial());
  const room = buildRoom(stage(undefined, async (name) => (name === 'bull-skull' ? model : null)));
  try {
    await room.ready;
    const holder = room.group.getObjectByName('bull-skull')!;
    assert.ok(holder, 'the prop is placed');
    holder.updateMatrixWorld(true);
    const centre = new THREE.Vector3(5, 0, 0).applyMatrix4(holder.children[0]!.matrixWorld);
    assert.ok(Math.abs(centre.x - (ROOM.width / 2 - 0.25)) < 1e-5 && Math.abs(centre.y - 2.75) < 1e-5 && Math.abs(centre.z - 0.3) < 1e-5, `centred over the chests: ${centre.toArray()}`);
    assert.ok(Math.abs(holder.scale.x - 0.35) < 1e-6, 'a 2 m model fitted to 0.7 m');
    assert.equal((holder.children[0] as THREE.Mesh).geometry, model.geometry, 'the scene\'s geometry, shared');
  } finally { room.dispose(); }
});

test('main.ts: legend(key) reads legends.ts and loot.defeats; scene.ts loads a prop once per page from pit/props/', () => {
  const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), scene = fs.readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  assert.match(main, /legend: \(key\) => \{[\s\S]*?isLegendOpponent\(id\)[\s\S]*?legendAt\(id, rank\)[\s\S]*?defeats \?\? \[\]\)\.includes\(key\)/);
  // The loader is pit-prop.ts's since #1172 (retried on a bare decode, reported): tests/pit-prop.test.ts.
  assert.match(scene, /prop: \(name\) => \(pitProps\[name\] \?\?= loadPitProp\(`pit\/props\/\$\{name\}\.glb`/);
  assert.match(scene, /budgetTextures\(mesh, phoneTier\(\) \? 256 : 512\)/, 'the arena props\' texture cap (World)');
  assert.match(scene, /legendKeys: \(\) => PORTRAIT_KEYS/);
});

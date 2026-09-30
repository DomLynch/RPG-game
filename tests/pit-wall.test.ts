// The skull wall (PR B, Lead's conditions 2026-09-30): 100 slots in PORTRAIT_KEYS order on the far wall's two panels either side of the
// gate; loot.defeats read defensively (absent → all silhouettes, a stray key → ignored); the skull is a swappable asset (Stage.prop) with
// bone markers until it lands; a tap on a slot picks `skull:<key>`, and the sheet shows the legend's card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { PORTRAIT_KEYS, LEGEND_OPPONENTS } from '../src/legends.ts';
import { NICHE, PANEL, buildWall, nicheGeometry, slots } from '../src/pit/wall.ts';
import { ROOM, buildRoom, POSES } from '../src/pit/room.ts';
import { createPicker } from '../src/pit/picker.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import type { Stage } from '../src/pit/stage.ts';
import type { Loot } from '../src/loot.ts';

const gateHalf = ROOM.gate.width / 2;

test('100 slots in PORTRAIT_KEYS order: one row per opponent, ranks left to right, five opponents a panel, clear of the gate and the corners', () => {
  const list = slots(PORTRAIT_KEYS);
  assert.equal(list.length, 100);
  assert.deepEqual(list.map((s) => s.key), [...PORTRAIT_KEYS]);
  for (const s of list) {
    assert.ok(Math.abs(s.x) >= gateHalf + 0.1, `${s.key} at x ${s.x} sits over the gate`);
    assert.ok(Math.abs(s.x) <= ROOM.width / 2 - 0.2, `${s.key} at x ${s.x} is in the corner`);
    assert.ok(s.y >= 0.5 && s.y <= ROOM.height - 0.3, `${s.key} at y ${s.y}`);
  }
  const rowOf = (opponent: string) => list.filter((s) => s.key.startsWith(`${opponent}-`));
  for (const [i, opponent] of LEGEND_OPPONENTS.entries()) {
    const row = rowOf(opponent);
    assert.equal(row.length, 10); assert.equal(new Set(row.map((s) => s.y)).size, 1, `${opponent}: one row`);
    assert.ok(row.every((s) => Math.sign(s.x) === (i < 5 ? -1 : 1)), `${opponent}: ${i < 5 ? 'left' : 'right'} panel`);
    const out = row.map((s) => Math.abs(s.x));
    assert.deepEqual(out, [...out].sort((a, b) => a - b), `${opponent}: rank 1 nearest the gate, 10 at the corner`);
  }
  assert.throws(() => slots(PORTRAIT_KEYS.slice(1)), /100 keys/);
});

function stage(loot: Loot = { owned: [], equipped: {} }, prop?: Stage['prop']): Stage {
  return {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(51, 0.46), renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => loot, legendKeys: () => PORTRAIT_KEYS, ...(prop ? { prop } : {}),
  };
}
const instanced = (group: THREE.Group, name: string) => group.getObjectByName(name) as THREE.InstancedMesh | undefined;

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

test('defeats absent: every slot a dark niche and no skull; a stray key is ignored; restock replaces', async () => {
  const s = stage(), group = new THREE.Group(), bone = new THREE.MeshStandardMaterial();
  const wall = buildWall(s, group, PORTRAIT_KEYS, -3, bone);
  await wall.ready;
  assert.equal(instanced(group, 'skull-niches')?.count, 100);
  const markers = instanced(group, 'skull-markers');
  assert.ok(markers, 'no asset: the bone marker stands in');
  wall.restock(undefined);
  assert.equal(markers.count, 0); assert.equal(markers.visible, false, 'no defeats: nothing drawn');
  wall.restock(['veteran-7', 'not-a-slot', 'knight-10']);
  assert.equal(markers.count, 2, 'two real slots, the stray key ignored'); assert.equal(markers.visible, true);
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  markers.getMatrixAt(0, m); p.setFromMatrixPosition(m);
  const slot = slots(PORTRAIT_KEYS).find((x) => x.key === 'veteran-7')!;
  assert.ok(Math.abs(p.x - slot.x) < 1e-6 && Math.abs(p.y - slot.y) < 1e-6 && p.z > -3 && p.z < -3 + NICHE.d, `veteran-7 sits inside its cell: ${p.toArray()}`);
  wall.restock(['goblin-1']);
  assert.equal(markers.count, 1, 'a restock replaces the set');
  wall.dispose();
});

test('the skull asset, when the Stage has it, fills the beaten slots (fitted to the niche) and the marker is not used', async () => {
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6).translate(3, 3, 3), new THREE.MeshStandardMaterial());
  const s = stage(undefined, async () => skull), group = new THREE.Group();
  const wall = buildWall(s, group, PORTRAIT_KEYS, -3, new THREE.MeshStandardMaterial());
  await wall.ready;
  const skulls = instanced(group, 'skulls');
  assert.ok(skulls && !instanced(group, 'skull-markers'));
  assert.equal(skulls.geometry, skull.geometry, 'the asset\'s own geometry, shared');
  wall.restock(['dwarf-4']);
  assert.equal(skulls.count, 1);
  const m = new THREE.Matrix4(); skulls.getMatrixAt(0, m);
  const p = new THREE.Vector3(3, 3, 3).applyMatrix4(m), scale = new THREE.Vector3().setFromMatrixScale(m), slot = slots(PORTRAIT_KEYS).find((x) => x.key === 'dwarf-4')!;   // the asset's own centre lands on the slot
  assert.ok(Math.abs(p.x - slot.x) < 1e-5 && Math.abs(p.y - slot.y) < 1e-5, `centred on the slot, the asset's own offset undone: ${p.toArray()}`);
  assert.ok(Math.abs(scale.x - NICHE.w / 1.0) < 1e-6, `a 1 m skull scaled to the niche's ${NICHE.w}: ${scale.x}`);
  wall.dispose();
});

test('the room stocks the wall from loot.defeats and a tap on a slot from the gate camera picks it', async () => {
  const loot = { owned: [], equipped: {}, defeats: ['pitborn-3', 'witch-9'] } as Loot;
  const s = stage(loot), room = buildRoom(s);
  try {
    await room.ready;
    const markers = instanced(room.group, 'skull-markers');
    assert.equal(markers?.count, 2, 'the two beaten legends');
    assert.equal(room.targets.filter((t) => t.id.startsWith('skull:')).length, 100);
    const c = new THREE.PerspectiveCamera(62, 0.46, 0.1, 50); c.position.set(...POSES.gate.camera); c.lookAt(...POSES.gate.target); c.updateMatrixWorld();
    const pick = createPicker(c, () => room.targets), at = (key: string) => { const x = slots(PORTRAIT_KEYS).find((q) => q.key === key)!; const v = new THREE.Vector3(x.x, x.y, -3).project(c); return { x: v.x, y: v.y }; };
    assert.equal(pick(at('pitborn-3')), 'skull:pitborn-3');
    assert.equal(pick(at('knight-10')), 'skull:knight-10', 'an unbeaten slot picks too (its card says so)');
    assert.equal(pick({ x: 0, y: -0.2 }), 'gate', 'the gate between the panels is still the gate');
    assert.ok(PANEL.colPitch * 2 <= NICHE.h * 2, 'a slot\'s pick box is its pitch, so the wall has no dead gaps');
  } finally { room.dispose(); }
});

// The full stage builds the sheet (sheet.ts), and node has no document: the least element that satisfies it.
const element = () => ({ hidden: false, textContent: '', childElementCount: 0, className: '', src: '', alt: '', width: 0, height: 0, loading: '', setAttribute() {}, append() {}, replaceChildren() {}, addEventListener() {}, remove() {} });
test('a tap on a beaten slot shows the legend\'s card; an unbeaten one says who waits there', () => {
  const made: ReturnType<typeof element>[] = [];
  (globalThis as { document?: unknown }).document = { createElement: () => { const e = element(); made.push(e); return e; }, body: element() };
  try {
    let tap: { x: number; y: number } | null = null;
    const s = stage({ owned: [], equipped: {}, defeats: ['veteran-1'] } as Loot);
    Object.assign(s, {
      readMove: () => ({ x: 0, z: 0 }), readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '', gate: () => ({ label: 'Rematch', go() {} }),
      legend: (key: string) => (key === 'veteran-1' ? { name: 'Crixus', opponent: 'the Veteran', rank: 1, source: 'Appian', backstory: 'A Gaul.', portrait: 'legends/veteran-1.webp', beaten: true } : key === 'veteran-2' ? { name: 'Ragnar', opponent: 'the Veteran', rank: 2, source: '', backstory: '', portrait: '', beaten: false } : null),
    });
    const pit = enter(s, 'win'), title = made[1]!;
    pit.frame(1 / 60); s.camera.updateMatrixWorld();
    const at = (key: string) => { const x = slots(PORTRAIT_KEYS).find((q) => q.key === key)!; const v = new THREE.Vector3(x.x, x.y, -3).project(s.camera); return { x: v.x, y: v.y }; };
    tap = at('veteran-1'); pit.frame(1 / 60);
    assert.equal(title.textContent, 'Crixus · rank 1');
    tap = at('veteran-2'); pit.frame(1 / 60);
    assert.equal(title.textContent, 'the Veteran · rank 2');
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

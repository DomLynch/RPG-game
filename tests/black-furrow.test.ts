import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Match } from '../src/match.ts';
import { OPPONENTS, RULES } from '../src/moves.ts';
import { idleIntent, stepDuel, type Duel, type CombatEvent } from '../src/duel.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { classSpecialFor } from '../src/class-special-identity.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { SPECIAL_TESTS, type SpecialTest } from '../src/special-look.ts';
import { specialCueFor } from '../src/sparring-special-runtime.ts';
import { resolveSparringPreview, sparringSpecialOptions } from '../src/sparring-specials.ts';
import { createSpecialPresentation, disposeSpecialGroup } from '../src/special-presentation.ts';
import { createRecorder } from '../src/record.ts';
import { crowdWave } from '../src/arena.ts';

const id = 'blackfurrow' as SpecialTest;
const skill = () => ({ ...idleIntent(), action: 'skill' as const });
function match(level = 1) {
  const writes: string[] = [], storage = { getItem: () => null, setItem: (key: string) => { writes.push(key); } };
  const m = new Match(OPPONENTS.executioner, 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'estoc', null, level);
  return { m, writes };
}
function cast(player = true, foe = false) {
  const { m, writes } = match(), before = writes.length;
  m.startSparring({ weapon: 'estoc', skill: null, difficulty: player && !foe ? 'dummy' : 1 }, null, { player: player ? id : null, opponent: foe ? id : null });
  m.step(() => ({ ...idleIntent(), action: 'light' }));
  for (let t = 0; t < 200; t++) m.step(() => {
    const [a, b] = m.practice.duel.fighters, gap = Math.hypot(a.body.x - b.body.x, a.body.z - b.body.z);
    return { ...idleIntent(), guard: true, move: { x: 0, z: gap > 2 ? -1 : 0, yaw: 0, run: false } };
  });
  assert.ok(!m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 0), 'player never auto-casts');
  if (player) m.step(skill);
  const frames: Duel[] = [structuredClone(m.practice.duel)];
  for (let t = 0; t < 170 && !m.practice.finish; t++) { m.step(() => ({ ...idleIntent(), guard: true })); frames.push(structuredClone(m.practice.duel)); }
  assert.equal(writes.length, before); assert.equal(m.recorder, null);
  return { m, frames };
}
const ready = (duel: Duel): Duel => ({ ...duel, fighters: duel.fighters.map((f, i) => ({ ...f, phase: 'ready', skillCooldown: 0, body: { ...f.body, x: 0, z: i, heading: i ? Math.PI : 0 } })) as Duel['fighters'] });
function accepted() {
  const { m } = match(); m.startSparring({ weapon: 'estoc', skill: null, difficulty: 'dummy' }, null, { player: id, opponent: null });
  return stepDuel(ready(m.practice.duel), [skill(), idleIntent()]);
}
const drain = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
// Measure painted texels on the real indexed surface, not its transparent plane.
function paintedBounds(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>) {
  const box = new THREE.Box3(), map = mesh.material.map as THREE.DataTexture, { width, height, data } = map.image;
  assert.ok(data, 'the actual painted texture exposes its texels');
  const positions = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv'), index = mesh.geometry.index!;
  const point = new THREE.Vector3(), weights = new THREE.Vector3(), painted = new THREE.Vector3(); mesh.updateMatrix();
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const coords = ids.map(j => new THREE.Vector3(uv.getX(j), uv.getY(j), 0)), vertices = ids.map(j => new THREE.Vector3().fromBufferAttribute(positions, j));
    const minX = Math.max(0, Math.floor(Math.min(...coords.map(v => v.x)) * (width - 1))), maxX = Math.min(width - 1, Math.ceil(Math.max(...coords.map(v => v.x)) * (width - 1)));
    const minY = Math.max(0, Math.floor(Math.min(...coords.map(v => v.y)) * (height - 1))), maxY = Math.min(height - 1, Math.ceil(Math.max(...coords.map(v => v.y)) * (height - 1)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (data[(y * width + x) * 4 + 3] <= 32) continue;
      THREE.Triangle.getBarycoord(point.set(x / (width - 1), y / (height - 1), 0), ...coords as [THREE.Vector3, THREE.Vector3, THREE.Vector3], weights);
      if (Math.min(weights.x, weights.y, weights.z) < -1e-6) continue;
      painted.copy(vertices[0]).multiplyScalar(weights.x).addScaledVector(vertices[1], weights.y).addScaledVector(vertices[2], weights.z).applyMatrix4(mesh.matrix); box.expandByPoint(painted);
    }
  }
  return box;
}

test('Black Furrow occupies only Executioner B and resolves independently on either selector', () => {
  for (const [level, expected] of [[1, null], [15, null], [16, 'blackfurrow'], [35, 'blackfurrow'], [36, null]] as const) assert.equal(classSpecialFor('executioner', level), expected);
  assert.deepEqual(SPECIAL_TESTS[id], { opponent: 'executioner', level: 21, first: 180 });
  assert.deepEqual(sparringSpecialOptions('executioner')[1].ids, ['blackfurrow']);
  assert.deepEqual(sparringSpecialOptions('pitborn')[1].ids, ['earthfold'], 'the other class B has its own identity');
  const p = resolveSparringPreview('?spar=1&opponent=executioner&weapon=estoc&difficulty=16&skill=none&special=blackfurrow&yourSpecial=blackfurrow', ['estoc']);
  assert.equal(p.invalid, false); assert.deepEqual(p.selection, { player: 'blackfurrow', opponent: 'blackfurrow' });
  assert.equal(specialCueFor(id), undefined, 'no unrelated named cue');
  assert.equal(SPECIAL_MODES[id]?.held, undefined, 'native equipped pose');
  assert.equal(SPECIAL_MODES[id]?.travel, undefined, 'no motion or kit substitution');
});

for (const [player, foe] of [[true, false], [false, true], [true, true]] as const) test(`Black Furrow genuine Match input and AI: player=${player}, foe=${foe}`, () => {
  const { m } = cast(player, foe);
  for (const actor of [0, 1] as const) {
    const start = m.fightLog.find(e => e.type === 'SpecialStarted' && e.actor === actor), land = m.fightLog.find(e => e.type === 'SpecialLanded' && e.actor === actor);
    assert.equal(!!start, actor === 0 ? player : foe); assert.equal(!!land, !!start);
    if (start && land) { assert.equal(land.tick - start.tick, RULES.special.windup - 1); assert.equal(land.target, 1 - actor); assert.equal(land.damage, Math.round(0.2 * m.practice.duel.fighters[1 - actor].maxHealth)); }
  }
  assert.equal(m.weapon, 'estoc'); assert.equal(m.practice.duel.fighters[0].weapon, 'estoc');
  m.rematch(); assert.deepEqual(m.specialIdentity.presets, [player ? id : null, foe ? id : null]);
});

test('Black Furrow actual factory follows accepted windup/landing, frozen tick and rotated caster anchors', async () => {
  for (const exposure of [1, 2]) {
    const mode = SPECIAL_MODES[id]; assert.ok(mode, 'Black Furrow has its own real lazy factory');
    const group = new THREE.Scene(), fx = await mode.load(group, 'executioner', exposure, new THREE.PerspectiveCamera());
    let duel = accepted(); const start = duel.events[0], feet = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0)] as const;
    // Factory contract is actor1; normalize actual accepted actor0 event/state without writing the sim.
    const pair = (d: Duel) => [d.fighters[1], d.fighters[0]] as const;
    const events = (d: Duel): CombatEvent[] => d.events.map(e => ({ ...e, actor: (1 - e.actor) as 0 | 1, ...(e.target === undefined ? {} : { target: (1 - e.target) as 0 | 1 }) }));
    fx.render(0, events(duel), pair(duel), duel.tick, feet, false);
    for (let t = 1; t < 80; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); fx.render(1 / 60, events(duel), pair(duel), duel.tick, feet, false); }
    const root = group.getObjectByName('black furrow')!; assert.ok(root.visible);
    const meshes = root.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
    assert.equal(meshes.length, 3, 'three broken fragments, not a row of repeated stamps'); assert.ok(meshes.every(m => m.visible && m.material.opacity > 0 && m.material.depthWrite === false));
    assert.equal(new Set(meshes.map(m => m.scale.x)).size, 3, 'unequal fragment lengths');
    const heldBounds = new THREE.Box3();
    for (const mesh of meshes) {
      const painted = paintedBounds(mesh), size = painted.getSize(new THREE.Vector3()); heldBounds.union(painted);
      assert.ok(size.x > size.z * 1.5 && size.z > 0.12, `actual alpha is a broad lateral fragment, not a thin scratch: ${JSON.stringify(size.toArray())}`);
      const map = mesh.material.map as THREE.DataTexture, data = map.image.data as Uint8Array, { width, height } = map.image;
      let opaqueSides = 0;
      for (let y = 0; y < height; y++) for (const x of [0, width - 1]) if (data[(y * width + x) * 4 + 3] > 16) opaqueSides++;
      assert.ok(opaqueSides < height * 0.1, 'torn alpha stays inside the plane instead of clipping into rectangular sides');
    }
    assert.ok(heldBounds.getSize(new THREE.Vector3()).x < 2.4, 'held painted footprint stays caster-local within the native narrow view');
    const state = () => meshes.map(m => [...m.position.toArray(), ...m.scale.toArray(), m.material.opacity]);
    const frozen = state(); fx.render(5, [], pair(duel), duel.tick, feet, false); assert.deepEqual(state(), frozen, 'same sim tick freezes geometry regardless of wall time');
    fx.render(0, [], pair(duel), duel.tick, [new THREE.Vector3(1, 0, 0), feet[1]], false); assert.ok(Math.abs(root.rotation.y - Math.PI / 2) < 1e-6);
    assert.equal(root.position.distanceTo(feet[1]), 0, 'caster anchor, not target');
    assert.equal(crowdWave.lean, null, 'no Harvest arena/crowd hook');
    while (!duel.events.some(e => e.type === 'SpecialLanded')) duel = stepDuel(duel, [idleIntent(), idleIntent()]);
    fx.render(0, events(duel), pair(duel), duel.tick, feet, false); const landed = state();
    duel = stepDuel(duel, [idleIntent(), idleIntent()]); fx.render(0, events(duel), pair(duel), duel.tick, feet, false);
    assert.notEqual(meshes.at(-1)!.position.x, landed.at(-1)![0], 'only accepted landing starts shearing payoff');
    assert.deepEqual(meshes.slice(0, -1).map(m => m.position.toArray()), landed.slice(0, -1).map(v => v.slice(0, 3)), 'one end shears, no repeated hits');
    for (let t = 1; t < 14; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); fx.render(0, events(duel), pair(duel), duel.tick, feet, false); }
    assert.ok(meshes.at(-1)!.position.x - landed.at(-1)![0] > 0.3, 'one outer end shears sideways');
    assert.ok(paintedBounds(meshes.at(-1)!).min.x - paintedBounds(meshes.at(-2)!).max.x > 0.15, 'a clear gap opens beside the fixed two-thirds');
    assert.equal(meshes.at(-1)!.position.z, landed.at(-1)![2], 'the end stays on the lateral stroke');
    assert.ok(Math.abs(meshes.at(-1)!.rotation.y) > 0.2); assert.ok(meshes.slice(0, -1).every(m => m.rotation.y === 0));
    assert.equal(meshes.at(-1)!.material.opacity, meshes[0].material.opacity, 'the detached end survives until the shared recovery fade');
    assert.equal(start.type, 'SpecialStarted');
    for (let t = 0; t < 45; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); fx.render(0, events(duel), pair(duel), duel.tick, feet, false); }
    assert.equal(root.visible, false); fx.clear(); disposeSpecialGroup(group);
  }
});

test('Black Furrow actual per-side manager keeps simulation/kit intact and releases owned resources on reset/rewind', async () => {
  const { m, frames } = cast(true, true), scene = new THREE.Scene(), presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera());
  const feet = [new THREE.Vector3(2, 0, 3), new THREE.Vector3(-2, 0, 1)] as const;
  const first = frames[0]; presentation.prepare(1, m.fightLog.filter(e => e.type === 'SpecialStarted'), first.fighters, first.tick, false, m.specialIdentity); await drain();
  presentation.render(0, first.fighters, first.tick, feet, feet, undefined, false);
  for (const side of [0, 1] as const) assert.deepEqual(scene.getObjectByName(`special actor ${side}`)!.getObjectByName('black furrow')!.position.toArray(), feet[side].toArray());
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  scene.traverse(o => { if (o instanceof THREE.Mesh) { resources.add(o.geometry); const mat = o.material as THREE.MeshBasicMaterial; resources.add(mat); if (mat.map) resources.add(mat.map); } });
  let disposals = 0; for (const resource of resources) resource.addEventListener('dispose', () => disposals++);
  const snap = structuredClone(first); presentation.render(0, first.fighters, first.tick, feet, feet, undefined, false); assert.deepEqual(first, snap);
  presentation.clear(); assert.equal(scene.children.length, 0); assert.equal(disposals, resources.size); presentation.clear(); assert.equal(disposals, resources.size, 'owned resources disposed once');
  presentation.prepare(2, [], first.fighters, first.tick, false, m.specialIdentity); await drain(); presentation.render(0, first.fighters, first.tick, feet, feet, undefined, true);
  assert.ok(scene.children.every(g => !g.getObjectByName('black furrow')?.visible), 'finisher yields the field');
  presentation.prepare(2, [], first.fighters, 0, false, m.specialIdentity); await drain(); presentation.render(0, first.fighters.map(f => ({ ...f, special: 0 })) as Duel['fighters'], 0, feet, feet, undefined, false);
  assert.ok(scene.children.every(g => !g.getObjectByName('black furrow')?.visible), 'rewind cannot retain stale stroke'); presentation.clear();
  const record = createRecorder({ build: 'test', opponent: 'executioner', weapon: 'knife', level: 15, seed: 731 }).finish('abandoned');
  const clip = m.startClip(record, 0); assert.equal(m.specialIdentity.presets, undefined); m.endClip(clip); assert.deepEqual(m.specialIdentity.presets, [id, id]);
  assert.ok(m.startReplay(record, 0, m.epoch)); assert.equal(m.specialIdentity.presets, undefined); assert.equal(m.specials, false);
});

test('Black Furrow real lethal fizzle freezes the held stroke without shearing, then clears and rearms', async () => {
  const mode = SPECIAL_MODES[id]; assert.ok(mode);
  const group = new THREE.Scene(), fx = await mode.load(group, 'executioner', 1, new THREE.PerspectiveCamera());
  const initial = accepted(), caster = { ...initial.fighters[0], health: 1, special: 0, skillCooldown: 0 };
  // Controlled initial health boundary; both start and lethal fizzle come from stepDuel.
  let duel: Duel = { ...initial, fighters: [caster, { ...initial.fighters[1], body: { ...initial.fighters[1].body, z: 2 } }], events: [] };
  duel = stepDuel(duel, [skill(), { ...idleIntent(), action: 'light' }]);
  assert.ok(duel.events.some(e => e.type === 'SpecialStarted' && e.actor === 0));
  const feet = [new THREE.Vector3(0, 0, 1), new THREE.Vector3()] as const;
  const draw = () => fx.render(0, duel.events.map(e => ({ ...e, actor: (1 - e.actor) as 0 | 1 })), [duel.fighters[1], duel.fighters[0]], duel.tick, feet, false);
  draw(); const observed: CombatEvent[] = [];
  for (let t = 0; t < 100 && !duel.events.some(e => e.type === 'SpecialFizzled'); t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); observed.push(...duel.events); draw(); }
  assert.ok(duel.events.some(e => e.type === 'SpecialFizzled' && e.actor === 0), JSON.stringify({ health: duel.fighters[0].health, observed }));
  assert.ok(!duel.events.some(e => e.type === 'SpecialLanded'));
  const root = group.getObjectByName('black furrow')!, strokes = root.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  const positions = strokes.map(m => m.position.toArray()), opacity = strokes[0].material.opacity;
  for (let t = 0; t < 10; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); draw(); }
  assert.deepEqual(strokes.map(m => m.position.toArray()), positions); assert.ok(strokes[0].material.opacity < opacity);
  for (let t = 0; t < 40; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); draw(); }
  assert.equal(root.visible, false);
  fx.clear(); duel = accepted(); draw();
  for (let t = 0; t < 60; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); draw(); }
  assert.equal(root.visible, true, 'a new actual accepted cast rearms'); fx.clear(); disposeSpecialGroup(group);
});

test('Black Furrow native class presentation selects actual actor rank, while A and boss identity remain separate', async () => {
  for (const [level, expected] of [[15, false], [16, true], [35, true], [36, false]] as const) {
    const { m } = match(level), scene = new THREE.Scene(), presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera());
    presentation.prepare(m.epoch, [], m.practice.duel.fighters, 0, false, m.specialIdentity); await drain();
    assert.equal(!!scene.getObjectByName('black furrow'), expected);
    assert.equal(m.practice.duel.fighters[1].specialShare !== undefined, level >= 16);
    assert.equal(m.practice.duel.fighters[1].specialName, level >= 36 ? 'bayingcircle' : undefined);
    presentation.clear(); assert.equal(scene.children.length, 0);
  }
});

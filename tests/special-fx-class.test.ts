import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { classLook, createClassSpecial, isClassCast } from '../src/special-fx-class.ts';
import { BACKS, BACK_PACES, classTravel, STEP_BEATS, STEP_WINDOW, walkOffset, type ClassSpecial } from '../src/special-class-timing.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { LAND_AT, advanceCast } from '../src/special-timing.ts';
import { RULES } from '../src/moves.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';

// The Witch's, the Plague Doctor's and the Knight's class specials (special-fx-class.ts): six previews, picked by Dom 2026-10-01, ground marks darker than the floor.
const KINDS: Record<ClassSpecial, { opponent: 'witch' | 'plaguedoctor' | 'knight'; level: number }> = {
  wake: { opponent: 'witch', level: 6 }, stirring: { opponent: 'witch', level: 21 }, tempo: { opponent: 'plaguedoctor', level: 6 }, pulse: { opponent: 'plaguedoctor', level: 21 }, drag: { opponent: 'knight', level: 6 }, swing: { opponent: 'knight', level: 21 },
};
const fighters = [{ special: 0 }, { special: 0, skill: 'x' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_x' } as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_x', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -2.6)] as const;
const shown = (scene: THREE.Scene) => scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'class decal').filter((m) => m.visible).length;
const drive = (kind: ClassSpecial, anchor?: THREE.Object3D) => {
  const scene = new THREE.Scene(), fx = createClassSpecial(scene, KINDS[kind].opponent, kind, 1);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false, anchor ?? null); };
  return { scene, fx, run };
};

test('the six pages are the Witch, the Plague Doctor and the Knight at rank 2 (level 6) and rank 5 (level 21), each in the registry', () => {
  for (const [id, want] of Object.entries(KINDS)) {
    assert.deepEqual(SPECIAL_TESTS[id as ClassSpecial], { ...want, first: 180 });
    assert.equal(SPECIAL_MODES[id as ClassSpecial]?.at, 'feet', `${id} is in the registry`);
  }
});

for (const kind of Object.keys(KINDS) as ClassSpecial[]) {
  test(`${kind}: nothing before the cast, marks on the sand by the landing, all gone after the recover`, () => {
    const { scene, run } = drive(kind);
    run(0, 0); assert.equal(scene.getObjectByName('special fx')!.visible, false, 'no cast, no effect');
    run(1, LAND_AT - 1, { 1: started });
    assert.ok(shown(scene) > 0, 'dark marks stand on the sand before the blow');
    run(LAND_AT, LAND_AT + 10, { [LAND_AT]: landed(LAND_AT) });
    assert.ok(shown(scene) > 0, 'and through the payoff');
    run(LAND_AT + 11, LAND_AT + 90);
    assert.equal(scene.getObjectByName('special fx')!.visible, false, 'and the cast ends');
  });
  test(`${kind}: nothing pale and nothing glowing, only decals and grains darker than the floor`, () => {
    const { scene, run } = drive(kind);
    run(1, LAND_AT + 6, { 1: started, [LAND_AT]: landed(LAND_AT) });
    scene.getObjectByName('special fx')!.traverse((o) => {
      const raw = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!raw) return;
      assert.ok(raw instanceof THREE.MeshBasicMaterial || raw instanceof THREE.PointsMaterial);
      const mat = raw as THREE.MeshBasicMaterial;
      assert.ok(mat.color.r < 0.2 && mat.color.g < 0.12 && mat.color.b < 0.07, `${kind} colour is below the sand`);
      assert.equal(mat.blending, THREE.NormalBlending, 'no additive glow');
    });
  });
}

test("the Doctor's Tempo and the Knight's Ground Drag write the caster's anchor absolutely every frame, never as a delta", () => {
  for (const kind of ['tempo', 'drag'] as const) {
    const parent = new THREE.Group(), anchor = new THREE.Object3D(); parent.add(anchor);
    const { run } = drive(kind, anchor);
    run(1, 70, { 1: started }); const mid = anchor.position.z;
    assert.ok(Math.abs(mid) > 0.05 || Math.abs(anchor.position.x) > 0.05, `${kind} has walked him`);
    anchor.position.set(0, 0, 0);   // the rig zeroes the anchor itself every frame
    run(71, 71); assert.ok(anchor.position.length() > 0.05, `${kind} writes it back absolutely, not from the last value`);
    run(72, LAND_AT, { [LAND_AT]: landed(LAND_AT) });
    const arrived = anchor.position.length(); assert.ok(arrived > 1.5, `${kind} is close to him by the blow`);
    run(LAND_AT + 1, LAND_AT + 70);
    assert.equal(anchor.position.length(), 0, `${kind} is back where the sim has him`);
  }
});

test('the three-step walk: the rig gaits only through the three step windows; the drag from DRAG_FROM; the others never', () => {
  const at = (age: number) => ({ ...fighters[1], special: RULES.special.windup - age }) as unknown as Fighter;
  const gaitAt = (kind: ClassSpecial, age: number) => classTravel(kind)(1, [fighters[0], at(age)]);
  assert.ok(gaitAt('tempo', STEP_BEATS[0] - 5)); assert.equal(gaitAt('tempo', STEP_BEATS[0] + 5), undefined);
  assert.ok(gaitAt('tempo', STEP_BEATS[1] - STEP_WINDOW + 1)); assert.equal(gaitAt('tempo', 5), BACK_PACES.tempo, 'he backs off first, the rig walking backwards');
  assert.ok(gaitAt('drag', 80)); assert.equal(gaitAt('drag', 10), BACK_PACES.drag); assert.equal(gaitAt('drag', 35), undefined);
  for (const kind of ['tempo', 'drag'] as const) { assert.equal(walkOffset(kind, 0, 4), 0); assert.ok(Math.abs(walkOffset(kind, kind === 'tempo' ? 30 : 35, 4) + BACKS[kind]) < 1e-9, `${kind} stands BACK metres behind his spot before he walks in`); assert.ok(walkOffset(kind, LAND_AT, 4) > 1.5); }
  for (const kind of ['wake', 'stirring', 'pulse', 'swing'] as const) assert.equal(SPECIAL_MODES[kind]?.travel, undefined);
});

test('the class specials ship lazily: the registry reaches the effect only by dynamic import', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-class\.ts'\)/);
  assert.ok(!readdirSync('src').some((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-fx-class\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), 'nothing imports it statically');
});

test("the shared timeline never tracks their cast: only the class test does (Hades' cloud is never on them)", () => {
  assert.equal(advanceCast(null, [started], fighters, 1, 'witch', false), null);
  assert.ok(advanceCast(null, [started], fighters, 1, 'witch', false, isClassCast));
});

// Regression for Strategy's wall-of-mud FAIL: measure actual rendered geometry/materials over the full cast.
test('Ground Drag keeps a narrow floor scrape and sparse low grit through windup and payoff', () => {
  const { scene, run } = drive('drag');
  let marks = 0, particles = 0;
  for (let tick = 1; tick <= LAND_AT + 45; tick++) {
    run(tick, tick, tick === 1 ? { 1: started } : tick === LAND_AT ? { [LAND_AT]: landed(tick) } : {});
    const root = scene.getObjectByName('special fx')!;
    for (const object of root.getObjectsByProperty('name', 'class decal').filter((o) => o.visible)) {
      const mesh = object as THREE.Mesh; marks++;
      assert.ok(mesh.position.y < 0.06, 'scrape stays on the sand');
      assert.ok(mesh.scale.x <= 0.2 && mesh.scale.z <= 0.42, 'individual stamps cannot form broad fans');
      assert.ok((mesh.material as THREE.MeshBasicMaterial).opacity <= 0.62, 'rut retains floor texture');
    }
    const grit = root.getObjectByName('class grit') as THREE.Points;
    const mat = grit.material as THREE.PointsMaterial;
    assert.ok(mat.size <= 0.06 && mat.opacity <= 0.35, 'small translucent grit');
    const positions = grit.geometry.getAttribute('position');
    let active = 0;
    for (let i = 0; i < positions.count; i++) if (positions.getY(i) >= 0) {
      particles++; active++; assert.ok(positions.getY(i) <= 0.15, 'grit stays below the ankle');
    }
    assert.ok(active <= 16, 'sparse impact, no particle curtain');
  }
  assert.ok(marks > 0 && particles > 0, 'scrape and impact cue remain present');
});

test('Ground Drag marks taper organically instead of repeating clipped rectangular blobs', () => {
  const { scene, run } = drive('drag'); run(1, LAND_AT - 1, { 1: started });
  const marks = scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'class decal') as THREE.Mesh[];
  let back = 0, tip = 0;
  const maps = new Set(marks.map((m) => (m.material as THREE.MeshBasicMaterial).map!));
  for (const map of maps) {
    const { data, width, height } = map.image as { data: Uint8Array; width: number; height: number };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (y < height / 2) back += alpha; else tip += alpha;
      if (!x || !y || x === width - 1 || y === height - 1) assert.equal(alpha, 0, 'transparent sprite border');
    }
  }
  assert.ok(tip > 0 && back > tip * 1.2, 'seeded silhouettes have a tapered tip');
  const rut = marks.slice(0, 10);
  assert.ok(new Set(rut.map((m) => m.scale.z.toFixed(3))).size >= 5, 'varied short lengths');
  const gaps = rut.slice(1).map((m, i) => m.position.distanceTo(rut[i].position));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.03, 'irregular spacing on the same maul path');
});

test('only night Ground Drag strengthens local decal contrast while retaining the exact day footprint', () => {
  const at = (exposure: number) => {
    const scene = new THREE.Scene(), fx = createClassSpecial(scene, 'knight', 'drag', exposure);
    for (let tick = 1; tick < LAND_AT; tick++) fx.render(1 / 60, tick === 1 ? [started] : [], fighters, tick, feet, false);
    return scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'class decal') as THREE.Mesh[];
  };
  const day = at(1.3), boundary = at(1.5), night = at(1.85);
  assert.ok(day.some((m) => m.visible), 'visible scrape, not an empty comparison');
  for (let i = 0; i < day.length; i++) {
    const d = day[i], n = night[i], dm = d.material as THREE.MeshBasicMaterial, nm = n.material as THREE.MeshBasicMaterial;
    assert.deepEqual([n.position.toArray(), n.scale.toArray(), n.rotation.toArray(), n.visible], [d.position.toArray(), d.scale.toArray(), d.rotation.toArray(), d.visible], 'night has the same low irregular footprint');
    assert.deepEqual((nm.map!.image as { data: Uint8Array }).data, (dm.map!.image as { data: Uint8Array }).data, 'alpha silhouette unchanged');
    assert.equal((boundary[i].material as THREE.MeshBasicMaterial).opacity, dm.opacity, 'day branch includes exposure1.5');
    assert.ok(dm.opacity <= 0.62 && nm.opacity <= 0.9, 'day stays translucent and night does not become solid');
    if (d.visible) assert.ok(nm.opacity > dm.opacity, 'local marks get stronger alpha only at night');
  }
  const core = night.slice(0, 10).map((m) => (m.material as THREE.MeshBasicMaterial).opacity);
  assert.ok(Math.max(...core) > 0.8, 'night rut opacity exceeds the rejected faint setting');
});

test('night opacity correction leaves all five other class effects unchanged through windup and recovery', () => {
  for (const kind of ['wake', 'stirring', 'tempo', 'pulse', 'swing'] as const) {
    const day = new THREE.Scene(), night = new THREE.Scene();
    const effects = [createClassSpecial(day, KINDS[kind].opponent, kind, 1.5), createClassSpecial(night, KINDS[kind].opponent, kind, 1.85)];
    for (let tick = 1; tick <= LAND_AT + 45; tick++) {
      const events = tick === 1 ? [started] : tick === LAND_AT ? [landed(tick)] : [];
      for (const fx of effects) fx.render(1 / 60, events, fighters, tick, feet, false);
      const marks = [day, night].map((s) => s.getObjectByName('special fx')!.getObjectsByProperty('name', 'class decal') as THREE.Mesh[]);
      for (let i = 0; i < marks[0].length; i++) {
        const [d, n] = [marks[0][i], marks[1][i]];
        assert.deepEqual([n.position.toArray(), n.scale.toArray(), n.rotation.toArray(), n.visible, (n.material as THREE.MeshBasicMaterial).opacity], [d.position.toArray(), d.scale.toArray(), d.rotation.toArray(), d.visible, (d.material as THREE.MeshBasicMaterial).opacity], `${kind} unchanged at tick ${tick}`);
      }
    }
  }
});

test('night Drag darkens only the local decals, preserving grit, day and other class palettes', () => {
  for (const kind of Object.keys(KINDS) as ClassSpecial[]) for (const exposure of [1.3, 1.5, 1.50001, 1.85]) {
    const scene = new THREE.Scene(); createClassSpecial(scene, KINDS[kind].opponent, kind, exposure);
    const look = classLook(exposure), marks = scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'class decal') as THREE.Mesh[];
    for (let i = 0; i < marks.length; i++) {
      const mat = marks[i].material as THREE.MeshBasicMaterial, original = i % 3 === 2 ? look.edge : look.core;
      assert.deepEqual(mat.color.toArray(), original.clone().multiplyScalar(kind === 'drag' && exposure > 1.5 ? 0.2 : 1).toArray(), `${kind}/${exposure}: decal colour`);
      assert.equal(mat.blending, THREE.NormalBlending); assert.equal(mat.fog, true);
    }
    const grit = scene.getObjectByName('class grit') as THREE.Points;
    assert.deepEqual((grit.material as THREE.PointsMaterial).color.toArray(), look.edge.toArray(), 'grit palette unchanged');
  }
});

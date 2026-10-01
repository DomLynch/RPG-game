import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createClassSpecial, isClassCast } from '../src/special-fx-class.ts';
import { BACK, BACK_PACE, classTravel, STEP_BEATS, STEP_WINDOW, walkOffset, type ClassSpecial } from '../src/special-class-timing.ts';
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
  assert.ok(gaitAt('tempo', STEP_BEATS[1] - STEP_WINDOW + 1)); assert.equal(gaitAt('tempo', 5), BACK_PACE, 'he backs off first, the rig walking backwards');
  assert.ok(gaitAt('drag', 80)); assert.equal(gaitAt('drag', 10), BACK_PACE); assert.equal(gaitAt('drag', 34), undefined);
  for (const kind of ['tempo', 'drag'] as const) { assert.equal(walkOffset(kind, 0, 4), 0); assert.ok(Math.abs(walkOffset(kind, kind === 'tempo' ? 30 : 34, 4) + BACK) < 1e-9, `${kind} stands BACK metres behind his spot before he walks in`); assert.ok(walkOffset(kind, LAND_AT, 4) > 1.5); }
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

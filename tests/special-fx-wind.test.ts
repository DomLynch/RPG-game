import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { castPhase, clawPhase, FALL_AT, LAND_AT, SPECIAL_RECOVER } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { COLUMN_HEIGHT, createRedWind, sandColour } from '../src/special-fx-wind.ts';

// Set's Red Wind (special-fx-wind.ts): the same seam and the same 120-tick timeline as the claw, its own art, in its own lazy chunk.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0.2, 0, -1.1), new THREE.Vector3(0, 0, 1)] as const;
const sand = () => sandColour(ARENA_THEMES['1'].textures.sand);
const grainsOf = (scene: THREE.Scene) => (scene.getObjectByName('red wind grains') as THREE.Points).geometry.attributes.position as THREE.BufferAttribute;
const visibleGrains = (scene: THREE.Scene) => {
  const a = grainsOf(scene), out: THREE.Vector3[] = [];
  for (let i = 0; i < a.count; i++) if (a.getY(i) > -1) out.push(new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)));
  return out;
};

test('?special=set is rank 8 (level 36) of the Nightborn, and the timeline is the claw\'s: the one 120', () => {
  assert.deepEqual(SPECIAL_TESTS.set, { opponent: 'nightborn', level: 36, first: 180 });
  assert.equal(specialParam('?special=SET'), 'set');
  assert.equal(castPhase, clawPhase, 'one timeline, two arts');
  assert.equal(LAND_AT, RULES.special.windup - 1);
});

test('the sand is the arena floor\'s own family: red-brown in daylight and in the pit', () => {
  const day = sand(), pit = sandColour(ARENA_THEMES.a.textures.sand);
  for (const c of [day, pit]) assert.ok(c.r > c.g * 1.25 && c.g > c.b * 1.25, `a saturated red-brown, not pale tan (${c.r.toFixed(2)}, ${c.g.toFixed(2)}, ${c.b.toFixed(2)})`);
  assert.ok(pit.r > day.r, "the pit's clay floor is the redder of the two");
});

test("the wind turns low round the TARGET's feet, snaps into a column, scours up through him on the landing, rains, and clears", () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', sand()), root = scene.getObjectByName('special fx')!;
  const random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, feet, false);
    assert.ok(root.visible, 'it starts on SpecialStarted');
    for (let t = 101; t < 100 + 60; t++) fx.render(1 / 60, [], fighters(), t, feet, false);
    const low = visibleGrains(scene);
    assert.ok(low.length > 60 && low.length < 520, `a wind that has picked up but is not yet at its full count (${low.length} of 520)`);
    assert.ok(low.every((p) => p.y < 0.9), 'the spiral stays low, round the feet');
    assert.ok(low.every((p) => Math.hypot(p.x - feet[0].x, p.z - feet[0].z) < 1.05), 'inside the spiral radius, centred on the target');
    assert.ok(low.every((p) => Math.hypot(p.x - feet[1].x, p.z - feet[1].z) > 1.2), "nowhere near the caster's feet");
    for (let t = 160; t < 100 + FALL_AT + 12; t++) fx.render(1 / 60, [], fighters(), t, feet, false);
    const column = visibleGrains(scene);
    assert.equal(column.length, 520, 'every grain is in it at the snap');
    assert.ok(column.every((p) => Math.hypot(p.x - feet[0].x, p.z - feet[0].z) < 0.3), 'tight: the column');
    fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, feet, false);
    for (let t = 100 + LAND_AT + 1; t <= 100 + LAND_AT + 12; t++) fx.render(1 / 60, [], fighters(), t, feet, false);
    const scour = visibleGrains(scene).reduce((m, p) => Math.max(m, p.y), 0);
    assert.ok(scour > 1.2 && scour < COLUMN_HEIGHT + 1.1, `the column scours up through him (${scour.toFixed(2)} m)`);
    for (let t = 100 + LAND_AT + 13; t <= 100 + LAND_AT + SPECIAL_RECOVER; t++) fx.render(1 / 60, [], fighters(), t, feet, false);
    assert.ok(((scene.getObjectByName('red wind grains') as THREE.Points).material as THREE.PointsMaterial).opacity < 0.01, 'the sand has rained down and faded');
    assert.ok(!root.visible, 'gone after the recover');
  } finally { Math.random = random; }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
});

test('a fizzle (the caster fell in the windup) lets the sand fall with no column and no scour', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', sand());
  fx.render(1 / 60, [started(10)], fighters(RULES.special.windup), 10, feet, false);
  for (let t = 11; t < 70; t++) fx.render(1 / 60, [], fighters(), t, feet, false);
  fx.render(1 / 60, [fizzled(70)], fighters(), 70, feet, false);
  let peak = 0;
  for (let t = 71; t <= 70 + SPECIAL_RECOVER; t++) { fx.render(1 / 60, [], fighters(), t, feet, false); peak = Math.max(peak, ...visibleGrains(scene).map((p) => p.y)); }
  assert.ok(peak < 1.1, `nothing scours up on a fizzle (${peak.toFixed(2)} m)`);
  assert.ok(!scene.getObjectByName('special fx')!.visible, 'gone once the sand has fallen');
});

test('it is cheap: two draws, no lights, no shadows, a small CPU cost per frame', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', sand()), root = scene.getObjectByName('special fx')!;
  const drawables: THREE.Object3D[] = []; let lights = 0;
  root.traverse((o) => { if (o instanceof THREE.Points || o instanceof THREE.LineSegments || o instanceof THREE.Mesh) drawables.push(o); if (o instanceof THREE.Light) lights++; });
  assert.equal(drawables.length, 2, 'one Points draw and one LineSegments draw');
  assert.ok(drawables.every((o) => !o.castShadow && !o.receiveShadow));
  assert.equal(lights, 0);
  fx.render(1 / 60, [started(0)], fighters(RULES.special.windup), 0, feet, false);
  const start = performance.now(); for (let t = 1; t <= 120; t++) fx.render(1 / 60, [], fighters(), t, feet, false);
  const perFrame = (performance.now() - start) / 120;
  assert.ok(perFrame < 1.5, `a small fraction of a 16 ms frame (${perFrame.toFixed(3)} ms per frame)`);
});

test('special-fx-wind ships in its own lazy chunk: nothing imports it statically, and the scene loads it on demand', () => {
  const files = readdirSync('src').filter((f) => f.endsWith('.ts'));
  assert.deepEqual(files.filter((f) => /from\s+['"]\.\/special-fx-wind\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), []);
  assert.match(readFileSync('src/scene.ts', 'utf8'), /import\('\.\/special-fx-wind\.ts'\)/);
});

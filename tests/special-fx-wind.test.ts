import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { castPhase, clawPhase, FALL_AT, LAND_AT, SPECIAL_RECOVER } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { COLUMN_HEIGHT, COLUMN_RADIUS, KNEE, createRedWind, sandLook } from '../src/special-fx-wind.ts';

// Set's Red Wind (special-fx-wind.ts): the same seam and the same 120-tick timeline as the claw, its own art, in its own lazy chunk.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0.2, 0, -1.1), new THREE.Vector3(0, 0, 1)] as const;
const day = () => sandLook(ARENA_THEMES['1'].exposure);
const veilOf = (scene: THREE.Scene) => scene.getObjectByName('red wind veil') as THREE.Mesh;
const veilOpacity = (scene: THREE.Scene) => (veilOf(scene).material as THREE.MeshBasicMaterial).opacity;
// The grains as streaks: the head (where it is) and the tail (where it was a moment ago), skipping the ones parked out of sight.
const grainsOf = (scene: THREE.Scene) => {
  const a = (scene.getObjectByName('red wind streaks') as THREE.LineSegments).geometry.attributes.position as THREE.BufferAttribute, out: { head: THREE.Vector3; tail: THREE.Vector3 }[] = [];
  for (let i = 0; i < a.count; i += 2) if (a.getY(i) > -1) out.push({ head: new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)), tail: new THREE.Vector3(a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1)) });
  return out;
};
const run = (fx: ReturnType<typeof createRedWind>, from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters(), t, feet, false); };

test('?special=set is rank 8 (level 36) of the Nightborn, and the timeline is the claw\'s: the one 120', () => {
  assert.deepEqual(SPECIAL_TESTS.set, { opponent: 'nightborn', level: 36, first: 180 });
  assert.equal(specialParam('?special=SET'), 'set');
  assert.equal(castPhase, clawPhase, 'one timeline, two arts');
  assert.equal(LAND_AT, RULES.special.windup - 1);
});

test('it is a GREY wind: a dust-grey core with a lighter warm-grey rim in daylight, a pale grey core in the pit, nothing saturated', () => {
  const light = day(), pit = sandLook(ARENA_THEMES.a.exposure);
  assert.ok(!light.dim && pit.dim);
  const lum = (c: THREE.Color) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const flat = (c: THREE.Color) => c.r < c.b * 1.3 && c.r > c.b;
  assert.ok(flat(light.core) && flat(light.edge) && flat(pit.core), 'pale warm grey to dust grey, no red or orange');
  assert.ok(lum(light.core) < lum(light.edge) * 0.6, 'a darker core than its rim, so it reads on pale sand');
});

test("the ring turns low round the TARGET's feet, tightens to knee height, snaps to a column, scours past his head on the landing, rains, and clears", () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day()), root = scene.getObjectByName('special fx')!, veil = veilOf(scene);
  const random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, feet, false);
    assert.ok(root.visible, 'it starts on SpecialStarted');
    run(fx, 101, 160);
    assert.ok(veilOpacity(scene) > 0.4, 'the ring is dense mid wind-up');
    assert.ok(veil.scale.x > 0.6 && veil.scale.x <= 1, `a wide ring (${veil.scale.x.toFixed(2)} m)`);
    assert.ok(veil.scale.y > 0.15 && veil.scale.y <= KNEE, `low, rising toward the knee (${veil.scale.y.toFixed(2)} m)`);
    assert.ok(veil.position.distanceTo(feet[0]) < 1e-6, "centred on the target's feet");
    const low = grainsOf(scene);
    assert.ok(low.length > 60, `grains lift as it builds (${low.length})`);
    assert.ok(low.every((g) => g.head.y < 0.75 && Math.hypot(g.head.x - feet[0].x, g.head.z - feet[0].z) < 1.3), 'all of them on the ring');
    assert.ok(low.every((g) => Math.hypot(g.head.x - feet[1].x, g.head.z - feet[1].z) > 1.2), 'none anywhere near the caster');
    const moving = low.filter((g) => g.head.distanceTo(g.tail) > 0.03);
    assert.ok(moving.length > 40, `streaks, not dots (${moving.length} have length)`);
    const along = moving.reduce((m, g) => { const radial = new THREE.Vector3(g.head.x - feet[0].x, 0, g.head.z - feet[0].z).normalize(), d = g.tail.clone().sub(g.head).normalize(); return m + Math.abs(radial.dot(d)); }, 0) / moving.length;
    assert.ok(along < 0.45, `along the direction of travel, round the ring, not across it (radial share ${along.toFixed(2)})`);
    run(fx, 161, 100 + FALL_AT + 12);
    assert.ok(veil.scale.x < COLUMN_RADIUS * 1.15 && veil.scale.y > 0.85 && veil.scale.y < 1.15, `one tight column at the snap (${veil.scale.x.toFixed(2)} x ${veil.scale.y.toFixed(2)} m)`);
    fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, feet, false);
    run(fx, 100 + LAND_AT + 1, 100 + LAND_AT + 18);
    assert.ok(veil.scale.y > 2.2 && veil.scale.y <= COLUMN_HEIGHT + 0.01, `the column scours up past his head in ~0.3 s (${veil.scale.y.toFixed(2)} m)`);
    assert.ok(grainsOf(scene).reduce((m, g) => Math.max(m, g.head.y), 0) > 1.8, 'the grains go up with it');
    run(fx, 100 + LAND_AT + 19, 100 + LAND_AT + SPECIAL_RECOVER);
    assert.ok(veilOpacity(scene) < 0.02, 'the sand has rained down and faded');
    const rest = grainsOf(scene); assert.ok(rest.reduce((m, g) => m + g.head.y, 0) / rest.length < 1, 'what is left has mostly fallen');
    assert.ok(!root.visible, 'gone after the recover');
  } finally { Math.random = random; }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
});

test('a fizzle (the caster fell in the windup) lets the ring fall with no column and no scour', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day());
  fx.render(1 / 60, [started(10)], fighters(RULES.special.windup), 10, feet, false);
  run(fx, 11, 69);
  run(fx, 70, 70, { 70: fizzled(70) });
  let peak = 0;
  for (let t = 71; t <= 70 + SPECIAL_RECOVER; t++) { run(fx, t, t); peak = Math.max(peak, veilOf(scene).scale.y); }
  assert.ok(peak < KNEE * 1.1, `it never rises past the ring (${peak.toFixed(2)} m)`);
  assert.ok(veilOf(scene).scale.y < 0.05 && !scene.getObjectByName('special fx')!.visible, 'settled to the floor and gone');
});

test('it is cheap: two draws, no lights, no shadows, a small CPU cost per frame', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day()), root = scene.getObjectByName('special fx')!;
  const drawables: THREE.Object3D[] = []; let lights = 0;
  root.traverse((o) => { if (o instanceof THREE.LineSegments || o instanceof THREE.Mesh || o instanceof THREE.Points) drawables.push(o); if (o instanceof THREE.Light) lights++; });
  assert.equal(drawables.length, 2, 'one veil and one set of grain streaks');
  assert.ok(drawables.every((o) => !o.castShadow && !o.receiveShadow));
  assert.equal(lights, 0);
  fx.render(1 / 60, [started(0)], fighters(RULES.special.windup), 0, feet, false);
  let perFrame = Infinity;   // best of three batches: the gate runs the whole suite in parallel, and one scheduler stall is not the effect's cost
  for (let b = 0; b < 3; b++) { const start = performance.now(); run(fx, 1, 120); perFrame = Math.min(perFrame, (performance.now() - start) / 120); }
  assert.ok(perFrame < 1.5, `a small fraction of a 16 ms frame (${perFrame.toFixed(3)} ms per frame)`);
});

test('special-fx-wind ships in its own lazy chunk: nothing imports it statically, and the scene loads it on demand', () => {
  const files = readdirSync('src').filter((f) => f.endsWith('.ts'));
  assert.deepEqual(files.filter((f) => /from\s+['"]\.\/special-fx-wind\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), []);
  assert.match(readFileSync('src/scene.ts', 'utf8'), /import\('\.\/special-fx-wind\.ts'\)/);
});

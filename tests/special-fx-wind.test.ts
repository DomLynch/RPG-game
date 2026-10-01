import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { castPhase, shadowPhase, LAND_AT } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { createRedWind, sandLook } from '../src/special-fx-wind.ts';

// Set's Red Wind (special-fx-wind.ts): the same seam and the same 120-tick timeline as Hades' cloud, its own art (a ground burst), in its own lazy chunk.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0.2, 0, -1.1), new THREE.Vector3(0, 0, 1)] as const;
const day = () => sandLook(ARENA_THEMES['1'].exposure);
const run = (fx: ReturnType<typeof createRedWind>, from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters(), t, feet, false); };
const parts = (scene: THREE.Scene, name: string) => scene.getObjectByName('special fx')!.children.filter((o) => o.name === name) as THREE.Mesh[];
const opacity = (meshes: THREE.Mesh[]) => Math.max(0, ...meshes.map((m) => (m.material as THREE.MeshBasicMaterial).opacity));

test("?special=set is rank 8 (level 36) of the Nightborn, and the timeline is Hades' cloud's: the one 120", () => {
  assert.deepEqual(SPECIAL_TESTS.set, { opponent: 'nightborn', level: 36, first: 180 });
  assert.equal(specialParam('?special=SET'), 'set');
  assert.equal(castPhase, shadowPhase, 'one timeline, two arts');
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

test('the ground burst: painted strokes, no lights, no lines, no shadows, quiet when idle, faint in the windup, strongest on the release, gone after', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day()), root = scene.getObjectByName('special fx')!;
  const meshes: THREE.Mesh[] = []; let lights = 0, lines = 0;
  root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); if (o instanceof THREE.Light) lights++; if (o instanceof THREE.LineSegments) lines++; });
  assert.equal(parts(scene, 'wind streak').length, 11); assert.equal(parts(scene, 'wind sheet').length, 4);
  assert.equal(lights + lines, 0, 'no lights, no code-drawn lines');
  assert.ok(meshes.every((m) => !m.castShadow && !m.receiveShadow && (m.material as THREE.MeshBasicMaterial).map));
  const all = () => opacity(meshes);
  run(fx, 0, 0); assert.equal(all(), 0, 'nothing before a cast');
  run(fx, 1, 100, { 1: started(1) });
  const wind = all(); assert.ok(wind > 0.05 && wind <= 0.81, `visible in the windup, semi-transparent (${wind.toFixed(2)})`);
  assert.equal(opacity(parts(scene, 'wind sheet')), 0, 'the sheets wait for the release');
  run(fx, 101, LAND_AT);
  let peak = 0, sheet = 0; for (let t = LAND_AT + 1; t <= LAND_AT + 22; t++) { run(fx, t, t, t === LAND_AT + 1 ? { [t]: landed(t) } : {}); peak = Math.max(peak, all()); sheet = Math.max(sheet, opacity(parts(scene, 'wind sheet'))); }
  assert.ok(peak > wind && peak <= 0.81, `the release is stronger than the windup (${peak.toFixed(2)})`);
  assert.ok(sheet > 0.5, `the sheets peel up over the target (${sheet.toFixed(2)})`);
  for (const m of meshes) for (const v of (m.geometry.attributes.position as THREE.BufferAttribute).array) assert.ok(Number.isFinite(v));
  run(fx, LAND_AT + 23, LAND_AT + 140); assert.ok(all() < 0.02, 'gone after the recovery');
  assert.ok(!root.visible, 'and the group is hidden');
});

test("it draws at the TARGET's feet, never at the caster's, and its code never calls Math.random", () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day()), root = scene.getObjectByName('special fx')!;
  run(fx, 0, 0); run(fx, 1, 60, { 1: started(1) });
  assert.ok(root.position.distanceTo(feet[0]) < 1e-6, "centred on the target's feet");
  // (three.js itself draws UUIDs for each new geometry through Math.random; that has no visual effect, so the rule is checked on this file's own code)
  const code = readFileSync('src/special-fx-wind.ts', 'utf8').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/Math\.random/.test(code));
});

test('a fizzle (the caster fell in the windup) lets the wind settle with no burst and no sheets', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day());
  run(fx, 1, 70, { 1: started(1) }); assert.ok(opacity(parts(scene, 'wind streak')) > 0.05);
  run(fx, 71, 71, { 71: fizzled(71) }); run(fx, 72, 200);
  assert.equal(opacity(parts(scene, 'wind sheet')), 0, 'no sheets, ever');
  assert.ok(opacity(parts(scene, 'wind streak')) < 0.02, 'settled and gone');
});

test('it is cheap: no lights, no shadows, a small CPU cost per frame', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day());
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


test('the ground build-up snaps in about half a second, then holds until the release (Dom: it was 1-2 s)', () => {
  const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day());
  run(fx, 0, 1, { 1: started(1) });
  run(fx, 2, 31); const half = opacity(parts(scene, 'wind streak'));
  run(fx, 32, 100); const later = opacity(parts(scene, 'wind streak'));
  assert.ok(half > later * 0.95, `already at its gathered strength by 0.5 s (${half.toFixed(3)} vs ${later.toFixed(3)})`);
  assert.ok(half > 0.3, `and clearly visible (${half.toFixed(3)})`);
});

test('every cast makes a different ground star (uneven angles, three lengths, gaps, curves), the same cast always the same', () => {
  const star = (start: number) => {
    const scene = new THREE.Scene(), fx = createRedWind(scene, 'nightborn', day());
    run(fx, start - 1, start - 1); run(fx, start, start + 40, { [start]: started(start) });
    const meshes = parts(scene, 'wind streak');
    const tip = (m: THREE.Mesh) => { const a = m.geometry.attributes.position as THREE.BufferAttribute, k = a.count - 3; return [Math.atan2(a.getZ(k), a.getX(k)), Math.hypot(a.getX(k), a.getZ(k))]; };
    return { tips: meshes.map((m) => tip(m)[0]), lengths: meshes.map((m) => tip(m)[1]), shown: meshes.filter((m) => (m.material as THREE.MeshBasicMaterial).opacity > 0).length };
  };
  const one = star(10), again = star(10), other = star(200);
  assert.deepEqual(one, again, 'deterministic: the same cast, the same star');
  assert.notDeepEqual(one.tips, other.tips, 'a different cast turns and spreads the star differently');
  assert.ok(one.shown >= 8 && one.shown <= 10, `one or two gaps (${one.shown} of 11 shown)`);
  const sorted = [...one.tips].sort((x, y) => x - y), gaps = sorted.map((v, i) => (sorted[(i + 1) % sorted.length] - v + Math.PI * 2) % (Math.PI * 2));
  assert.ok(Math.max(...gaps) > 2.2 * Math.min(...gaps.filter((g) => g > 0.01)), 'uneven angles: the biggest gap is much wider than the smallest');
  assert.ok(Math.max(...one.lengths) > 1.8 * Math.min(...one.lengths), 'short and long streaks');
});

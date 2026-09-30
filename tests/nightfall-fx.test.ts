import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { LAND_AT, type Cast } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { DRAIN_DONE, nightfall, RETURN, VEIL } from '../src/nightfall-timing.ts';
import { createNightfallFx, FLOOR } from '../src/nightfall-fx.ts';

// Nyx's Nightfall (nightfall-timing.ts, nightfall-fx.ts): the arena's light drains over the windup, a veil sweeps at the release and the light
// returns in ~0.5 s. Presentation only: it follows Combat's special events on the sim's ticks and ships in its own lazy chunk.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;
const cast: Cast = { actor: 1, start: 1000, landed: null, fizzled: null };

test('?special=nyx is the Nightborn at level 46 with the early first cast, and hades is unchanged', () => {
  assert.deepEqual(SPECIAL_TESTS.nyx, { opponent: 'nightborn', level: 46, first: 180 });
  assert.equal(SPECIAL_TESTS.hades.level, 41);
  assert.equal(specialParam('?special=nyx&arena=a'), 'nyx');
});

test('the dark builds to full over the windup, holds a beat, and the release comes on the landing tick', () => {
  assert.equal(DRAIN_DONE, LAND_AT - 15);
  assert.equal(nightfall(cast, 1000).drain, 0);
  let last = 0;
  for (let t = 1000; t <= 1000 + LAND_AT; t++) { const d = nightfall(cast, t).drain; assert.ok(d >= last, 'the drain never lifts before the release'); last = d; }
  assert.equal(nightfall(cast, 1000 + DRAIN_DONE).drain, 1);
  assert.equal(nightfall(cast, 1000 + LAND_AT).drain, 1, 'fully dark on the landing tick');
  assert.equal(nightfall(cast, 1000 + LAND_AT).veil, null, 'no veil until SpecialLanded');
  assert.equal(LAND_AT, RULES.special.windup - 1, 'the timing comes from the rule, the one source of the 120');
});

test('at the release the veil sweeps in 24 ticks while the light returns in 30', () => {
  const hit: Cast = { ...cast, landed: 1000 + LAND_AT }, at = (age: number) => nightfall(hit, 1000 + LAND_AT + age);
  assert.equal(at(0).veil, 0); assert.ok(at(VEIL - 1).veil! < 1); assert.equal(at(VEIL).veil, null, 'the sweep is over after VEIL ticks');
  assert.equal(at(0).drain, 1); assert.ok(at(RETURN / 2).drain < 0.6 && at(RETURN / 2).drain > 0.4, 'half back at the midpoint');
  assert.equal(at(RETURN).drain, 0, 'the light is fully back ~0.5 s after the release');
});

test('a fizzle returns the light from wherever the drain had reached, with no veil', () => {
  const at60: Cast = { ...cast, fizzled: 1060 }, start = nightfall(at60, 1060).drain;
  assert.ok(start > 0 && start < 1);
  assert.equal(nightfall(at60, 1060 + RETURN / 2).veil, null);
  assert.ok(nightfall(at60, 1060 + RETURN / 2).drain < start);
  assert.equal(nightfall(at60, 1060 + RETURN).drain, 0);
});

test('the whole cast on a scene: exposure to the floor, a moon rim while dark, the veil at the release, then everything put back exactly', () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#c8b08a');
  const original = scene.background.clone(), camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2.4, 3.6);
  const fx = createNightfallFx(scene, camera, 'nightborn'), root = scene.getObjectByName('nightfall')!, veil = scene.getObjectByName('nightfall veil') as THREE.Mesh, moon = scene.getObjectByName('nightfall moon') as THREE.DirectionalLight;
  const heads = [new THREE.Vector3(0, 1.7, 1), new THREE.Vector3(0.1, 1.9, -1.2)] as const, lights = () => scene.children.filter((o) => (o as THREE.Light).isLight).length;
  const before = lights(), random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, heads, false);
    assert.equal(fx.exposure, 1); assert.equal(moon.intensity, 0, 'no rim while the light is on');
    for (let t = 101; t <= 100 + LAND_AT; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    assert.ok(Math.abs(fx.exposure - FLOOR) < 1e-9 && FLOOR > 0, `near-black at the release, never black (${fx.exposure})`);
    assert.ok(moon.intensity > 1, 'the cold rim carries the fighters through the dark'); assert.ok(!root.visible, 'no veil yet');
    assert.ok((scene.background as THREE.Color).r < original.r * 0.2, 'the sky colour drains with the light');
    fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, heads, false);
    fx.render(1 / 60, [], fighters(), 100 + LAND_AT + 8, heads, false);
    assert.ok(root.visible && (veil.material as THREE.MeshBasicMaterial).opacity > 0.5, 'the veil is drawn mid-sweep');
    const travel = veil.position.clone().sub(new THREE.Vector3(heads[1].x, veil.position.y, heads[1].z));
    assert.ok(travel.dot(new THREE.Vector3(heads[0].x - heads[1].x, 0, heads[0].z - heads[1].z)) > 0, 'it sweeps from the caster toward the target');
    for (let t = 100 + LAND_AT + 9; t <= 100 + LAND_AT + RETURN + 4; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    assert.ok(!root.visible); assert.equal(fx.exposure, 1, 'the light is fully back'); assert.equal(moon.intensity, 0);
    assert.ok((scene.background as THREE.Color).equals(original), 'the theme sky colour is put back exactly');
    assert.equal(lights(), before, 'no light is added or removed mid-cast (no shader recompiles)');
  } finally { Math.random = random; }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
  fx.render(1 / 60, [started(900)], fighters(RULES.special.windup), 900, heads, false); fx.render(1 / 60, [], fighters(), 960, heads, false);
  assert.ok(fx.exposure < 1); fx.clear(); assert.equal(fx.exposure, 1, 'clear() lifts the dark at once'); assert.ok((scene.background as THREE.Color).equals(original));
});

test('the cloak texture is near-black with a cold glint: no channel wraps (the rainbow the first clip showed)', () => {
  const scene = new THREE.Scene(), veil = (createNightfallFx(scene, new THREE.PerspectiveCamera(), 'nightborn'), scene.getObjectByName('nightfall veil') as THREE.Mesh);
  const data = ((veil.material as THREE.MeshBasicMaterial).map!.image as { data: Uint8Array }).data;
  for (let i = 0; i < data.length; i += 4) assert.ok(data[i] <= 68 && data[i + 1] <= 86 && data[i + 2] <= 144, `pixel ${i / 4} stays a dark blue-black (${data[i]}, ${data[i + 1]}, ${data[i + 2]})`);
});

test('a rig still loading (no head bones) still drains the light, and a fizzle with nothing to draw is harmless', () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#222'); const fx = createNightfallFx(scene, new THREE.PerspectiveCamera(), 'nightborn');
  fx.render(1 / 60, [started(10)], fighters(RULES.special.windup), 10, [null, null], false);
  for (let t = 11; t < 90; t++) fx.render(1 / 60, [], fighters(), t, [null, null], false);
  assert.ok(fx.exposure < 0.6); fx.render(1 / 60, [fizzled(90)], fighters(), 90, [null, null], false);
  for (let t = 91; t < 130; t++) fx.render(1 / 60, [], fighters(), t, [null, null], false);
  assert.equal(fx.exposure, 1);
});

test('nightfall-fx ships in its own lazy chunk: nothing imports it statically, and the scene applies its exposure and clears it', () => {
  const files = readdirSync('src').filter((f) => f.endsWith('.ts'));
  assert.deepEqual(files.filter((f) => /from\s+['"]\.\/nightfall-fx\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), [], 'a static import would put it in every fight download');
  const scene = readFileSync('src/scene.ts', 'utf8');
  assert.match(scene, /import\('\.\/nightfall-fx\.ts'\)/); assert.match(scene, /nightfall\?\.exposure/); assert.match(scene, /nightfall\?\.clear\(\)/);
});

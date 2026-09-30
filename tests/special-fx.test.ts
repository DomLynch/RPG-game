import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { advanceCast, shadowPhase, CAST_MARGIN, DROP_TICKS, FALL_AT, LAND_AT, SPECIAL_RECOVER, type Cast } from '../src/special-timing.ts';
import { CLOUD_HIGH, CLOUD_LOW, createSpecialFx } from '../src/special-fx.ts';

// Hades' Shadow (special-timing.ts, special-fx.ts): the presentation follows Combat's special events on the sim's own ticks, draws
// only for the Nightborn's lunge special, and ships in its own lazy chunk.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number, extra: object = {}) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge', ...extra }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;

test('the cloud lands on the windup end: gather above the head, a 24-tick drop, then cover and clear over 45 ticks', () => {
  assert.equal(LAND_AT, RULES.special.windup - 1, 'the landing tick comes from the rule, the one source of the 120');
  assert.equal(FALL_AT, LAND_AT - DROP_TICKS);
  const cast: Cast = { actor: 1, start: 1000, landed: null, fizzled: null };
  assert.equal(shadowPhase(cast, 1000).phase, 'gather');
  assert.equal(shadowPhase(cast, 1000 + FALL_AT - 1).phase, 'gather');
  assert.equal(shadowPhase(cast, 1000 + FALL_AT).phase, 'fall');
  assert.equal(shadowPhase(cast, 1000 + LAND_AT).k, 1, 'the cloud reaches the head on the landing tick');
  const hit = { ...cast, landed: 1000 + LAND_AT };
  assert.equal(shadowPhase(hit, 1000 + LAND_AT).phase, 'recover');
  assert.equal(shadowPhase(hit, 1000 + LAND_AT + SPECIAL_RECOVER).phase, 'done');
  assert.equal(shadowPhase({ ...cast, fizzled: 1050 }, 1060).phase, 'dissolve', 'a fizzle dissolves the cloud where it hangs');
});

test('only the Nightborn lunge special on the opponent side casts; a finisher playing starts nothing', () => {
  assert.ok(advanceCast(null, [started(10)], fighters(), 10, 'nightborn', false));
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'veteran', false), null, 'another opponent draws nothing yet');
  assert.equal(advanceCast(null, [started(10, { actor: 0 })], fighters(), 10, 'nightborn', false), null, "the player's special has no art yet");
  assert.equal(advanceCast(null, [started(10, { move: 'skill_jab' })], fighters(), 10, 'nightborn', false), null);
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'nightborn', true), null, 'yielding: no new cast');
  const cast = advanceCast(null, [started(10)], fighters(), 10, 'nightborn', false)!;
  assert.equal(advanceCast(cast, [landed(10 + LAND_AT)], fighters(), 10 + LAND_AT, 'nightborn', true)?.landed, 10 + LAND_AT, 'a lethal release still lands and tears');
  assert.equal(advanceCast(cast, [fizzled(40)], fighters(), 40, 'nightborn', false)?.fizzled, 40);
  assert.equal(advanceCast({ ...cast, landed: 129 }, [], fighters(), 129 + SPECIAL_RECOVER, 'nightborn', false), null, 'the cast ends after the tear');
});

test('a windup already running when the effect loads is picked up from the fighter', () => {
  const cast = advanceCast(null, [], fighters(RULES.special.windup - 30), 500, 'nightborn', false);
  assert.equal(cast?.start, 470, 'the start is back-dated from the ticks left');
});

const meanOf = (scene: THREE.Scene, name: string, n: number) => { const pts = Array.from({ length: n }, (_, i) => scene.getObjectByName(`${name} ${i}`)!.position); return pts.reduce((m, p) => m.clone().add(p), new THREE.Vector3()).divideScalar(n); };

test('the cloud gathers above the head, drops onto it on the landing tick with a burst, covers it, then clears; no claw, no Math.random', () => {
  const scene = new THREE.Scene(), fx = createSpecialFx(scene, 'nightborn'), root = scene.getObjectByName('special fx')!;
  const head = new THREE.Vector3(0.2, 1.62, -1.1), heads = [head, new THREE.Vector3(0, 1.7, 1)] as const;
  const random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, heads, false);
    assert.ok(root.visible, 'the cloud starts on SpecialStarted');
    for (let t = 101; t < 100 + FALL_AT - 1; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    const high = meanOf(scene, 'cloud', 14);
    // The cloud's anchor is the TARGET's Head bone (the player, side 0, for the opponent's cast), never the caster's.
    assert.ok(Math.hypot(high.x - head.x, high.z - head.z) < 0.2, `cloud centred over the target's head (${high.x.toFixed(2)}, ${high.z.toFixed(2)})`);
    assert.ok(Math.abs(high.y - (head.y + CLOUD_HIGH)) < 0.12, `gathers ${CLOUD_HIGH} m above the target's Head bone (${(high.y - head.y).toFixed(2)})`);
    assert.ok(high.distanceTo(heads[1]) > 1.5, "nowhere near the caster's head");
    for (let t = 100 + FALL_AT - 1; t <= 100 + LAND_AT; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    const low = meanOf(scene, 'cloud', 14);
    assert.ok(Math.abs(low.y - (head.y + CLOUD_LOW)) < 0.12 && high.y - low.y > 0.45, `it has dropped onto the head (${(low.y - head.y).toFixed(2)} m above it)`);
    fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, heads, false);
    assert.ok((scene.getObjectByName('burst 0') as THREE.Sprite).visible, 'the dark burst fires at the head on SpecialLanded');
    assert.ok(((scene.getObjectByName('cloud 0') as THREE.Sprite).material as THREE.SpriteMaterial).opacity > 0.5, 'still dense as it closes over the head');
    for (let t = 101 + LAND_AT; t <= 100 + LAND_AT + SPECIAL_RECOVER + 40; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    assert.ok(!root.visible, 'everything is gone after the clear and the burst');
    assert.ok((scene.getObjectByName('cloud 0') as THREE.Sprite).visible === false && (scene.getObjectByName('halo 0') as THREE.Sprite).visible === false, 'the cast ending by itself hides the cloud and the halo');
  } finally { Math.random = random; }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
  let meshes = 0; root.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  assert.equal(meshes, 0, 'the cloud is sprites only: no claw mesh');
});

test('special-fx ships in its own lazy chunk: nothing imports it statically', () => {
  const files = readdirSync('src').filter((f) => f.endsWith('.ts'));
  const statics = files.filter((f) => /from\s+['"]\.\/special-fx\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8')));
  assert.deepEqual(statics, [], 'a static import would put the claw in every fight download');
  assert.match(readFileSync('src/scene.ts', 'utf8'), /import\('\.\/special-fx\.ts'\)/, 'the scene loads it on demand');
});

// The black cloud draws over the target (no depth test) with a violet-grey halo bank under the black so it still reads on the Night Pit.
test('the cloud draws over the target (no depth test) with a halo bank under the black, and the halo clears with the cast', () => {
  const scene = new THREE.Scene(), fx = createSpecialFx(scene, 'nightborn'), head = new THREE.Vector3(0, 1.6, -1), heads = [head, new THREE.Vector3(0, 1.7, 1)] as const;
  fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, heads, false);
  for (let t = 101; t < 100 + FALL_AT; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
  const cloud = scene.getObjectByName('cloud 0') as THREE.Sprite, halo = scene.getObjectByName('halo 0') as THREE.Sprite;
  assert.equal((cloud.material as THREE.SpriteMaterial).depthTest, false);
  assert.equal((halo.material as THREE.SpriteMaterial).depthTest, false);
  assert.ok(halo.visible && (halo.material as THREE.SpriteMaterial).opacity > 0.1 && halo.renderOrder < cloud.renderOrder, 'the halo is visible and sits under the black');
  fx.clear();
  assert.ok(!scene.getObjectByName('special fx')!.visible);
});

// A wind-up that releases on an already-dead target ends with NO sim event (Auditer P3 on #1186, same hole): a cast with no end must not hold its effect
// until the next fight. Every cast has a hard timeout (wind-up + recover + a margin) after which the effect force-ends.
test('a cast that never gets an end event force-ends after the wind-up, the recover and a margin', () => {
  const cast = { actor: 1, start: 1000, landed: null, fizzled: null } as Cast;
  assert.notEqual(shadowPhase(cast, 1000 + LAND_AT + SPECIAL_RECOVER).phase, 'done', 'still inside the window: not yet');
  assert.equal(shadowPhase(cast, 1000 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN).phase, 'done', 'the timeout ends a cast with no event');
  assert.equal(advanceCast(cast, [], fighters(), 1000 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN, 'nightborn', false), null);
  const scene = new THREE.Scene(), fx = createSpecialFx(scene, 'nightborn'), root = scene.getObjectByName('special fx')!;
  const head = new THREE.Vector3(0, 1.6, -1), heads = [head, new THREE.Vector3(0, 1.7, 1)] as const;
  fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, heads, false);
  for (let t = 101; t < 100 + LAND_AT + SPECIAL_RECOVER; t++) fx.render(1 / 60, [], fighters(), t, heads, false);   // no SpecialLanded, no SpecialFizzled
  assert.ok(root.visible, 'a cast with no end event is still drawn inside the window');
  for (let t = 100 + LAND_AT + SPECIAL_RECOVER; t <= 100 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN + 1; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
  assert.ok(!root.visible, 'the effect is cleared once the timeout passes');
  assert.ok((scene.getObjectByName('cloud 0') as THREE.Sprite).visible === false && (scene.getObjectByName('halo 0') as THREE.Sprite).visible === false);
});

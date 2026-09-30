import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { advanceCast, clawPhase, CLAW_FALL, CLAW_FORM, FALL_AT, FORM_AT, LAND_AT, SPECIAL_RECOVER, type Cast } from '../src/special-timing.ts';
import { CLOUD_HEIGHT, createSpecialFx } from '../src/special-fx.ts';

// Hades' Shadow Claw (special-timing.ts, special-fx.ts): the presentation follows Combat's special events on the sim's own ticks, draws
// only for the Nightborn's lunge special, and ships in its own lazy chunk.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number, extra: object = {}) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge', ...extra }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;

test('the claw lands on the windup end: gather, 18 ticks forming, 12 falling, then a 45-tick tear', () => {
  assert.equal(LAND_AT, RULES.special.windup - 1, 'the landing tick comes from the rule, the one source of the 120');
  assert.equal(FALL_AT, LAND_AT - CLAW_FALL); assert.equal(FORM_AT, LAND_AT - CLAW_FALL - CLAW_FORM);
  const cast: Cast = { actor: 1, start: 1000, landed: null, fizzled: null };
  assert.equal(clawPhase(cast, 1000).phase, 'gather');
  assert.equal(clawPhase(cast, 1000 + FORM_AT).phase, 'form');
  assert.equal(clawPhase(cast, 1000 + FALL_AT).phase, 'fall');
  assert.equal(clawPhase(cast, 1000 + LAND_AT).k, 1, 'the claw reaches the head on the landing tick');
  const hit = { ...cast, landed: 1000 + LAND_AT };
  assert.equal(clawPhase(hit, 1000 + LAND_AT).phase, 'recover');
  assert.equal(clawPhase(hit, 1000 + LAND_AT + SPECIAL_RECOVER).phase, 'done');
  assert.equal(clawPhase({ ...cast, fizzled: 1050 }, 1060).phase, 'dissolve', 'a fizzle dissolves the cloud, no claw');
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

test('the effect gathers a cloud over the head, drops the claw on it, bursts, then clears, without touching Math.random', () => {
  const scene = new THREE.Scene(), fx = createSpecialFx(scene, 'nightborn'), root = scene.getObjectByName('special fx')!, claw = scene.getObjectByName('shadow claw')!;
  const head = new THREE.Vector3(0.2, 1.62, -1.1), heads = [head, new THREE.Vector3(0, 1.7, 1)] as const;
  const random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, heads, false);
    assert.ok(root.visible, 'the cloud starts on SpecialStarted');
    for (let t = 101; t < 100 + FALL_AT + 6; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    assert.ok(claw.visible && claw.position.y < head.y + 1.05 && claw.position.y > head.y, 'the claw is falling onto the head');
    const cloud = scene.getObjectByName('cloud 0') as THREE.Sprite;
    assert.ok((cloud.material as THREE.SpriteMaterial).opacity > 0.5, 'the cloud is dense while the claw falls');
    // The cloud's anchor is the TARGET's Head bone (the player, side 0, for the opponent's cast), never the caster's.
    const puffs = Array.from({ length: 14 }, (_, i) => scene.getObjectByName(`cloud ${i}`)!.position), mean = puffs.reduce((m, p) => m.clone().add(p), new THREE.Vector3()).divideScalar(puffs.length);
    assert.ok(Math.hypot(mean.x - head.x, mean.z - head.z) < 0.2, `cloud centred over the target's head (${mean.x.toFixed(2)}, ${mean.z.toFixed(2)})`);
    assert.ok(Math.abs(mean.y - (head.y + CLOUD_HEIGHT)) < 0.12, `cloud ${CLOUD_HEIGHT} m above the target's Head bone (${(mean.y - head.y).toFixed(2)})`);
    assert.ok(mean.distanceTo(heads[1]) > 1.5, "nowhere near the caster's head");
    fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, heads, false);
    assert.ok((scene.getObjectByName('burst 0') as THREE.Sprite).visible, 'the dark burst fires at the head on SpecialLanded');
    for (let t = 101 + LAND_AT; t <= 100 + LAND_AT + SPECIAL_RECOVER + 40; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
    assert.ok(!root.visible, 'everything is gone after the tear and the burst');
  } finally { Math.random = random; }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
  let tris = 0; claw.traverse((o) => { if (o instanceof THREE.Mesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  assert.ok(tris < 2000, `the procedural claw stays small (${tris} tris)`);
});

test('special-fx ships in its own lazy chunk: nothing imports it statically', () => {
  const files = readdirSync('src').filter((f) => f.endsWith('.ts'));
  const statics = files.filter((f) => /from\s+['"]\.\/special-fx\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8')));
  assert.deepEqual(statics, [], 'a static import would put the claw in every fight download');
  assert.match(readFileSync('src/scene.ts', 'utf8'), /import\('\.\/special-fx\.ts'\)/, 'the scene loads it on demand');
});

// v2 (Dom approved the black cloud 2026-09-30, but could not tell whose head it was over): the cloud sits low on the TARGET's head and draws over him, with a
// violet-grey halo bank under the black so it still reads on the Night Pit.
test('v2: the cloud draws over the target (no depth test) with a halo bank under the black, and the halo clears with the cast', () => {
  const scene = new THREE.Scene(), fx = createSpecialFx(scene, 'nightborn'), head = new THREE.Vector3(0, 1.6, -1), heads = [head, new THREE.Vector3(0, 1.7, 1)] as const;
  fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, heads, false);
  for (let t = 101; t < 100 + FALL_AT; t++) fx.render(1 / 60, [], fighters(), t, heads, false);
  const cloud = scene.getObjectByName('cloud 0') as THREE.Sprite, halo = scene.getObjectByName('halo 0') as THREE.Sprite;
  assert.equal((cloud.material as THREE.SpriteMaterial).depthTest, false);
  assert.equal((halo.material as THREE.SpriteMaterial).depthTest, false);
  assert.ok(halo.visible && (halo.material as THREE.SpriteMaterial).opacity > 0.1 && halo.renderOrder < cloud.renderOrder, 'the halo is visible and sits under the black');
  assert.ok(CLOUD_HEIGHT <= 0.25, 'the cloud sits on the head, not over the far fighter');
  fx.clear();
  assert.ok(!scene.getObjectByName('special fx')!.visible);
});

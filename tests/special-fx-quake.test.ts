import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createShieldQuake, isShieldQuake, quakeLook } from '../src/special-fx-quake.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
import { LAND_AT, SLAM_AT, advanceCast } from '../src/special-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';

// The Centurion's Shield Quake (special-fx-quake.ts): the same seam as Red Wind, on his class skill, the Scutum Shove.
const fighters = [{ special: 0 }, { special: 0, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_shove' } as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const peak = (scene: THREE.Scene, name: string) => Math.max(0, ...scene.getObjectByName('special fx')!.getObjectsByProperty('name', name).map((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity));

test('?special=shield is the Centurion at rank 8 (level 36), and the slam comes half a second before the landing', () => {
  assert.deepEqual(SPECIAL_TESTS.shield, { opponent: 'veteran', level: 36, first: 180 });
  assert.equal(LAND_AT - SLAM_AT, 30);
});

test('nothing is drawn until the slam; the seam then runs and the sand bursts up on the landing, then it all clears', () => {
  const scene = new THREE.Scene(), fx = createShieldQuake(scene, 'veteran', quakeLook(ARENA_THEMES['1'].exposure));
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false); };
  run(0, 1, { 1: started }); run(2, SLAM_AT - 2);
  assert.equal(peak(scene, 'quake seam'), 0, 'the lift is the pose alone');
  run(SLAM_AT - 1, LAND_AT - 4);
  assert.ok(peak(scene, 'quake seam') > 0.3, 'the seam runs from the rim');
  assert.equal(peak(scene, 'quake sheet'), 0, 'the burst waits for the landing');
  run(LAND_AT - 3, LAND_AT, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 1, LAND_AT + 14);
  assert.ok(peak(scene, 'quake sheet') > 0.3, 'the sand stands up under the target');
  run(LAND_AT + 15, LAND_AT + 70);
  assert.equal(scene.getObjectByName('special fx')!.visible, false, 'and the cast ends');
});

test('Shield Quake and Red Wind each ship lazily: the scene reaches the quake only by dynamic import', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-quake\.ts'\)/, 'reached only through the registry entry (special-modes.ts)');
  assert.ok(!readdirSync('src').some((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-fx-quake\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), 'nothing imports it statically');
});

test("the shared timeline never tracks the Centurion's cast: only the quake's own test does (flag off, no Hades cloud on him)", () => {
  assert.equal(advanceCast(null, [started], fighters, 1, 'veteran', false), null, 'default test: no cast');
  assert.ok(advanceCast(null, [started], fighters, 1, 'veteran', false, isShieldQuake), 'the quake passes its own');
});

test('in the Night Pit no stroke or grit is over 0.4 and the look is darker than the day sand (Strategy, 2026-10-02: the plume was pale over the hero)', () => {
  const day = quakeLook(ARENA_THEMES['1'].exposure), pit = quakeLook(ARENA_THEMES.a.exposure), lum = (c: THREE.Color) => c.r + c.g + c.b;
  assert.ok(pit.dim && lum(pit.edge) < 0.1 && lum(pit.edge) < lum(day.edge) / 4, 'darker than the floor, not a tan');
  const scene = new THREE.Scene(), fx = createShieldQuake(scene, 'veteran', pit);
  let top = 0;
  for (let t = 0; t <= LAND_AT + 30; t++) {
    fx.render(1 / 60, t === 1 ? [started] : t === LAND_AT ? [landed(t)] : [], fighters, t, feet, false);
    for (const o of scene.getObjectByName('special fx')!.children.flatMap((g) => g.children)) top = Math.max(top, ((o as THREE.Mesh | THREE.Points).material as THREE.Material).opacity);
  }
  assert.ok(top > 0.2 && top <= 0.4001, `peak opacity ${top}`);
});

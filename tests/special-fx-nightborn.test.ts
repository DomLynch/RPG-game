import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { CUTS, cutAt, LAND_AT } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { createSevenCuts, inkLook } from '../src/special-fx-nightborn.ts';

// The Nightborn's rank 4-7 class special, Seven Cuts (special-fx-nightborn.ts): seven DARK strokes across the target, on the Red Wind seam.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'lunge' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_lunge' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_lunge', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;   // [0] the player (target), [1] the Nightborn (caster)
const setup = () => { const scene = new THREE.Scene(); return { scene, fx: createSevenCuts(scene, 'nightborn') }; };
const run = (fx: ReturnType<typeof createSevenCuts>, from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters(), t, feet, false); };
const meshes = (scene: THREE.Scene) => { const out: THREE.Mesh[] = []; scene.traverse((o) => { if (o instanceof THREE.Mesh) out.push(o); }); return out; };
const opacity = (list: THREE.Mesh[]) => Math.max(0, ...list.map((m) => (m.material as THREE.MeshBasicMaterial).opacity));

test('?special=cuts is rank 7 of the Nightborn; the seven strokes end on the strike tick', () => {
  assert.deepEqual(SPECIAL_TESTS.cuts, { opponent: 'nightborn', level: 31, first: 180 });
  assert.equal(specialParam('?special=CUTS'), 'cuts');
  assert.equal(cutAt(CUTS - 1), LAND_AT);
  assert.ok(cutAt(0) > 0, 'the flurry sits inside the windup');
});

test('the ink is DARK: nothing pale, nothing glowing (Dom: a light streak breaks it), no lights, no lines, no shadows', () => {
  const ink = inkLook(), lum = (c: THREE.Color) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  assert.ok(lum(ink.core) < 0.02 && lum(ink.edge) < 0.05, 'near black, even at its rim');
  {
    const { scene } = setup(); let lights = 0, lines = 0;
    scene.traverse((o) => { if (o instanceof THREE.Light) lights++; if (o instanceof THREE.LineSegments) lines++; });
    assert.equal(lights + lines, 0);
    for (const m of meshes(scene)) { assert.ok(!m.castShadow && !m.receiveShadow); assert.equal((m.material as THREE.MeshBasicMaterial).blending, THREE.NormalBlending, 'never additive'); }
    const map = ((meshes(scene)[0].material as THREE.MeshBasicMaterial).map!.image as { data: Uint8Array }).data;
    for (let i = 0; i < map.length; i += 4) assert.ok(map[i] < 130 && map[i + 1] < 130 && map[i + 2] < 130, `every painted pixel is dark (${map[i]},${map[i + 1]},${map[i + 2]})`);
  }
});

test('Seven Cuts: seven strokes, faint in the windup, each darkens on its own tick, the seventh (the thrust) on the strike, all gone after', () => {
  const { scene, fx } = setup(), all = meshes(scene);
  assert.equal(all.length, CUTS);
  run(fx, 0, 0); assert.equal(opacity(all), 0);
  run(fx, 1, cutAt(0) - 5, { 1: started(1) }); const faint = opacity(all); assert.ok(faint > 0 && faint < 0.25, `the tell is faint (${faint.toFixed(2)})`);
  run(fx, cutAt(0) - 4, cutAt(2));
  const lit = all.filter((m) => (m.material as THREE.MeshBasicMaterial).opacity > 0.4).length; assert.ok(lit >= 1 && lit <= 3, `the first cuts are in, the rest still ghosts (${lit})`);
  run(fx, cutAt(2) + 1, LAND_AT - 1); run(fx, LAND_AT, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) });
  assert.ok(all.every((m) => (m.material as THREE.MeshBasicMaterial).opacity > 0.3), 'all seven are in on the strike');
  run(fx, LAND_AT + 2, LAND_AT + 140); assert.ok(opacity(all) < 0.02, 'gone after the recovery');
});

test('a fizzle thins the effect out without a strike, and the sources stay clean (no Math.random, no additive blend, the mode is registered)', () => {
  const { scene, fx } = setup(), all = meshes(scene);
  run(fx, 1, 60, { 1: started(1) }); assert.ok(opacity(all) > 0.05);
  fx.render(1 / 60, [{ tick: 61, type: 'SpecialFizzled', actor: 1 } as unknown as CombatEvent], fighters(), 61, feet, false);
  run(fx, 62, 140); assert.ok(opacity(all) < 0.02, 'dissolved');
  const src = readFileSync(new URL('../src/special-fx-nightborn.ts', import.meta.url), 'utf8');
  assert.ok(!/Math\.random|AdditiveBlending/.test(src));
  const modes = readFileSync(new URL('../src/special-modes.ts', import.meta.url), 'utf8');
  assert.match(modes, /\bcuts: \{/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLegionSpecial } from '../src/special-fx-legion.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { LAND_AT } from '../src/special-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';

// Accepted Stand Fast preview; Combat owns the levels 16-35 class selector.
const fighters = [{ special: 0 }, { special: 0, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_shove' } as unknown as CombatEvent;
const landed = { tick: LAND_AT, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 } as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const shown = (scene: THREE.Scene) => scene.getObjectByName('legion fx')!.children.filter((c) => c.visible).length;

test('Stand Fast previews the Centurion at level 21; rejected Hobnail is unavailable', () => {
  assert.equal(specialParam('?special=hobnail'), null);
  assert.deepEqual(SPECIAL_TESTS.standfast, { opponent: 'veteran', level: 21, first: 180 });
});

for (const night of [false, true]) test(`Stand Fast ${night ? 'Pit' : 'day'}: readable tell, release, capped ink and clear`, () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(night ? '#050505' : '#dddddd');
  const fx = createLegionSpecial(scene, 'veteran');
  let peakOpacity = 0;
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) {
    fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false);
    for (const c of scene.getObjectByName('legion fx')!.children as THREE.Sprite[]) peakOpacity = Math.max(peakOpacity, c.material.opacity);
  } };
  run(0, 1, { 1: started }); run(2, LAND_AT - 70);
  assert.equal(shown(scene), 0, 'a quick build-up: nothing on the sand until ~0.8 s before the blow');
  run(LAND_AT - 69, LAND_AT - 1);
  assert.ok(shown(scene) > 0, 'the tell is on the ground');
  run(LAND_AT, LAND_AT + 12, { [LAND_AT]: landed });
  assert.ok(shown(scene) > 2, 'the release');
  const marks = scene.getObjectByName('legion fx')!.children as THREE.Sprite[];
  assert.equal(marks.length, 26, 'accepted ring only, no rejected option allocations');
  assert.ok(peakOpacity <= (night ? 0.75 : 0.88), 'approved peak across every tell/release frame');
  for (const c of marks) {
    assert.ok(c.material.opacity <= (night ? 0.75 : 0.88), 'approved opacity ceiling');
    assert.ok((night ? ['#43221a', '#4d2a1d'] : ['#1f160b', '#281c0f']).some((ink) => c.material.color.equals(new THREE.Color(ink))), 'approved ink');
  }
  run(LAND_AT + 13, LAND_AT + 80);
  assert.equal(scene.getObjectByName('legion fx')!.visible, false, 'and the cast ends');
});

test('Stand Fast loads lazily, through the registry only', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-legion\.ts'\)/);
  assert.ok(!readdirSync('src').some((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-fx-legion\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), 'nothing imports it statically');
});

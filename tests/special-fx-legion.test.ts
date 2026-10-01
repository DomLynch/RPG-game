import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLegionSpecial, type LegionOption } from '../src/special-fx-legion.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
import { LAND_AT } from '../src/special-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';

// The Centurion's rank 4-7 class special proposals (special-fx-legion.ts): ?special=hobnail and ?special=standfast, both on his Scutum Shove, both ground ink.
const fighters = [{ special: 0 }, { special: 0, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_shove' } as unknown as CombatEvent;
const landed = { tick: LAND_AT, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 } as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const shown = (scene: THREE.Scene) => scene.getObjectByName('legion fx')!.children.filter((c) => c.visible).length;

test('both flags are the Centurion at rank 5 (level 21)', () => {
  assert.deepEqual(SPECIAL_TESTS.hobnail, { opponent: 'veteran', level: 21, first: 180 });
  assert.deepEqual(SPECIAL_TESTS.standfast, { opponent: 'veteran', level: 21, first: 180 });
});

for (const option of ['hobnail', 'standfast'] as LegionOption[]) test(`${option}: bare until the last second of the tell, drawn at the strike, gone after, never over 0.9 opacity (readable)`, () => {
  const scene = new THREE.Scene(), fx = createLegionSpecial(scene, 'veteran', option);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false); };
  run(0, 1, { 1: started }); run(2, LAND_AT - 70);
  assert.equal(shown(scene), 0, 'a quick build-up: nothing on the sand until ~0.8 s before the blow');
  run(LAND_AT - 69, LAND_AT - 1);
  assert.ok(shown(scene) > 0, 'the tell is on the ground');
  run(LAND_AT, LAND_AT + 12, { [LAND_AT]: landed });
  assert.ok(shown(scene) > 2, 'the release');
  for (const c of scene.getObjectByName('legion fx')!.children) assert.ok(((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity <= 0.9, 'semi-transparent');
  run(LAND_AT + 13, LAND_AT + 80);
  assert.equal(scene.getObjectByName('legion fx')!.visible, false, 'and the cast ends');
});

test('the two options ship lazily, through the registry only', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-legion\.ts'\)/);
  assert.ok(!readdirSync('src').some((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-fx-legion\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), 'nothing imports it statically');
});

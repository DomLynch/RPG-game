import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PITBORN_KINDS, createPitbornSpecial, isPitbornSpecial, type PitbornKind } from '../src/special-fx-pitborn.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
import { LAND_AT, advanceCast } from '../src/special-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';

// The Pitborn's rank 8-10 boss specials (special-fx-pitborn.ts): Antaeus Cracking Ground, Surtr Ash Fall, Typhon Wind Wall.
const fighters = [{ special: 0 }, { special: 0, skill: 'cleave' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_cleave' } as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_cleave', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const DAY = ARENA_THEMES['1'].exposure, PIT = 1.85;   // the day sand, and the Night Pit (arena-themes.ts exposure > 1.5)
const HAZE: Record<PitbornKind, string[]> = { antaeus: [], surtr: ['smoke'], typhon: ['gale'] };
const peak = (scene: THREE.Scene, names: string[] | null) => Math.max(0, ...scene.getObjectByName('special fx')!.children.filter((o) => !names || names.some((n) => o.name.startsWith(n))).map((o) => o.visible ? ((o as THREE.Mesh).material as THREE.Material).opacity : 0));
const play = (kind: PitbornKind, exposure: number) => {
  const scene = new THREE.Scene(), fx = createPitbornSpecial(scene, 'pitborn', kind, exposure);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false); };
  return { scene, run };
};

test('?special=antaeus|surtr|typhon are the Pitborn at ranks 8-10 (levels 36, 41, 46)', () => {
  assert.deepEqual(PITBORN_KINDS, ['antaeus', 'surtr', 'typhon']);
  assert.deepEqual([SPECIAL_TESTS.antaeus, SPECIAL_TESTS.surtr, SPECIAL_TESTS.typhon].map((t) => [t.opponent, t.level]), [['pitborn', 36], ['pitborn', 41], ['pitborn', 46]]);
});

test('nothing is drawn early; it builds in the half second before the landing, then it all clears', () => {
  for (const kind of PITBORN_KINDS) {
    const { scene, run } = play(kind, DAY);
    run(0, 1, { 1: started }); run(2, LAND_AT - 40);
    const early = peak(scene, null);
    if (kind !== 'typhon') assert.equal(early, 0, `${kind}: the pose alone before the build-up`);   // Typhon's wind builds over the whole wind-up, so it is already drawn
    run(LAND_AT - 39, LAND_AT - 2);
    assert.ok(peak(scene, null) > Math.max(0.2, early), `${kind}: drawn, and stronger, in the build-up`);
    run(LAND_AT - 1, LAND_AT, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 1, LAND_AT + 240);
    assert.equal(scene.getObjectByName('special fx')!.visible, false, `${kind}: and the cast ends`);
  }
});

test('the haze never passes Strategy\'s ceiling: 0.7 on the day sand, 0.4 on the Night Pit', () => {
  for (const kind of PITBORN_KINDS) for (const [arena, exposure, ceiling] of [['day', DAY, 0.7], ['Night Pit', PIT, 0.4]] as const) {
    const { scene, run } = play(kind, exposure);
    let top = 0; run(0, 1, { 1: started });
    for (let t = 2; t <= LAND_AT + 60; t++) { run(t, t, t === LAND_AT ? { [t]: landed(t) } : {}); top = Math.max(top, peak(scene, HAZE[kind])); }
    assert.ok(top <= ceiling + 1e-9, `${kind} ${arena} haze ${top} <= ${ceiling}`);
    if (HAZE[kind].length) assert.ok(top > 0.2, `${kind} ${arena} haze is actually drawn (${top})`);
  }
});

test('the Night Pit caps every airborne mark and ground speck at 0.4 (Surtr soot and flakes, Typhon strokes and sand)', () => {
  for (const kind of ['surtr', 'typhon'] as const) {
    const { scene, run } = play(kind, PIT);
    let top = 0; run(0, 1, { 1: started });
    for (let t = 2; t <= LAND_AT + 60; t++) { run(t, t, t === LAND_AT ? { [t]: landed(t) } : {}); top = Math.max(top, peak(scene, null)); }
    assert.ok(top <= 0.4 + 1e-9, `${kind} Night Pit peak ${top}`);
  }
});

test('textures are shared by seed: the sprites do not each build their own', () => {
  const made = new Set<THREE.Texture>(); const { scene } = play('typhon', DAY);
  scene.getObjectByName('special fx')!.children.forEach((o) => { const m = (o as THREE.Mesh | THREE.Sprite).material as THREE.MeshBasicMaterial; if (m.map) made.add(m.map); });
  assert.ok(made.size <= 20, `typhon has ${made.size} distinct textures for ~200 pieces`);
});

test('the module ships lazily and the shared timeline never tracks the Pitborn\'s cast: only its own test does', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-pitborn\.ts'\)/, 'reached only through the registry entry (special-modes.ts)');
  assert.ok(!readdirSync('src').some((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-fx-pitborn\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8'))), 'nothing imports it statically');
  assert.equal(advanceCast(null, [started], fighters, 1, 'pitborn', false), null, 'default test: no cast');
  assert.ok(advanceCast(null, [started], fighters, 1, 'pitborn', false, isPitbornSpecial), 'it passes its own');
});

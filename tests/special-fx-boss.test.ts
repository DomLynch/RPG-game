import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createBossSpecial } from '../src/special-fx-boss.ts';
import { BOSS_SPECIALS, bossParam, SPECIAL_TESTS } from '../src/special-look.ts';
import { LAND_AT } from '../src/special-timing.ts';
import { BUILD_AT, slingAngle, wrathTremor } from '../src/special-boss-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';

// The Witch's boss specials (special-fx-boss.ts): the same seam as the Shield Quake, on her class skill, the Witch-fire.
const fighters = [{ special: 0 }, { special: 0, skill: 'witchfire' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_witchfire' } as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_witchfire', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const peak = (scene: THREE.Scene, name: string) => Math.max(0, ...scene.getObjectByName('special fx')!.getObjectsByProperty('name', name).map((m) => ((m as THREE.Sprite).material as THREE.SpriteMaterial).opacity * ((m as THREE.Sprite).visible ? 1 : 0)));
const drive = (kind: (typeof BOSS_SPECIALS)[number], canvas?: { style: { filter: string } }) => {
  const scene = new THREE.Scene(), fx = createBossSpecial(scene, 'witch', kind, 1, canvas as unknown as HTMLElement);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false); };
  return { scene, run };
};

test('the Witch pages are her three ranks: mist 8 (level 36), echo 9 (41), price 10 (46)', () => {
  assert.deepEqual(SPECIAL_TESTS.mist, { opponent: 'witch', level: 36, first: 180 });
  assert.equal(SPECIAL_TESTS.echo.level, 41); assert.equal(SPECIAL_TESTS.price.level, 46);
  assert.equal(bossParam('?special=mist'), 'mist'); assert.equal(bossParam('?special=shield'), null);
});

test('Avalon Mist: nothing before the build-up, the mist gathers on the ground, then it clears', () => {
  const { scene, run } = drive('mist');
  run(0, 1, { 1: started }); run(2, BUILD_AT - 2);
  assert.equal(peak(scene, 'mist'), 0);
  run(BUILD_AT - 1, LAND_AT - 2);
  assert.ok(peak(scene, 'mist') > 0.2, 'the mist is up before the landing');
  run(LAND_AT - 1, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 80);
  assert.equal(scene.getObjectByName('special fx')!.visible, false, 'and the cast ends');
});

test('Foretold Step: the ghost lives under 0.4 s and is gone on the landing', () => {
  const { scene, run } = drive('echo');
  run(0, 1, { 1: started }); run(2, LAND_AT - 26);
  assert.equal(peak(scene, 'ghost'), 0, 'no ghost until the last 0.38 s');
  run(LAND_AT - 25, LAND_AT - 3);
  assert.ok(peak(scene, 'ghost') > 0.1, 'the ghost is out ahead of him');
  run(LAND_AT - 2, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) });
  assert.equal(peak(scene, 'ghost'), 0, 'he has arrived into it');
});

test('The Price: the canvas drains to grey through the build-up and gets its colour back', () => {
  const canvas = { style: { filter: '' } }, { run } = drive('price', canvas);
  run(0, 1, { 1: started }); run(2, BUILD_AT - 2);
  assert.equal(canvas.style.filter, '');
  run(BUILD_AT - 1, LAND_AT - 1);
  assert.match(canvas.style.filter, /saturate\(0\.[0-3]/);
  run(LAND_AT, LAND_AT + 2, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 3, LAND_AT + 80);
  assert.equal(canvas.style.filter, '');
});

test('the boss art ships lazily: the scene reaches it only by dynamic import', () => {
  assert.match(readFileSync('src/scene.ts', 'utf8'), /import\('\.\/special-fx-boss\.ts'\)/);
});

// The Plague Doctor's three, on his class skill (Miasma).
const pdFighters = [{ special: 0 }, { special: 0, skill: 'miasma' }] as unknown as readonly [Fighter, Fighter];
const pdStarted = { ...(started as object), move: 'skill_miasma' } as unknown as CombatEvent, pdLanded = (tick: number) => ({ ...(landed(tick) as object), move: 'skill_miasma' }) as unknown as CombatEvent;
const heads = [new THREE.Vector3(0, 1.7, 1.4), new THREE.Vector3(0, 1.7, -0.6)] as const;
const meshPeak = (scene: THREE.Scene, name: string) => Math.max(0, ...scene.getObjectByName('special fx')!.getObjectsByProperty('name', name).map((m) => ((m as THREE.Mesh).material as THREE.Material).opacity * ((m as THREE.Mesh).visible ? 1 : 0)));
const drivePd = (kind: (typeof BOSS_SPECIALS)[number]) => {
  const scene = new THREE.Scene(), fx = createBossSpecial(scene, 'plaguedoctor', kind, 1);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], pdFighters, t, feet, false, heads); };
  return { scene, run };
};

test('the Plague Doctor pages are his three ranks: flies 8, stain 9, breath 10', () => {
  assert.deepEqual([SPECIAL_TESTS.flies, SPECIAL_TESTS.stain, SPECIAL_TESTS.breath].map((t) => [t.opponent, t.level]), [['plaguedoctor', 36], ['plaguedoctor', 41], ['plaguedoctor', 46]]);
});

test('Plague Flies: the swarm shows from the build-up, and clears after the strike', () => {
  const { scene, run } = drivePd('flies');
  run(0, 1, { 1: pdStarted }); run(2, BUILD_AT - 2);
  assert.equal(meshPeak(scene, 'flies'), 0);
  run(BUILD_AT - 1, LAND_AT - 2); assert.ok(meshPeak(scene, 'flies') > 0.2);
  run(LAND_AT - 1, LAND_AT + 1, { [LAND_AT]: pdLanded(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 80);
  assert.equal(scene.getObjectByName('special fx')!.visible, false);
});

test('Poison Stain: it spreads flat on the sand with nothing rising, and fades after the strike', () => {
  const { scene, run } = drivePd('stain');
  run(0, 1, { 1: pdStarted }); run(2, LAND_AT - 2);
  assert.ok(meshPeak(scene, 'stain') > 0.5);
  for (const m of scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'stain')) assert.ok((m as THREE.Mesh).position.y < 0.05, 'flat on the sand');
  run(LAND_AT - 1, LAND_AT + 1, { [LAND_AT]: pdLanded(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 80);
  assert.equal(scene.getObjectByName('special fx')!.visible, false);
});

test('Last Breath: the wisp runs head to head and is gone after the strike', () => {
  const { scene, run } = drivePd('breath');
  run(0, 1, { 1: pdStarted }); run(2, BUILD_AT - 2); assert.equal(meshPeak(scene, 'wisp'), 0);
  run(BUILD_AT - 1, LAND_AT - 2); assert.ok(meshPeak(scene, 'wisp') > 0.2);
  run(LAND_AT - 1, LAND_AT + 1, { [LAND_AT]: pdLanded(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 80);
  assert.equal(scene.getObjectByName('special fx')!.visible, false);
});

// The Knight's three, on his class skill (the Iron Rush).
const knFighters = [{ special: 0 }, { special: 0, skill: 'ironrush' }] as unknown as readonly [Fighter, Fighter];
const knStarted = { ...(started as object), move: 'skill_ironrush' } as unknown as CombatEvent, knLanded = (tick: number) => ({ ...(landed(tick) as object), move: 'skill_ironrush' }) as unknown as CombatEvent;
const driveKn = (kind: (typeof BOSS_SPECIALS)[number]) => {
  const scene = new THREE.Scene(), fx = createBossSpecial(scene, 'knight', kind, 1);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], knFighters, t, feet, false, heads); };
  return { scene, run };
};

test('the Knight pages are his three ranks: sling 8, haze 9, storm 10; he turns exactly one circle in the build-up', () => {
  assert.deepEqual([SPECIAL_TESTS.sling, SPECIAL_TESTS.haze, SPECIAL_TESTS.storm].map((t) => [t.opponent, t.level]), [['knight', 36], ['knight', 41], ['knight', 46]]);
  assert.equal(slingAngle(BUILD_AT - 5), 0); assert.ok(Math.abs(slingAngle(LAND_AT) - Math.PI * 2) < 1e-9);
  assert.equal(wrathTremor(BUILD_AT - 1), 0); assert.ok(Math.abs(wrathTremor(LAND_AT - 7)) > 0);
});

for (const [kind, name] of [['sling', 'ring'], ['haze', 'haze'], ['storm', 'rain']] as const) {
  test(`${kind}: nothing before the build-up, drawn through it, cleared after the strike`, () => {
    const { scene, run } = driveKn(kind);
    run(0, 1, { 1: knStarted }); run(2, BUILD_AT - 2);
    assert.equal(meshPeak(scene, name), 0);
    run(BUILD_AT - 1, LAND_AT - 2); assert.ok(meshPeak(scene, name) > 0.15, 'it is up before the landing');
    run(LAND_AT - 1, LAND_AT + 1, { [LAND_AT]: knLanded(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 80);
    assert.equal(scene.getObjectByName('special fx')!.visible, false);
  });
}

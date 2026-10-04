import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createBossSpecial } from '../src/special-fx-boss.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { LAND_AT } from '../src/special-timing.ts';
import { BUILD_AT, type BossKind } from '../src/special-boss-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';

// The Witch's boss specials (special-fx-boss.ts): the same seam as the Shield Quake, on her class skill, the Witch-fire.
const fighters = [{ special: 0 }, { special: 0, skill: 'witchfire' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_witchfire' } as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_witchfire', damage: 30 }) as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;
const heads = [new THREE.Vector3(0, 1.7, 1.4), new THREE.Vector3(0, 1.7, -0.6)] as const;
const peak = (scene: THREE.Scene, name: string) => Math.max(0, ...scene.getObjectByName('special fx')!.getObjectsByProperty('name', name).map((m) => ((m as THREE.Sprite).material as THREE.SpriteMaterial).opacity * ((m as THREE.Sprite).visible ? 1 : 0)));
const drive = (kind: BossKind, canvas?: { style: { filter: string } }) => {
  const scene = new THREE.Scene(), fx = createBossSpecial(scene, 'witch', kind, 1, canvas as unknown as HTMLElement);
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false); };
  return { scene, run };
};

test('the Witch pages are her three ranks: mist 8 (level 36), echo 9 (41), price 10 (46)', () => {
  assert.deepEqual(SPECIAL_TESTS.mist, { opponent: 'witch', level: 36, first: 180 });
  assert.equal(SPECIAL_TESTS.echo.level, 41); assert.equal(SPECIAL_TESTS.price.level, 46);
  for (const id of ['mist', 'echo', 'price', 'flies', 'stain', 'breath'] as const) assert.equal(SPECIAL_MODES[id]?.at, 'feet', `${id} is in the registry`);
});

test('Avalon Mist: it creeps in through the whole wind-up, stays low, and clears after the strike', () => {
  const { scene, run } = drive('mist');
  run(0, 1, { 1: started }); run(2, 20);
  assert.ok(peak(scene, 'mist') < 0.12, 'it has barely begun');
  run(21, LAND_AT - 40); assert.ok(peak(scene, 'mist') > 0.1, 'the mist is already in through the wind-up');
  for (const m of scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'mist')) assert.ok(m.position.y < 0.8, 'low: never over the torso');
  run(LAND_AT - 39, LAND_AT - 1); run(LAND_AT, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 80);
  assert.equal(scene.getObjectByName('special fx')!.visible, false, 'and the cast ends');
});

test('Foretold Step: a frozen copy of the target lives under 0.4 s, ahead of him, and is gone on the landing', () => {
  const scene = new THREE.Scene(), fx = createBossSpecial(scene, 'witch', 'echo', 1);
  const target = new THREE.Group(); target.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardMaterial()));
  const ghosts = () => scene.getObjectByName('special fx')!.getObjectsByProperty('name', 'ghost');
  const opacity = () => Math.max(0, ...ghosts().flatMap((g) => { const o: number[] = []; g.traverse((m) => { if ((m as THREE.Mesh).isMesh) o.push(((m as THREE.Mesh).material as THREE.Material).opacity); }); return o; }));
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false, heads, undefined, target); };
  run(0, 1, { 1: started }); run(2, LAND_AT - 26);
  assert.equal(ghosts().length, 0, 'no ghost until the last 0.38 s');
  run(LAND_AT - 25, LAND_AT - 3);
  assert.equal(ghosts().length, 1); assert.ok(opacity() > 0.05, 'the copy shows');
  run(LAND_AT - 2, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) });
  assert.equal(ghosts().length, 0, 'he has arrived into it');
  assert.equal(SPECIAL_MODES.echo?.travel?.(0, [{ special: 0 }, { special: 20 }] as unknown as readonly [Fighter, Fighter]), 1.6, 'his gait plays through the window');
  assert.equal(SPECIAL_MODES.echo?.travel?.(0, [{ special: 0 }, { special: 60 }] as unknown as readonly [Fighter, Fighter]), undefined);
});

test('The Price: the canvas drains to grey through the build-up and gets its colour back', () => {
  const canvas = { style: { filter: '' } }, { run } = drive('price', canvas);
  run(0, 1, { 1: started }); run(2, BUILD_AT - 2);
  assert.equal(canvas.style.filter, '');
  run(BUILD_AT - 1, LAND_AT - 1);
  assert.match(canvas.style.filter, /saturate\(0\.[0-3]/);
  assert.match(canvas.style.filter, /brightness\(0\.8[5-9]/, 'the drained frame is darkened ~15 % so it sits below the normal sand (Strategy, day pass)');
  run(LAND_AT, LAND_AT + 2, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 3, LAND_AT + 80);
  assert.equal(canvas.style.filter, '');
});

test('the boss art ships lazily: only the registry imports it, dynamically; the scene names none of these ids', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-boss\.ts'\)/);
  assert.doesNotMatch(readFileSync('src/scene.ts', 'utf8'), /special-fx-boss/);
});

// The Plague Doctor's three, on his class skill (Miasma).
const pdFighters = [{ special: 0 }, { special: 0, skill: 'miasma' }] as unknown as readonly [Fighter, Fighter];
const pdStarted = { ...(started as object), move: 'skill_miasma' } as unknown as CombatEvent, pdLanded = (tick: number) => ({ ...(landed(tick) as object), move: 'skill_miasma' }) as unknown as CombatEvent;

const meshPeak = (scene: THREE.Scene, name: string) => Math.max(0, ...scene.getObjectByName('special fx')!.getObjectsByProperty('name', name).map((m) => ((m as THREE.Mesh).material as THREE.Material).opacity * ((m as THREE.Mesh).visible ? 1 : 0)));
const drivePd = (kind: BossKind) => {
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

test('Foretold Step has a tell: a dark smear where she leaves from (<=0.36, gone inside the window) and a dark mark where she lands', () => {
  const { scene, run } = drive('echo');
  run(0, 1, { 1: started }); run(2, LAND_AT - 30);
  assert.equal(peak(scene, 'echo-smear'), 0, 'nothing before the step window');
  let top = 0; for (let t = LAND_AT - 29; t <= LAND_AT - 1; t++) { run(t, t); top = Math.max(top, peak(scene, 'echo-smear')); }
  assert.ok(top > 0.2 && top <= 0.36, `smear peaks in (0.2, 0.36], got ${top}`);
  run(LAND_AT, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) });
  assert.equal(peak(scene, 'echo-smear'), 0, 'the smear is gone at the landing');
  const mark = scene.getObjectByName('special fx')!.getObjectByName('echo-mark') as THREE.Mesh;
  assert.ok(mark.visible && (mark.material as THREE.MeshBasicMaterial).opacity > 0.2, 'the dark mark is on the sand');
});

test('Foretold Step: she WALKS to his side (absolute anchor writes against a rig that zeroes the anchor every frame) and glides back, never snapping', () => {
  const scene = new THREE.Scene(), fx = createBossSpecial(scene, 'witch', 'echo', 1);
  const parent = new THREE.Group(), anchor = new THREE.Group(); parent.add(anchor);
  const offset = new Map<number, number>();
  const run = (from: number, to: number, events: Record<number, CombatEvent> = {}) => {
    for (let t = from; t <= to; t++) {
      anchor.position.set(0, 0, 0);   // what the rig does in update(): a sub/add delta would collapse here
      fx.render(1 / 60, events[t] ? [events[t]] : [], fighters, t, feet, false, heads, anchor);
      offset.set(t, anchor.position.z);
    }
  };
  run(0, 1, { 1: started }); run(2, LAND_AT - 24);
  assert.equal(offset.get(LAND_AT - 24), 0, 'she stands still before the step window');
  run(LAND_AT - 23, LAND_AT - 1);
  assert.ok(Math.abs(offset.get(LAND_AT - 1)! - 0.9) < 0.05, `at the strike she is 0.9 m along (gap 2.0 m, stopping 1.1 m short), got ${offset.get(LAND_AT - 1)}`);
  assert.ok(offset.get(LAND_AT - 12)! > 0.05 && offset.get(LAND_AT - 12)! < offset.get(LAND_AT - 1)!, 'monotone: she is mid-step halfway');
  run(LAND_AT, LAND_AT + 1, { [LAND_AT]: landed(LAND_AT) }); run(LAND_AT + 2, LAND_AT + 8);
  assert.ok(Math.abs(offset.get(LAND_AT + 8)! - 0.9) < 0.05, 'she holds beside him through the first recover ticks');
  run(LAND_AT + 9, LAND_AT + 80);
  assert.equal(scene.getObjectByName('special fx')!.visible, false, 'the cast ends');
  let jump = 0; for (let t = LAND_AT + 10; t <= LAND_AT + 45; t++) jump = Math.max(jump, Math.abs(offset.get(t)! - offset.get(t - 1)!));
  assert.ok(jump < 0.1, `she glides back with no snap (largest per-tick change ${jump})`);
});

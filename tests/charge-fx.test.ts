import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { CAST_MARGIN, LAND_AT, type Cast } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { BACK_PACE, charge, chargeGait, CUE_AT, CUE_LEAD, DISSOLVE, GATHER, isCharge, RACE, RACE_FROM, RIDE, RUN_PACE, SETTLE, slideAt, STUCK_AT } from '../src/charge-timing.ts';
import { createChargeFx } from '../src/charge-fx.ts';

// The Centurion's Charge (charge-timing.ts, charge-fx.ts): a line of dust races the last RACE ticks of the windup, reaches the target on the landing
// tick, then settles. Presentation only: it follows Combat's special events and ships in its own lazy chunk.
const cast: Cast = { actor: 1, start: 1000, landed: null, fizzled: null };
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_shove' }) as unknown as CombatEvent;

test('?special=centurion is the Centurion at level 41 with the early first cast; the others are unchanged', () => {
  assert.deepEqual(SPECIAL_TESTS.centurion, { opponent: 'veteran', level: 41, first: 180 });
  assert.equal(SPECIAL_TESTS.hades.level, 41);
  assert.equal(specialParam('?special=centurion&arena=c'), 'centurion');
});

test('only the Centurion\'s own Scutum Shove, on the opponent\'s side, is the Charge', () => {
  assert.equal(isCharge('veteran', 1, 'skill_shove'), true);
  assert.equal(isCharge('veteran', 0, 'skill_shove'), false);
  assert.equal(isCharge('veteran', 1, 'skill_lunge'), false);
  assert.equal(isCharge('nightborn', 1, 'skill_shove'), false);
});

test('the build-up is the brief\'s 0.4-0.6 s: nothing before it, the race to the landing tick, the dust at the target on it', () => {
  assert.ok(RACE / 60 >= 0.4 && RACE / 60 <= 0.6);
  assert.equal(charge(cast, 1000 + RACE_FROM - 1), null);
  const mid = charge(cast, 1000 + RACE_FROM + RACE / 2)!;
  assert.ok(mid.front > 0 && mid.front < 1 && mid.settle === null);
  assert.equal(charge(cast, 1000 + LAND_AT)!.front, 1);
  assert.ok(charge(cast, 1000 + RACE_FROM + RACE * 0.75)!.front > mid.front, 'the front only advances');
});

test('after the blow the dust settles and is gone in SETTLE ticks', () => {
  const landed: Cast = { ...cast, landed: 1000 + LAND_AT };
  assert.equal(charge(landed, 1000 + LAND_AT)!.settle, 0);
  const half = charge(landed, 1000 + LAND_AT + SETTLE / 2)!;
  assert.ok(half.front === 1 && half.settle! > 0.4 && half.settle! < 0.6);
  assert.equal(charge(landed, 1000 + LAND_AT + SETTLE), null);
});

test('a fizzle stops the race where it is and thins it out; a cast with no end is a fizzle at LAND_AT + CAST_MARGIN', () => {
  const at = 1000 + RACE_FROM + RACE / 2, fizzled: Cast = { ...cast, fizzled: at };
  const held = charge(fizzled, at)!, later = charge(fizzled, at + DISSOLVE / 2)!;
  assert.equal(later.front, held.front);
  assert.ok(later.fade < 1 && later.fade > 0);
  assert.equal(charge(fizzled, at + DISSOLVE), null);
  assert.equal(charge(fizzled, at + 1)!.settle, null);
  assert.equal(STUCK_AT, LAND_AT + CAST_MARGIN);
  assert.equal(charge(cast, 1000 + STUCK_AT + DISSOLVE), null, 'never held into the next fight');
  assert.equal(charge({ ...cast, fizzled: 1000 + 5 }, 1000 + 6), null, 'a cast that fizzles before the race drew nothing');
});

test('the effect draws only the Centurion\'s cast, from the sim\'s events, and clear() puts it away', () => {
  const scene = new THREE.Scene(), fx = createChargeFx(scene, 'veteran'), root = scene.getObjectByName('charge fx')!;
  const heads = [new THREE.Vector3(-1, 1.6, 0), new THREE.Vector3(1, 1.6, 0)] as const;
  fx.render(1 / 60, [], fighters(), 10, heads, false);
  assert.equal(root.visible, false);
  fx.render(1 / 60, [started(100)], fighters(120), 100, heads, false);
  assert.equal(root.visible, false, 'the windup has begun but the race has not');
  fx.render(1 / 60, [], fighters(10), 100 + LAND_AT - 10, heads, false);
  assert.equal(root.visible, true);
  assert.ok(root.children.some((s) => s.visible), 'puffs are drawn');
  fx.clear();
  assert.equal(root.visible, false);
  const elsewhere = new THREE.Scene(), other = createChargeFx(elsewhere, 'nightborn');
  other.render(1 / 60, [started(100)], fighters(120), 100 + LAND_AT - 10, heads, false);
  assert.equal(elsewhere.getObjectByName('charge fx')!.visible, false, 'another warden\'s special draws no dust');
});

test('Audio\'s hooves cue fires once per cast, 0.95 s before the landing tick (0.35 s before the dust shows)', () => {
  assert.equal(CUE_LEAD, Math.round(0.95 * 60));
  assert.equal(CUE_AT, LAND_AT - CUE_LEAD);
  assert.ok(CUE_AT < RACE_FROM, 'the sound builds before the dust');
  const calls: number[] = [], fx = createChargeFx(new THREE.Scene(), 'veteran', () => calls.push(1));
  const heads = [new THREE.Vector3(-1, 1.6, 0), new THREE.Vector3(1, 1.6, 0)] as const;
  fx.render(1 / 60, [started(100)], fighters(120), 100, heads, false);
  fx.render(1 / 60, [], fighters(100), 100 + CUE_AT - 1, heads, false);
  assert.equal(calls.length, 0);
  fx.render(1 / 60, [], fighters(60), 100 + CUE_AT, heads, false);
  fx.render(1 / 60, [], fighters(40), 100 + CUE_AT + 20, heads, false);
  assert.equal(calls.length, 1, 'once');
  fx.render(1 / 60, [started(400)], fighters(120), 400, heads, false);
  fx.render(1 / 60, [], fighters(60), 400 + CUE_AT, heads, false);
  assert.equal(calls.length, 2, 'and again for the next cast');
});

test('the Centurion is drawn at the head of the dust, not planted: eased back before the race, then forward to his own spot; the sim spot is untouched', () => {
  const fx = createChargeFx(new THREE.Scene(), 'veteran'), anchor = new THREE.Object3D(), parent = new THREE.Group(); parent.add(anchor);
  const heads = [new THREE.Vector3(-1, 1.6, 0), new THREE.Vector3(1, 1.6, 0)] as const, anchors = [null, anchor] as const;   // he stands at +x, the target at -x
  const at = (tick: number, events: CombatEvent[] = []) => { anchor.position.set(0, 0, 0); fx.render(1 / 60, events, fighters(10), tick, heads, false, anchors); return anchor.position.x; };
  assert.equal(at(100, [started(100)]), 0, 'planted through the early windup');
  const start = at(100 + RACE_FROM);
  assert.ok(Math.abs(start - 2) < 1e-6, 'drawn 2 m back (away from the target) when the race begins');
  const mid = at(100 + RACE_FROM + RACE * 0.6);
  assert.ok(mid > 0 && mid < start, 'riding the front forward');
  assert.equal(at(100 + RACE_FROM + RIDE), 0, 'at his own spot when the ride ends');
  assert.equal(at(100 + LAND_AT - 1), 0, 'at his own spot before the blow');
  assert.equal(at(100 + LAND_AT + 1, [{ tick: 100 + LAND_AT, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 } as unknown as CombatEvent]), 0, 'and not moved after it');
});

test('the Charge is ONE registry entry (special-modes.ts) and a ?special= row; the scene names no special id', async () => {
  const { SPECIAL_MODES } = await import('../src/special-modes.ts');
  const mode = SPECIAL_MODES.centurion!;
  assert.ok(mode && mode.at === 'feet', 'a ground effect: it reads the feet');
  const player = new THREE.Object3D(), opponent = new THREE.Object3D();
  assert.deepEqual(mode.extra!({ player: { boneWorld: () => null, anchor: player }, opponent: { boneWorld: () => null, anchor: opponent } }), [[player, opponent]], 'the anchors reach render as its seventh argument');
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/charge-fx\.ts'\)/, 'reached only through the registry: a lazy chunk, nothing in the main bundle');
  assert.doesNotMatch(readFileSync('src/scene.ts', 'utf8'), /charge-fx|centurion/, 'scene.ts has no per-special branch');
});

test('the body and its gait run on ONE clock: back while he gathers, running over the ride, the sim\'s again for the blow', async () => {
  assert.equal(slideAt(RACE_FROM - GATHER - 1, 2), 0);
  assert.ok(slideAt(RACE_FROM - GATHER / 2, 2) > 0 && slideAt(RACE_FROM - GATHER / 2, 2) < 2, 'easing back');
  assert.ok(Math.abs(slideAt(RACE_FROM, 2) - 2) < 1e-9, 'the full lead when the ride starts');
  assert.ok(slideAt(RACE_FROM + RIDE / 2, 2) > 0 && slideAt(RACE_FROM + RIDE / 2, 2) < 2);
  assert.equal(slideAt(RACE_FROM + RIDE, 2), 0, 'at his spot');
  for (let age = 0; age < LAND_AT + 40; age++) assert.equal(chargeGait(age) !== undefined, slideAt(age, 2) > 0 || (age >= RACE_FROM - GATHER && age < RACE_FROM + RIDE), `gait and slide agree at ${age}`);
  assert.equal(chargeGait(RACE_FROM - 5), BACK_PACE); assert.equal(chargeGait(RACE_FROM + 3), RUN_PACE); assert.equal(chargeGait(RACE_FROM + RIDE), undefined);
  assert.ok(RUN_PACE > 3.2, "above #1224's ArmedRun threshold");
  const { SPECIAL_MODES } = await import('../src/special-modes.ts');
  const travel = SPECIAL_MODES.centurion!.travel!, fighters = (special: number, who = 1) => [{ health: 1, special: 0 }, { health: 1, specialShare: 0.3, special, skillCooldown: 0 }].map((f, i) => (i === who ? f : { health: 1, special: 0 })) as unknown as readonly [Fighter, Fighter];
  const during = (age: number) => travel(1, fighters(RULES.special.windup - age));
  assert.equal(during(RACE_FROM - 5), BACK_PACE); assert.equal(during(RACE_FROM + 4), RUN_PACE); assert.equal(during(RACE_FROM + RIDE + 1), undefined);
  assert.equal(travel(0, fighters(RULES.special.windup - (RACE_FROM + 4))), undefined, 'only the caster runs');
});

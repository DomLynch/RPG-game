import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { CAST_MARGIN, LAND_AT, type Cast } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { charge, DISSOLVE, isCharge, RACE, RACE_FROM, SETTLE, STUCK_AT } from '../src/charge-timing.ts';
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOf, fatigueTarget, FRESH, stepFatigue, TIRED, WINDED } from '../src/fatigue.ts';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent } from '../src/duel.ts';

const man = (stamina: number, extra: Partial<{ maxStamina: number; legWound: boolean; exhausted: boolean }> = {}) => ({ stamina, maxStamina: 100, legWound: false, exhausted: false, ...extra });

test('the target is 1 - stamina/100, raised by a shrunk ceiling and a leg wound, clamped to 0..1', () => {
  assert.equal(fatigueTarget(man(100)), 0);
  assert.equal(fatigueTarget(man(50)), .5);
  assert.ok(fatigueTarget(man(60, { maxStamina: 60 })) > fatigueTarget(man(60)), 'a wound ceiling tires him at the same stamina');
  assert.ok(fatigueTarget(man(60, { legWound: true })) > fatigueTarget(man(60)));
  assert.equal(fatigueTarget(man(0, { maxStamina: 40, legWound: true })), 1);
});

test('bands: fresh, winded under half stamina, tired under a quarter, gassed when exhausted', () => {
  assert.deepEqual([0, .49, WINDED, .74, TIRED, 1].map(l => bandOf(l, 0)), [0, 0, 1, 1, 2, 2]);
  assert.equal(bandOf(.2, 1), 3);
  assert.equal(stepFatigue(man(60)).band, 0);
  assert.equal(stepFatigue(man(40)).band, 1);
  assert.equal(stepFatigue(man(20)).band, 2);
  assert.equal(stepFatigue(man(0, { exhausted: true })).band, 3 as number, 'a first read of an exhausted man is already gassed');
});

test('blends smoothly: no tick moves the level by more than the rise rate, and a rest is slower than a gasp', () => {
  let f = stepFatigue(man(100)), maxStep = 0;
  for (let i = 0; i < 60; i++) { const n = stepFatigue(man(0), f); maxStep = Math.max(maxStep, n.level - f.level); f = n; }
  assert.ok(maxStep <= 1 / 45 + 1e-9, `rise step ${maxStep}`);
  assert.equal(f.level, 1);
  const fall = (from: typeof f) => { let g = from, n = 0; while (g.level > .05 && n < 1000) { g = stepFatigue(man(100), g); n++; } return n; };
  const rise = (() => { let g = FRESH, n = 0; while (g.level < .95 && n < 1000) { g = stepFatigue(man(0), g); n++; } return n; })();
  assert.ok(fall(f) > rise * 2, 'breathing slows over a couple of seconds, never snaps off');
});

test('a stamina that regens across a line does not flicker the band', () => {
  let f = stepFatigue(man(48)), flips = 0;
  for (let i = 0; i < 600; i++) { const n = stepFatigue(man(48 + (i % 2 ? 1 : -1)), f); if (n.band !== f.band) flips++; f = n; }
  assert.ok(flips <= 1, `${flips} band changes`);
});

test('second wind: the tick he leaves exhaustion the straighten starts, then fades', () => {
  let f = stepFatigue(man(0, { exhausted: true }));
  assert.equal(f.gassed, 1);
  let seen = 0;
  for (let i = 0; i < 200; i++) { f = stepFatigue(man(30), f); seen = Math.max(seen, f.second); }
  assert.equal(seen, 1);
  assert.equal(f.second, 0);
  assert.equal(f.gassed, 0);
});

test('both fighters carry it, the player reaching each band raises one FatigueBand, and the fight itself is unchanged', () => {
  const tire = (stamina: number) => { const p = initialPractice(11), f = [...p.duel.fighters] as typeof p.duel.fighters; f[0] = { ...f[0], phase: 'ready', stamina }; return { ...p, duel: { ...p.duel, fighters: f } }; };
  let a = tire(60), b = tire(60);
  assert.equal(a.fatigue.length, 2);
  const bands: number[] = [];
  const hold = (p: typeof a, stamina: number) => ({ ...p, duel: { ...p.duel, fighters: [{ ...p.duel.fighters[0], stamina }, p.duel.fighters[1]] as typeof p.duel.fighters } });
  for (const stamina of [60, 45, 20]) {
    for (let i = 0; i < 90; i++) { a = stepPractice(hold(a, stamina), idleIntent()); b = stepPractice(hold(b, stamina), idleIntent()); for (const c of a.clarity) if (c.type === 'FatigueBand' && c.actor === 0) bands.push(c.band!); }
  }
  assert.deepEqual(bands, [1, 2], 'winded at 45, tired at 20, each reported once as it rises');
  assert.deepEqual(a.duel, b.duel);
  assert.equal(a.fatigue[0].band, 2);
  assert.equal(a.fatigue[1].band, 0, 'the fresh foe stays fresh');
});

import { fatigueLayer } from '../src/fatigue-layer.ts';
test('subtle fatigue layer (?look=fatigue-preview): heave and a small tip dip only, nothing before the last tenth of stamina', () => {
  const tune = { subtle: true }, f = (level: number, gassed = 0) => ({ level, gassed, second: 0 });
  const calm = fatigueLayer(f(.89), 1.2, 1, tune); assert.deepEqual(calm, { hunch: 0, chest: 0, arm: 0 }, 'upright below level .9');
  for (const [level, gassed] of [[1, 0], [1, 1]]) {
    for (let phase = 0; phase < 7; phase += .3) {
      const l = fatigueLayer(f(level, gassed), phase, 1, tune);
      assert.equal(l.hunch, 0, 'no spine hunch'); assert.ok(l.arm > 0 && l.arm < .13, `small tip dip ${l.arm}`); assert.ok(Math.abs(l.chest) <= .14, 'heave bounded');
    }
  }
  assert.deepEqual(fatigueLayer(f(1), 1.2, 0, tune), { hunch: 0, chest: 0, arm: 0 }, 'no calm pose, no layer');
});

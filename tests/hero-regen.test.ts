import test from 'node:test';
import assert from 'node:assert/strict';
import { regenOn, regenRules, regenStep, type Bars, type Ctx, type Quiet } from '../src/fight/hero-regen.ts';

const rules = regenRules(), idle: Ctx = { fought: false, noticed: false, moving: false, dead: false };
const hurt: Bars = { health: 50, maxHealth: 150, stamina: 20, maxStamina: 100 };
const run = (seconds: number, ctx: Ctx, bars: Bars = hurt, q: Quiet = { s: 0 }) => { let b = { ...bars }; for (let t = 0; t < seconds * 60; t++) b = { ...b, ...regenStep(q, 1 / 60, rules, ctx, b) }; return b; };

test('nothing comes back until the delay has passed, then health refills a full bar in its row seconds standing still', () => {
  const early = run(rules.delayS - 0.5, idle); assert.equal(early.health, hurt.health);
  const full = run(rules.delayS + rules.healthFullS, { ...idle }, { ...hurt, health: 0 }); assert.ok(full.health >= hurt.maxHealth - 1e-6, `got ${full.health}`);
  const half = run(rules.delayS + rules.healthFullS / 2, idle, { ...hurt, health: 0 }); assert.ok(Math.abs(half.health - hurt.maxHealth / 2) < 1, `got ${half.health}`);
});

test('walking regenerates at the move multiplier of standing still, stamina comes back faster than health', () => {
  const still = run(rules.delayS + 10, idle), walk = run(rules.delayS + 10, { ...idle, moving: true });
  assert.ok(walk.health > hurt.health && walk.health < still.health);
  assert.ok(Math.abs((walk.health - hurt.health) - (still.health - hurt.health) * rules.moveMult) < 0.01);
  assert.ok((still.stamina - hurt.stamina) / hurt.maxStamina > (still.health - hurt.health) / hurt.maxHealth, 'stamina refills faster (fraction of its bar)');
});

test('a hit dealt or taken, a creature noticing him, or being down resets the timer and nothing regenerates', () => {
  const q: Quiet = { s: 0 };
  let b = run(rules.delayS + 5, idle, hurt, q); assert.ok(b.health > hurt.health);
  for (const ctx of [{ ...idle, fought: true }, { ...idle, noticed: true }, { ...idle, dead: true }]) {
    const before = b; b = { ...b, ...regenStep(q, 1, rules, ctx, b) };
    assert.equal(b.health, before.health, JSON.stringify(ctx)); assert.equal(q.s, 0, 'the timer starts over');
  }
  const kept = b.health; b = { ...b, ...regenStep(q, 1, rules, idle, b) };
  assert.equal(b.health, kept, 'a quiet second inside the delay still gives nothing'); assert.ok(q.s > 0);
});

test('never above the max and never below what it was; the rule is on only for sandbox zones and only while the row says so', () => {
  const full = run(300, idle, { ...hurt, health: 140, stamina: 99 }); assert.equal(full.health, hurt.maxHealth); assert.equal(full.stamina, hurt.maxStamina);
  assert.equal(regenOn(false), false, 'a listed zone and the Pit never regenerate');
  assert.equal(regenOn(true), true);
  assert.equal(regenRules(45).healthFullS, 45, 'the ?regen= dial');
});

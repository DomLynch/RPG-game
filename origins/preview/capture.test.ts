// ?capture=seed (capture.ts): the walk is held at tick 0 and moves only by advance(n), so two builds' creatures stand in the same places at the same tick.
// Pure: no DOM. The creatures are stepped exactly as mobs-view.ts steps them (stepMob with the fixed captureStep).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureOn, createCaptureClock, dressPhase } from './capture.ts';
import { frontierBuild, frontierPlan } from './frontier-plan.ts';
import { mobSpecs, mobStand, newMob, stepMob, type Mob } from './mobs.ts';

const F = frontierPlan(), B = frontierBuild(F), SPECS = mobSpecs(F, B), ZONES = new Map(F.zones.map((z) => [z.zone, z]));
const HERO = { x: -97.05, z: 3.7 };
const fresh = (): Mob[] => SPECS.map((s, i) => newMob(s, i));
const advanceAll = (mobs: Mob[], clock: ReturnType<typeof createCaptureClock>, n: number): void => { clock.advance(n, (dt) => { for (let i = 0; i < mobs.length; i++) mobs[i] = stepMob(mobs[i]!, SPECS[i]!, HERO, dt, mobStand(B, ZONES.get(SPECS[i]!.zone)!)); }); };
const positions = (mobs: Mob[]): string => JSON.stringify(mobs.map((m) => [m.x, m.z, m.facing, m.mode, m.wait]));

test('the flag is read from the query string only', () => {
  assert.equal(captureOn('?region=1&zone=1&capture=seed'), true);
  assert.equal(captureOn('?capture=seed'), true);
  assert.equal(captureOn('?region=1'), false);
  assert.equal(captureOn('?capture=seeded'), false);
  assert.equal(captureOn(''), false);
});

test('advance(0) moves nothing; ticks and time count in whole fixed steps', () => {
  const clock = createCaptureClock(), mobs = fresh(), before = positions(mobs);
  advanceAll(mobs, clock, 0);
  assert.equal(positions(mobs), before);
  assert.equal(clock.ticks(), 0);
  assert.equal(clock.time(), 0);
  advanceAll(mobs, clock, 30);
  assert.equal(clock.ticks(), 30);
  assert.ok(Math.abs(clock.time() - 1) < 1e-9, 'thirty 1/30 s ticks are one second');
});

test('two independent runs of the same seed stand every creature in the same place at advance(300), however the ticks are chunked', () => {
  const a = fresh(), ca = createCaptureClock(); advanceAll(a, ca, 300);
  const b = fresh(), cb = createCaptureClock(); for (let i = 0; i < 300; i++) advanceAll(b, cb, 1);
  const c = fresh(), cc = createCaptureClock(); advanceAll(c, cc, 100); advanceAll(c, cc, 200);
  assert.equal(positions(a), positions(b));
  assert.equal(positions(a), positions(c));
  assert.equal(ca.ticks(), 300);
  const d = fresh(), cd = createCaptureClock(); advanceAll(d, cd, 299);
  assert.notEqual(positions(a), positions(d), 'not vacuous: one tick fewer is a different world (the step COUNT is what made two loads differ)');
});

test('the dress phase is a pure function of the creature id: the same whichever body arrived first, inside 0..3 s', () => {
  const ids = SPECS.map((s) => s.id), forward = ids.map(dressPhase), backward = [...ids].reverse().map(dressPhase).reverse();
  assert.deepEqual(forward, backward);
  for (const p of forward) assert.ok(p >= 0 && p < 3);
  assert.ok(new Set(forward).size > ids.length / 2, 'creatures are still out of step with their neighbours');
});

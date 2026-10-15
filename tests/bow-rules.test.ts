// The sandbox bow (step 1): a held draw with a charge fraction, one arrow with travel time, every number a row. Not in the Pit: no RV, no WSV.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOW, BOW_RULES, arrowAt, chargeOf, flightTicks, inBand, loadBowRules, multOf, newBow, stepBow, type BowState } from '../src/fight/bow-rules.ts';
import { worldRule } from '../src/fight/world-rules.ts';

const T = { distance: BOW.dummyDistance, lateral: 0 };
const run = (holds: boolean[], target = T, s: BowState = newBow()): BowState[] => holds.reduce<BowState[]>((all, h) => [...all, stepBow(all[all.length - 1] ?? s, h, target)], []);
const events = (states: BowState[]) => states.flatMap((s) => s.events);

test('the rows load and the minimum range is the world engage ring, not a second literal', () => {
  assert.equal(BOW.minRange, worldRule('engage'));
  assert.ok(BOW_RULES.length >= 12);
  for (const [k, v] of Object.entries(BOW)) assert.ok(Number.isFinite(v), `BOW.${k} is a finite number (the preview camera reads the framing rows: a missing one aims it at NaN)`);
  for (const k of ['camX', 'camY', 'camZ', 'lookLeft', 'lookY', 'lookDepth']) assert.ok(k in BOW, `BOW.${k}`);
  assert.throws(() => loadBowRules({ rules: BOW_RULES.filter((r) => r.id !== 'arrowSpeed') }), /arrowSpeed/);
  assert.throws(() => loadBowRules({ rules: BOW_RULES.map((r) => (r.id === 'fullDraw' ? { ...r, value: BOW.minDraw } : r)) }), /fullDraw/);
});

test('the charge fraction is 0 at the minimum draw, 1 at the full draw, and scales damage between the two multipliers', () => {
  assert.equal(chargeOf(BOW.minDraw), 0); assert.equal(chargeOf(BOW.fullDraw), 1); assert.equal(chargeOf(BOW.fullDraw + 99), 1); assert.equal(chargeOf(0), 0);
  assert.equal(multOf(0), BOW.minMult); assert.equal(multOf(1), BOW.fullMult);
  assert.ok(chargeOf((BOW.minDraw + BOW.fullDraw) / 2) > 0 && chargeOf((BOW.minDraw + BOW.fullDraw) / 2) < 1);
});

test('a tap shorter than the minimum draw cancels and fires nothing', () => {
  const ev = events(run([...Array(BOW.minDraw - 1).fill(true), false, false]));
  assert.deepEqual(ev.map((e) => e.type), ['draw', 'cancel']);
});

test('a full draw releases a full-charge arrow that flies for distance over speed, then hits for the full-mult share', () => {
  const states = run([...Array(BOW.fullDraw + 2).fill(true), ...Array(flightTicks(BOW.dummyDistance) + 3).fill(false)]);
  const ev = events(states), rel = ev.find((e) => e.type === 'release')!, hit = ev.find((e) => e.type === 'hit')!;
  assert.equal(rel.charge, 1);
  assert.equal(rel.damage, Math.round(BOW.heavyShare * BOW.dummyHealth * BOW.fullMult));
  assert.equal(hit.tick - rel.tick, flightTicks(BOW.dummyDistance), 'the arrow lands after exactly its flight time');
  assert.equal(states[states.length - 1]!.health, BOW.dummyHealth - rel.damage!);
  const arrowState = states.find((s) => s.arrow)!, a = arrowState.arrow!;
  assert.ok(arrowAt(a, a.launched) === 0 && arrowAt(a, a.arrives) === a.distance);
});

test('a minimum draw is a weaker shot than a full draw, and an arrow whose target has moved past the hit radius misses', () => {
  const dmg = (hold: number) => events(run([...Array(hold).fill(true), false, ...Array(90).fill(false)])).find((e) => e.type === 'release')!.damage!;
  assert.ok(dmg(BOW.minDraw) < dmg(BOW.fullDraw));
  const miss = events(run([...Array(BOW.fullDraw).fill(true), false, ...Array(90).fill(false)], { distance: BOW.dummyDistance, lateral: BOW.hitRadius + 0.1 }));
  assert.ok(miss.some((e) => e.type === 'miss') && !miss.some((e) => e.type === 'hit'));
});

test('the band: no draw inside the engage ring or past max range, one arrow in flight at a time, and the recovery blocks the next draw', () => {
  assert.ok(!inBand(BOW.minRange - 0.1) && inBand(BOW.minRange) && inBand(BOW.maxRange) && !inBand(BOW.maxRange + 0.1));
  assert.equal(events(run(Array(10).fill(true), { distance: BOW.minRange - 1, lateral: 0 })).length, 0, 'too close: the press starts nothing');
  const cycle = run([...Array(BOW.fullDraw).fill(true), false, ...Array(BOW.recovery - 1).fill(true)]);
  assert.equal(cycle.filter((s) => s.phase === 'draw' && s.tick > BOW.fullDraw).length, 0, 'held through the recovery: no second draw');
});

test('the same inputs give the same states (no clock, no randomness)', () => {
  const inputs = [...Array(30).fill(true), false, ...Array(60).fill(false)];
  assert.deepEqual(run(inputs), run(inputs));
});

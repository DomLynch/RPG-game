import test from 'node:test';
import assert from 'node:assert/strict';
import { LORARII, lorariusAngle } from '../src/lorarii.ts';

const TAU = Math.PI * 2, wrap = (a: number) => ((a % TAU) + TAU) % TAU;

test('lorariusAngle is a pure function of the sim tick (lead review: live and replay place the same guard)', () => {
  for (const i of [0, 1, 2, 3, 4, 5]) for (const tick of [0, 1, 59, 60, 731, 4096, 60 * 60 * 5]) {
    const a = lorariusAngle(i, tick);
    const later = Date.now() + 5; while (Date.now() < later) { /* wall time moves; the answer must not */ }
    assert.equal(lorariusAngle(i, tick), a, `guard ${i} tick ${tick}`);
  }
});

test('six guards, equal spacing: each paces inside his own sixth, none crosses into a neighbour\'s, none reaches the gate', () => {
  const gate = Math.PI, gateHalf = 0.13 + 0.06;   // LAYOUT.gateWidth 3.2 m on the 12.1 m walkway ≈ ±0.13 rad, plus a shoulder
  for (let tick = 0; tick <= 60 * 120; tick += 7) {
    for (let i = 0; i < LORARII.count; i++) {
      const a = lorariusAngle(i, tick), lo = LORARII.sixth * i, hi = LORARII.sixth * (i + 1);
      assert.ok(a > lo && a < hi, `guard ${i} at tick ${tick}: ${a.toFixed(3)} inside [${lo.toFixed(3)}, ${hi.toFixed(3)})`);
      assert.ok(Math.abs(wrap(a) - gate) > gateHalf, `guard ${i} at tick ${tick} clear of the gate`);
    }
  }
});

test('the patrol moves at Pace\'s own ground speed, so the feet never skate (Multi Chars measured 0.963 m/s off guard.glb)', () => {
  // Walking them slower than the clip is what makes a walk cycle slide; the clip's speed is the constraint, not a taste call.
  // Every guard walks the same speed (only his phase differs), so one timeScale of 1 serves all six.
  let folds = 0;
  // A leg ends when the wave crosses u = 0 or u = 0.5; the turn falls between two samples there, so that one step is short.
  // Identified from the wave itself, not from the number it produces, so a stall could never be mistaken for a turn.
  const period = 4 * LORARII.reach * LORARII.radius / LORARII.speed;
  const leg = (i: number, tick: number) => Math.floor(2 * ((((tick / 60) / period) + i * 0.29) % 1));
  for (let i = 0; i < LORARII.count; i++) for (let tick = 0; tick < 60 * 60; tick++) {
    if (leg(i, tick) !== leg(i, tick + 1)) { folds++; continue; }
    const v = Math.abs(lorariusAngle(i, tick + 1) - lorariusAngle(i, tick)) * LORARII.radius * 60;
    assert.ok(Math.abs(v - LORARII.speed) < 0.02, `guard ${i} tick ${tick}: ${v.toFixed(3)} m/s, want ${LORARII.speed}`);
  }
  // One straddling sample per leg and no more: if the wave ever stalled or jittered, this count would blow up.
  const legs = Math.ceil(60 * 60 / (period / 2 * 60)) * LORARII.count;
  assert.ok(folds <= legs + LORARII.count, `${folds} reversal samples, at most one per leg (${legs})`);
});

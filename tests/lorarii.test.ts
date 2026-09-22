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

test('the pace is a slow walk: never faster than ~0.6 m/s along the wall', () => {
  for (let i = 0; i < LORARII.count; i++) for (let tick = 0; tick < 60 * 60; tick++) {
    const v = Math.abs(lorariusAngle(i, tick + 1) - lorariusAngle(i, tick)) * LORARII.radius * 60;
    assert.ok(v < 0.6, `guard ${i} tick ${tick}: ${v.toFixed(3)} m/s`);
  }
});

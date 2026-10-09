import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RISE_M, RISE_MS, riseMetres, riseStep } from '../src/gate-rise.ts';

// The portcullis's lift curve (src/gate-rise.ts, drawn by arena.ts raiseGate; the Origins town walk raises it, origins/preview/main.ts). The Pit's walk-to-gate
// wiring tests that sat here went with the Pit room.
test('the bars lift RISE_M over RISE_MS, settle softly, and fall back faster', () => {
  let t = 0;
  for (let ms = 0; ms < RISE_MS; ms += 50) t = riseStep(t, true, 0.05);
  assert.equal(t, 1); assert.equal(riseMetres(1), RISE_M); assert.equal(riseMetres(0), 0);
  assert.ok(riseMetres(0.1) < RISE_M * 0.1, 'eased: the first tenth lifts less than a tenth');
  assert.ok(RISE_M >= 2.2 && RISE_M <= 2.4 && RISE_MS >= 1000 && RISE_MS <= 1500, 'about 2.3 m over about 1-1.5 s');
  assert.equal(riseStep(1, false, RISE_MS / 4000), 0, 'down in a quarter of the time');
});

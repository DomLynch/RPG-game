import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMFEEL, GRAVITY, FULL_TIER_STOP_MS } from '../src/fight/armfeel.ts';
import { KICK, KNOCK_SETTLE } from '../src/fight/hit-impact.ts';

// The Armfeel dials, the knock settle and the kick are rows / derived from rows now; the values must be exactly what the code held before.
test('armfeel and hit-impact rows give the numbers the code used to hold', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ARMFEEL)), { lean: 0.45, leanKill: 0.9, nudge: 0.16, decay: 12, decayKill: 10, hold: 0.045, holdKill: 0.08, lowEnergy: 0.4, weaponHoldMs: { half: 40, full: 60, kill: 80 } });
  assert.equal(GRAVITY, 8);
  assert.equal(FULL_TIER_STOP_MS, 90 + (5 * 1000) / 60);
  assert.equal(KNOCK_SETTLE, 0.12);
  assert.deepEqual({ ...KICK }, { stopMs: (2 * 1000) / 60, drop: 0.1 });
});

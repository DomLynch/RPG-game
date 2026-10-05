import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBackoffDelay } from '../src/net/backoff.ts';
import { isFinalClose } from '../src/net/reconnect-policy.ts';

test('backoff: doubles from the base, spreads 0.5x..1.5x, never passes the cap, always positive', () => {
  assert.equal(computeBackoffDelay(1, 500, 4000, () => 0.5), 500);
  assert.equal(computeBackoffDelay(2, 500, 4000, () => 0.5), 1000);
  assert.equal(computeBackoffDelay(3, 500, 4000, () => 0.5), 2000);
  assert.equal(computeBackoffDelay(1, 500, 4000, () => 0), 250);
  assert.ok(Math.abs(computeBackoffDelay(1, 500, 4000, () => 0.999) - 749.5) < 1e-9);
  for (const attempt of [4, 5, 20, 1000]) assert.equal(computeBackoffDelay(attempt, 500, 4000, () => 0.999), 4000, 'the cap holds, jitter included');
  for (let attempt = 1; attempt < 30; attempt++) assert.ok(computeBackoffDelay(attempt, 500, 4000, () => 0) > 0);
});

test('reconnect policy: the relay\'s final closes stop the retry; a blip is retried', () => {
  for (const code of [4001, 4008, 1002, 1003, 1009]) assert.equal(isFinalClose(code), true, String(code));
  for (const code of [1000, 1001, 1006, 4000, 1011]) assert.equal(isFinalClose(code), false, String(code));
  assert.equal(isFinalClose(undefined), false, 'an error event has no code: retry');
});

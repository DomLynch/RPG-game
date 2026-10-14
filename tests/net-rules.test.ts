import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../src/net/net-rules.json' with { type: 'json' };
import manifest from '../src/net/net-rules.manifest.json' with { type: 'json' };
import { NET, PLAYABLE } from '../src/net/rollback.ts';
import { INTENTS_CAP, MESSAGE_CAP, PING, SILENCE } from '../src/net/pvp.ts';
import { RECONNECT } from '../src/net/transport.ts';
import { DUEL_ANTIFARM } from '../src/net/duel-antifarm.ts';

test('net rules: every export keeps the exact shape and numbers it had in code (no id/note rides along)', () => {
  assert.deepEqual(NET, { delay: 2, maxDelay: 12, maxRollback: 8, hashEvery: 30, redundancy: 64, rttSamples: 120 });
  assert.deepEqual(PLAYABLE, { stallsPerMin: 60, maxDelay: 12, depthP95: 8 });
  assert.deepEqual(PING, { every: 6, samples: 10, maxFrames: 300, hello: 30 });
  assert.deepEqual(SILENCE, { waitMs: 3000, rejoinMs: 10000, abandonMs: 15000 });
  assert.deepEqual(RECONNECT, { retryMs: 500, fastMaxMs: 1000, maxRetryMs: 4000, reconnectMs: 30_000, beatStaleMs: 5000, directQuietMs: 1500 });
  assert.deepEqual([MESSAGE_CAP, INTENTS_CAP], [4096, 1024]);
  assert.deepEqual(DUEL_ANTIFARM, { elo: { start: 1000, k: 32, floor: 100 }, reward: { base: 10, perFullWin: 3, step: 0.5, min: 0.1 }, dayMs: 24 * 60 * 60 * 1000 });
});

test('net rules: the file loads through the registry, one row per table', () => {
  const reg = loadRegistry(manifest.tables.map((t) => tableFromFile(t as unknown as Manifest, rules, 'net-rules.json')));
  assert.ok(reg);
  for (const rows of Object.values(rules)) assert.equal(rows.length, 1);
});

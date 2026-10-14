import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../origins/server/server-rules.json' with { type: 'json' };
import manifest from '../origins/server/server-rules.manifest.json' with { type: 'json' };
import { MARK_GAP, MIN_GAP, POSE_BYTES } from '../origins/server/encounter-pose.ts';
import { POSED_FIGHT_MAX, fightOfToken, tokenFor } from '../origins/server/encounter.ts';
import { POSE_AGE_MS, REACH_SLACK, SLACK } from '../origins/server/world-spawns.ts';

test('server rules: the exports keep the numbers they had in code', () => {
  assert.deepEqual([MIN_GAP, MARK_GAP, POSE_BYTES, POSED_FIGHT_MAX, SLACK, REACH_SLACK, POSE_AGE_MS], [2, 6.5, 20, 50, 0.5, 4, 5000]);
  assert.deepEqual(rules.encounterPose.map((r) => r.edge), [0.01]);
  assert.deepEqual(rules.encounterToken.map((r) => r.randomBytes), [24]);
});

test('server rules: the file loads through the registry, one row per table', () => {
  const reg = loadRegistry(manifest.tables.map((t) => tableFromFile(t as unknown as Manifest, rules, 'server-rules.json')));
  assert.ok(reg);
  for (const rows of Object.values(rules)) assert.equal(rows.length, 1);
});

test('server rules: a token still ends in 32 random characters (24 bytes), and still reads its fight back', () => {
  const t = tokenFor('goblin-1');
  assert.equal(t.length - t.lastIndexOf('_') - 1, 32);
  assert.equal(fightOfToken(t), 'goblin-1');
});

test('server limits: the exports keep the numbers they had in code', async () => {
  const { MAX_OWNED } = await import('../origins/server/gear-import.ts'), { QUEUE_MAX } = await import('../origins/server/server.ts'), { PRESENCE_FRESH_MS } = await import('../origins/server/upgrade.ts');
  assert.deepEqual([MAX_OWNED, QUEUE_MAX, PRESENCE_FRESH_MS, rules.serverLimits[0]!.maxPending], [200, 16, 5000, 50]);
});

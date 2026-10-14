import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../src/core/contracts/contract-rules.json' with { type: 'json' };
import manifest from '../src/core/contracts/contract-rules.manifest.json' with { type: 'json' };
import { BANK_SLOTS, MAX_CURRENCY, MAX_STACK, MAX_UPGRADE_LEVEL, PACK_SLOTS } from '../src/core/contracts/items.ts';
import { MAX_COIN, MAX_MATERIAL_LINES, MAX_OFFER, MAX_UPGRADE_MATERIAL_INPUTS } from '../src/core/contracts/economy.ts';
import { MAX_RANKS, STANDING_MAX, STANDING_MIN } from '../src/core/contracts/world.ts';

test('contract rules: the exports keep the numbers they had in code', () => {
  assert.deepEqual([PACK_SLOTS, BANK_SLOTS, MAX_STACK, MAX_UPGRADE_LEVEL, MAX_CURRENCY], [64, 1000, 9999, 9, 1_000_000_000]);
  assert.deepEqual([MAX_COIN, MAX_OFFER, MAX_MATERIAL_LINES, MAX_UPGRADE_MATERIAL_INPUTS], [1_000_000_000, 16, 4, 64]);
  assert.deepEqual([STANDING_MIN, STANDING_MAX, MAX_RANKS], [-1000, 1000, 10]);
  assert.deepEqual([rules.storyLimits[0]!.maxDelta, rules.storyLimits[0]!.maxStages], [200, 64]);   // story.ts keeps these two private
});

test('contract rules: the file loads through the registry, one row per table', () => {
  const reg = loadRegistry(manifest.tables.map((t) => tableFromFile(t as unknown as Manifest, rules, 'contract-rules.json')));
  assert.ok(reg);
  for (const rows of Object.values(rules)) assert.equal(rows.length, 1);
});

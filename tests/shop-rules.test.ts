import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import rules from '../origins/shops/shop-rules.json' with { type: 'json' };
import manifest from '../origins/shops/shop-rules.manifest.json' with { type: 'json' };
import { BUY_MAX, LEVEL_MAX, PRICE_MAX, RESTOCK_RANGE, REVISION_MAX, STOCK_MAX } from '../origins/shops/shop.ts';

test('shop rules: the exports keep the numbers they had in code', () => {
  assert.deepEqual([PRICE_MAX, STOCK_MAX, BUY_MAX], [1_000_000, 1_000, 100]);
});

test('shop rules: the restock range, revision and level bounds keep the numbers they had in code', () => {
  assert.deepEqual([...RESTOCK_RANGE, REVISION_MAX, LEVEL_MAX], [10, 86_400, 1_000_000, 100]);
});

test('shop rules: the file loads through the registry, one row per table', () => {
  const reg = loadRegistry(manifest.tables.map((t) => tableFromFile(t as unknown as Manifest, rules, 'shop-rules.json')));
  assert.ok(reg);
  for (const rows of Object.values(rules)) assert.equal(rows.length, 1);
});

// The starter set is declared ONCE (Lead 2026-10-17): origins/region1/starter-wield.json (item -> LootId + maxQty). The ground items' starterItem table is built from those rows,
// so ground-items.json cannot carry a second list that drifts from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import RAW_GROUND from './ground-items.json' with { type: 'json' };
import WIELD from '../region1/starter-wield.json' with { type: 'json' };
import { GROUND_ITEMS, STARTER_ITEMS } from './ground-items.ts';
import { STARTER_WIELD } from '../region1/starter-wield.ts';

test('the starter set has one source: the wield rows; ground-items.json holds no list of its own', () => {
  assert.equal('starterItems' in RAW_GROUND, false, 'ground-items.json carries limits and placements only');
  assert.deepEqual(Object.keys(STARTER_ITEMS).sort(), WIELD.wield.map((r) => r.id).sort(), 'the starter items ARE the wield rows');
  assert.deepEqual([...STARTER_WIELD.keys()].sort(), Object.keys(STARTER_ITEMS).sort());
  for (const [id, r] of Object.entries(GROUND_ITEMS)) assert.ok(STARTER_ITEMS[r.item], `${id} names a starter item`);
  for (const r of WIELD.wield) assert.equal(STARTER_ITEMS[r.id]!.maxQty, r.maxQty);
});

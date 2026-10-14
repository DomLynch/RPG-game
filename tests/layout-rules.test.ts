// The origins world's layout and terrain numbers are rows (origins/world/layout-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LAYOUT_RULES, loadLayoutRules, layoutRule } from '../origins/world/layout-rules.ts';
import { ROAD_HALF, MODULE } from '../origins/world/town.ts';
import DEFS from '../origins/world/layout-rules-defs.json' with { type: 'json' };

test('every layout rule equals the literal it replaced', () => {
  assert.deepEqual([ROAD_HALF, MODULE], [6, 3]);
  assert.deepEqual(['terrainOctaves', 'terrainGain', 'terrainLacunarity', 'terrainWarp', 'padBlend'].map((id) => layoutRule(id as never)), [3, 0.5, 2, 0.6, 1.6]);
  assert.equal(LAYOUT_RULES.length, 7);
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadLayoutRules({ rules: rows.filter((r) => r.id !== 'roadHalf') }), /"roadHalf" rule by name/);
  assert.throws(() => loadLayoutRules({ rules: rows.map((r) => (r.id === 'padBlend' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadLayoutRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadLayoutRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 8);
});

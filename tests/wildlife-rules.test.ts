import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGES, RARE_CHANCE, RARITY_WEIGHT, RESPAWN_RANGE } from '../src/core/world/row.ts';
import { loadWildlifeRules, WILDLIFE_RULES } from '../src/core/world/wildlife-rules.ts';
import DEFS from '../src/core/world/wildlife-rules-defs.json' with { type: 'json' };

// The wildlife validator's bounds are rows (wildlife-rules-defs.json). Each default is pinned, byte for byte, to the literal it replaced.
test('the wildlife bounds equal the literals they replaced', () => {
  assert.equal(JSON.stringify(RARITY_WEIGHT), JSON.stringify({ common: 1, uncommon: 0.3, rare: 0 }));
  assert.equal(JSON.stringify(RARE_CHANCE), JSON.stringify([0.01, 0.25]));
  assert.equal(JSON.stringify(RESPAWN_RANGE), JSON.stringify([30, 300]));
  assert.equal(JSON.stringify(RANGES), JSON.stringify({ aggro: [2, 20], leash: [5, 80], roam: [0, 30], spread: [0, 40], pull: [0, 30] }));
  assert.equal(WILDLIFE_RULES.length, 17);
});

test('the loader refuses a missing bound, a negative value and a duplicate id', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadWildlifeRules({ rules: rows.filter((r) => r.id !== 'respawnMax') }), /"respawnMax" rule by name/);
  assert.throws(() => loadWildlifeRules({ rules: rows.map((r) => (r.id === 'leashMin' ? { ...r, value: -1 } : r)) }), /number >= 0/);
  assert.throws(() => loadWildlifeRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
});

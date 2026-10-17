import assert from 'node:assert/strict';
import test from 'node:test';
import { BANDS, COMMON_STEPS } from '../src/core/world/info.ts';
import { DEFAULT_RINGS, GUARD_LEVEL_FLOOR, GUARD_LEVEL_OVER } from '../origins/feuds/feuds.ts';

// The creature-info bands and the feud guard rings were TypeScript literals; they are json rows now (Dom's data-layer rule 2026-10-13). Each is pinned, byte for byte (JSON text), to the literal it replaced.

test('the con bands and the commonness steps equal the literals they replaced', () => {
  assert.equal(JSON.stringify(BANDS), JSON.stringify([
    { id: 'grey', permille: 0, label: 'Trivial', color: '#9d9d9d' },
    { id: 'green', permille: 200, label: 'Easy', color: '#7fdc4f' },
    { id: 'lightblue', permille: 500, label: 'Comfortable', color: '#6fc3ff' },
    { id: 'blue', permille: 900, label: 'Slightly easy', color: '#4a7dff' },
    { id: 'white', permille: 1000, label: 'Even', color: '#f2f2f2' },
    { id: 'yellow', permille: 1100, label: 'Tougher', color: '#ffe97a' },
    { id: 'red', permille: 1250, label: 'Dangerous', color: '#ff4444' },
  ]));
  assert.equal(JSON.stringify(COMMON_STEPS), JSON.stringify([[0.3, 'Common'], [0.12, 'Uncommon'], [0, 'Rare']]));
});

test('the guard rings equal the literals they replaced; the outer ring still reads the feud rules', () => {
  assert.equal(JSON.stringify(DEFAULT_RINGS), JSON.stringify([
    { id: 'outer', fromMetres: 30, band: 'wanted', guardLevelFloor: GUARD_LEVEL_FLOOR, guardLevelOver: GUARD_LEVEL_OVER, damagePermille: 1000 },
    { id: 'middle', fromMetres: 15, band: 'wanted', guardLevelFloor: 30, guardLevelOver: 10, damagePermille: 1500 },
    { id: 'inner', fromMetres: 0, band: 'hunted', guardLevelFloor: 40, guardLevelOver: 20, damagePermille: 4000 },
  ]));
});

// scripts/pack-battery.ts rungs must reach the hero: rungs 0/2/4 gave byte-identical fights because the gear went in as player()'s `level` argument. A rung is a sheet, and a higher rung is a different one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rungSheet } from '../scripts/lib/rung-sheet.ts';
import { player } from '../src/fight/world.ts';

test('pack battery: rung 0 is the naked hero, and rungs 2, 4 and 9 each give a different sheet', () => {
  assert.equal(rungSheet(0), undefined);
  const [a, b, c] = [2, 4, 9].map((r) => JSON.stringify(rungSheet(r)));
  assert.ok(a !== 'undefined' && a !== b && b !== c, `${a} / ${b} / ${c}`);
});

test('pack battery: a rung-4 hero is sized differently from the naked hero', () => {
  const build = (rung: number) => { const sheet = rungSheet(rung); return player('h', 0, 0, 0, 3, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }); };
  assert.notDeepEqual(build(4).sheet, build(0).sheet);
  assert.ok(build(9).maxHealth > build(0).maxHealth);
});

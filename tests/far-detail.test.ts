import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { farHide } from '../origins/preview/far-detail.ts';

test('past the range an idle creature draws its body only; inside it, or at the range, it wears the whole look', () => {
  assert.equal(farHide(30, false, 14), true);
  assert.equal(farHide(14.01, false, 14), true);
  assert.equal(farHide(14, false, 14), false);
  assert.equal(farHide(3, false, 14), false);
});
test('a creature that fights, hunts or is engaged always wears all of its look, however far', () => {
  assert.equal(farHide(60, true, 14), false);
});
test('the range is a row (14 m)', () => {
  const rows = (JSON.parse(readFileSync(new URL('../src/fight/fx-rows.json', import.meta.url), 'utf8')) as { fxRows: { id: string; fields: { value: number } }[] }).fxRows;
  assert.equal(rows.find((r) => r.id === 'mob-view.piece-range')?.fields.value, 14);
});

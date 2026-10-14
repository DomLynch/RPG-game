import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statsView, chromeText } from './stats-view.ts';
import { SHEET_ROWS } from '../../src/core/index.ts';

test('the view has one line per dial and skill row, named from the rows, never an id', () => {
  const v = statsView({ level: 4, placed: { attack: 3, armour: 1 } });
  assert.equal(v.dials.length + v.skills.length, SHEET_ROWS.length);
  assert.ok(v.dials.length >= 10 && v.dials.every((d) => d.name !== d.id && d.name.length > 1));
  assert.equal(v.dials.find((d) => d.id === 'attack')!.placedText, '+3 placed');
  assert.equal(v.dials.find((d) => d.id === 'health')!.placedText, 'no points placed');
});
test('the level and the points placed against the rules\' budget', () => {
  const v = statsView({ level: 4, placed: { attack: 3, armour: 1 } });
  assert.equal(v.levelText, 'Level 4'); assert.equal(v.pointsText, '4 of 4 points placed');
  assert.equal(statsView({ level: 0, placed: {} }).pointsText, '0 of 0 points placed');
});
test('no effective number without the writer\'s sheet: placed points only, never a guessed value', () => {
  const v = statsView({ level: 4, placed: { attack: 3 } });
  assert.equal(v.hasSheet, false); assert.ok(v.dials.every((d) => d.value === '' && d.fraction === null));
});
test('with the writer\'s sheet a dial shows that number, and a dial at its base (absent) shows none', () => {
  const v = statsView({ level: 4, placed: { attack: 3 }, sheet: { attack: 28 } });
  assert.equal(v.hasSheet, true);
  const atk = v.dials.find((d) => d.id === 'attack')!, hp = v.dials.find((d) => d.id === 'health')!;
  assert.equal(atk.value, '28'); assert.equal(atk.fraction, 0.28); assert.equal(hp.value, ''); assert.equal(hp.fraction, null);
});
test('chrome text fills its values', () => { assert.equal(chromeText('level', { level: 7 }), 'Level 7'); });

// The power-word gain and the boss-telegraph roll window are rows (src/fight/scene-rows.json), and each default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sceneNum } from '../src/fight/scene-rows.ts';
import { POWER_WORD_GAIN } from '../src/fight/power-words.ts';

test('the rows hold the numbers the files held before', () => {
  assert.equal(sceneNum('power-words.gain'), 0);
  assert.equal(sceneNum('boss-telegraph.roll-ticks'), 24);
  assert.equal(POWER_WORD_GAIN, 0);
});

test('a row that does not exist throws instead of answering NaN', () => {
  assert.throws(() => sceneNum('no-such-row'), /no row/);
});

test('boss-telegraph keeps no old literal', () => {
  assert.doesNotMatch(readFileSync(new URL('../src/fight/boss-telegraph.ts', import.meta.url), 'utf8'), /ROLL_TICKS = 24;/);
});

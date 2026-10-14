// The Hades cloud's and the boss specials' effect pool sizes and tunes as rows (special-fx.ts and special-fx-boss.ts): every default is the literal the code held before (special-fx-core-rows.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specialFxCoreNum } from '../src/fight/special-fx-core-rows.ts';

test('the rows hold the values the files held before', () => {
  const was: Record<string, number> = {
    'special-fx.cloud': 14,
    'special-fx.halo': 8,
    'special-fx.burst': 20,
    'special-fx.burst-life': 0.55,
    'special-fx.cloud-high': 0.7,
    'special-fx.cloud-low': 0.12,
    'boss.pit-mist': 0.13,
    'boss.pit-stain': 0.07,
    'boss.pit-breath': 0.03,
    'boss.mist': 64,
    'boss.ghost': 23,
    'boss.flies': 280,
    'boss.wisp': 30,
    'boss.ring': 18,
    'boss.veils': 6,
    'boss.drops': 260,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(specialFxCoreNum(id), v, id);
  assert.throws(() => specialFxCoreNum('no-such-row'), /no row/);
});

test('the files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('special-fx.ts'), /CLOUD = 14|BURST_LIFE = 0\.55|CLOUD_HIGH = 0\.7/);
  assert.doesNotMatch(src('special-fx-boss.ts'), /MIST = 64|FLIES = 280|DROPS = 260|PIT_MIST = 0\.13/);
});

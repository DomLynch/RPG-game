// The Dwarf quake's, the wind's and the class special's effect pools and tunes as rows (special-fx-quake.ts, special-fx-wind.ts, special-fx-class.ts): every default is the literal the code held before (special-fx-field-rows.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specialFxFieldNum } from '../src/fight/special-fx-field-rows.ts';

test('the rows hold the values the files held before', () => {
  const was: Record<string, number> = {
    'quake.rim': 0.6,
    'quake.strips': 11,
    'quake.sheets': 6,
    'quake.grit': 220,
    'quake.dust': 24,
    'quake.cap': 0.92,
    'quake.cap-pit': 0.4,
    'wind.cap': 0.8,
    'wind.streaks': 11,
    'wind.sheets': 4,
    'wind.grit': 80,
    'wind.gather-ticks': 30,
    'class.decals': 48,
    'class.grit': 72,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(specialFxFieldNum(id), v, id);
  assert.throws(() => specialFxFieldNum('no-such-row'), /no row/);
});

test('the files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('special-fx-quake.ts'), /STRIPS = 11|CAP = 0\.92|RIM = 0\.6/);
  assert.doesNotMatch(src('special-fx-wind.ts'), /STREAKS = 11|CAP = 0\.8/);
  assert.doesNotMatch(src('special-fx-class.ts'), /DECALS = 48/);
});

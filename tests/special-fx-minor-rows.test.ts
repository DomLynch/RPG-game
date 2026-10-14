// The Legion's, the Nightborn's and the Pitborn's effect ring, cap and build-up as rows (special-fx-legion.ts, special-fx-nightborn.ts, special-fx-pitborn.ts): every default is the literal the code held before (special-fx-minor-rows.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specialFxMinorNum } from '../src/fight/special-fx-minor-rows.ts';

test('the rows hold the values the files held before', () => {
  const was: Record<string, number> = {
    'legion.ring': 26,
    'nightborn.cap': 0.88,
    'pitborn.build': 30,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(specialFxMinorNum(id), v, id);
  assert.throws(() => specialFxMinorNum('no-such-row'), /no row/);
});

test('the files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('special-fx-legion.ts'), /RING = 26/);
  assert.doesNotMatch(src('special-fx-nightborn.ts'), /CAP = 0\.88/);
  assert.doesNotMatch(src('special-fx-pitborn.ts'), /BUILD = 30/);
});

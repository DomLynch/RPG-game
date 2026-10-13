// The page's starting career level and the ore count are a row (start-rules.json), and play.ts (Vite-only: it cannot load under node) reads them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import START_ROWS from './start-rules.json' with { type: 'json' };

test('the start-rules row holds the values the code held before: level 16, 5 ore', () => {
  assert.deepEqual(START_ROWS.startRule, [{ id: 'page-start', startLevel: 16, oreQuantity: 5 }]);
});

test('play.ts reads both numbers from the row and keeps none of its own', () => {
  const src = readFileSync(new URL('./play.ts', import.meta.url), 'utf8');
  assert.match(src, /export const START_LEVEL = START\.startLevel;/);
  assert.match(src, /You take \$\{START\.oreQuantity\} Exchange ore from the cart\./);
  assert.doesNotMatch(src, /START_LEVEL = \d/);
});

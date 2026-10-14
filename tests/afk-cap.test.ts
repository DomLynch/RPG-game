// AFK_CAP steers the stepped duel (it sets how many sim seconds a hidden tab's missed fight is caught up), so its row sits beside the first-loss rows (src/first-loss-rules.json), not in ui-rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AFK_CAP_S } from '../src/first-loss.ts';

test('the AFK cap is the 300 s the code held before, from the first-loss rows', () => {
  assert.equal(AFK_CAP_S, 300);
  const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  assert.match(src('main.ts'), /const AFK_CAP = AFK_CAP_S;/);
  assert.doesNotMatch(src('ui-rows.json'), /afk-cap/);
});

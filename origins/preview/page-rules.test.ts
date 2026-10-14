// The zone page's feel and load-wait numbers are rows (page-rules.json), and every default is the literal the code held before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageRule } from './page-rules.ts';
import { DEAD, LOOK_GAIN, STICK_R } from './sticks.ts';

test('every row holds the value the code held before', () => {
  assert.deepEqual(
    ['duel-camera-ease-s', 'hero-wait-ms', 'kinds-wait-ms', 'material-bound-ms', 'upload-budget-ms', 'tap-ms', 'tap-px', 'turn-rate'].map(pageRule),
    [0.7, 45000, 20000, 4000, 6, 4000, 12, 1.9],
  );
});

test('sticks.ts exports the row values, not its own', () => {
  assert.deepEqual([STICK_R, LOOK_GAIN, DEAD], [48, 0.5, 0.12]);
});

test('a missing row throws instead of answering NaN', () => {
  assert.throws(() => pageRule('no-such-row'), /no row/);
});

test('main.ts, pit-duel.ts and sticks.ts keep none of the numbers', () => {
  const src = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('main.ts'), /HERO_WAIT_MS = \d|UPLOAD_BUDGET_MS = \d|KINDS_WAIT_MS = \d|TAP_MS = \d|TURN = 1\.9/);
  assert.doesNotMatch(src('pit-duel.ts'), /CAMERA_EASE_S = 0/);
  assert.doesNotMatch(src('sticks.ts'), /STICK_R = 48|DEAD = 0/);
});

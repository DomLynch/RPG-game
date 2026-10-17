// The page's presentation numbers are rows (src/present-rows.json), and every default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { present } from '../src/present-rows.ts';
import { CLIP_FINISH_CAP, CLIP_HEIGHT, CLIP_LEAD, CLIP_SECONDS, CLIP_TAIL, CLIP_WIDTH } from '../src/clip.ts';
import { RISE_M, RISE_MS } from '../src/gate-rise.ts';
import { CATCHUP, MAX_LAG_TICKS } from '../src/pvp-hold.ts';
import { LORARII } from '../src/lorarii.ts';

test('every row holds the value the code held before', () => {
  assert.deepEqual([CLIP_SECONDS, CLIP_LEAD, CLIP_TAIL, CLIP_FINISH_CAP, CLIP_WIDTH, CLIP_HEIGHT, present('clip-fps')], [10, 5, 1, 8, 720, 1280, 30]);
  assert.deepEqual([RISE_M, RISE_MS, CATCHUP, MAX_LAG_TICKS], [2.3, 1250, 3, 6]);
  assert.deepEqual([present('coach-lapse-min'), present('coach-lapse-max')], [0.1, 0.85]);
  assert.deepEqual({ ...LORARII }, { count: 6, radius: 12.1, top: 2.6, sixth: Math.PI / 3, reach: 0.28, speed: 0.963, raiseClip: 0.5, turn: 4, raise: 0.35, lash: 0.22, recover: 0.6, lead: 60, raiseScaleMax: 2.5, raiseScaleMin: 0.4, leadFloor: 0.05 });
  assert.deepEqual([present('frame-dt-max'), present('colour-channel-max'), present('beacon-frames-cap')], [0.1, 255, 1_000_000]);   // the inline clamps the as-data ratchet retired (Web 2026-10-17)
});

test('a row that does not exist throws instead of answering NaN', () => {
  assert.throws(() => present('no-such-row'), /no row/);
});

test('the five files keep none of the numbers', () => {
  const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('clip.ts'), /CLIP_LEAD = \d|CLIP_WIDTH = \d|const FPS = \d/);
  assert.doesNotMatch(src('gate-rise.ts'), /RISE_MS = \d/);
  assert.doesNotMatch(src('pvp-hold.ts'), /CATCHUP = \d|MAX_LAG_TICKS = \d/);
  assert.doesNotMatch(src('coach.ts'), /LAPSE_MIN = \d/);
  assert.doesNotMatch(src('lorarii.ts'), /radius: 12|speed: 0\.9/);
});

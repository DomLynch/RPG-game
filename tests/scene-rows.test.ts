// The camera, scene and presentation numbers are rows (src/fight/scene-rows.json), and every default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sceneNum } from '../src/fight/scene-rows.ts';
import { TOUR } from '../src/fight/camera.ts';
import { POWER_WORD_GAIN } from '../src/fight/power-words.ts';

test('the scalar rows hold the numbers the files held before', () => {
  const was: Record<string, number> = {
    'camera.aim-per-shrink': 1.4, 'camera.low-side': 0.5, 'camera.low-lift': 0.8, 'camera.tall-back': 2.4, 'camera.tall-lift': 1.6, 'camera.shoulder': 1.5, 'camera.side-clear': 1.2, 'camera.short-fade': 1,
    'follow-camera.ahead': 3, 'follow-camera.look-y': 1.5, 'scene.compile-bound-ms': 6000, 'scene.look-bake-ms': 6, 'power-words.gain': 0, 'boss-telegraph.roll-ticks': 24,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(sceneNum(id), v, id);
});

test('the exported numbers and the tour are exactly what they were', () => {
  assert.deepEqual({ ...TOUR }, { delay: 5, afterSettle: 3, blendIn: 3, lap: 40, breathe: 25, rise: 30, radius: 5.2, breath: 1.3, lookY: 0.7, lookYPortrait: 1.3 });
  assert.equal(POWER_WORD_GAIN, 0);
});

test('a row that does not exist throws instead of answering NaN', () => {
  assert.throws(() => sceneNum('no-such-row'), /no row/);
});

test('the files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('camera.ts'), /AIM_PER_SHRINK = 1\.4|LOW_SIDE = 0\.5|TALL_BACK = 2\.4|SIDE_CLEAR = 1\.2|delay: 5, afterSettle/);
  assert.doesNotMatch(src('scene.ts'), /COMPILE_BOUND_MS = 6000|LOOK_BAKE_MS = 6;/);
  assert.doesNotMatch(src('boss-telegraph.ts'), /ROLL_TICKS = 24;/);
});

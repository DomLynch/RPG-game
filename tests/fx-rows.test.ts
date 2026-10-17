// The view effects' numbers are rows (src/fight/fx-rows.json), and every default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fxNum } from '../src/fight/fx-rows.ts';
import { LOW_OFF, LOW_STAMINA } from '../src/fight/fatigue-preview.ts';
import { KICK_CLOSE_GROWTH, KICK_CLOSE_TICKS } from '../src/fight/kick-close.ts';
import { BEAR_RENDER_SCALE, BOAR_RENDER_SCALE, WOLF_RENDER_SCALE } from '../src/fight/beast-scale.ts';
import { FIGHTER_TEXTURE_CAP } from '../src/fight/quality.ts';
import { KICK_LANDS } from '../src/fight/hud.ts';

test('the exported numbers are the literals the files held before', () => {
  assert.deepEqual([LOW_STAMINA, LOW_OFF, KICK_CLOSE_TICKS, KICK_CLOSE_GROWTH, WOLF_RENDER_SCALE, BOAR_RENDER_SCALE, BEAR_RENDER_SCALE, FIGHTER_TEXTURE_CAP, KICK_LANDS], [10, 12, 4, 0.03, 2, 1.8, 2.2, 1024, 1.5]);
});

test('the private numbers are rows with their old values', () => {
  const was: Record<string, number> = {
    'charge-fx.hoof': 18, 'charge-fx.burst': 20, 'charge-fx.grain': 20, 'charge-fx.streak': 24, 'charge-fx.lead': 2, 'charge-fx.stride': 0.36, 'charge-fx.life': 2, 'charge-fx.burst-run': 1.6, 'charge-fx.gap-floor': 0.5,
    'opening-pose.in': 0.12, 'opening-pose.out': 0.2, 'opened.chunk': 2048, 'opened.scan': 100000, 'opened.step-ms': 8,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(fxNum(id), v, id);
  assert.throws(() => fxNum('no-such-row'), /no row/);
});

test('the seven files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('charge-fx.ts'), /HOOF = 18|STRIDE = 0\.36|LEAD = 2\.0/);
  assert.doesNotMatch(src('opened.ts'), /CHUNK = 2048|SCAN = 100_000|STEP_MS = 8/);
  assert.doesNotMatch(src('opening-pose.ts'), /IN = \.12/);
  assert.doesNotMatch(src('beast-scale.ts'), /RENDER_SCALE = [0-9]/);
  assert.doesNotMatch(src('quality.ts'), /FIGHTER_TEXTURE_CAP = 1024/);
});

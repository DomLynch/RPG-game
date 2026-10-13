// The page's view-layer tunables are rows (src/ui-rows.json), and every default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ui, uiGroup } from '../src/ui-rows.ts';
import { layoutTier } from '../src/layout-tier.ts';

test('every row holds the value the code held before', () => {
  const was: Record<string, number> = {
    'loot-line-ms': 4000, 'lesson-ms': 4000, 'face-wait-ms': 2000, 'replay-tail-s': 7, 'heavy-hit-stop-ms': 90, 'heavy-block-stop-ms': 50,
    'compact-max-height-px': 480, 'compact-max-width-px': 700, 'tablet-min-dimension-px': 768, 'tablet-min-width-px': 1000, 'tablet-max-width-px': 1024,
  };
  for (const [id, v] of Object.entries(was)) assert.equal(ui(id), v, id);
});

test('the hit-stop group is the seven contact pauses it was', () => {
  assert.deepEqual(uiGroup('hit-stop'), { SpecialLanded: 50, Blocked: 30, Hit: 50, Parried: 70, GuardBroken: 90, PostureBroken: 150, Killed: 220 });
});

test('a row that does not exist throws instead of answering NaN', () => {
  assert.throws(() => ui('no-such-row'), /no row/);
});

test('the layout tiers fall where the literals put them', () => {
  assert.equal(layoutTier(390, 694), 'compact');
  assert.equal(layoutTier(844, 390), 'compact');
  assert.equal(layoutTier(1024, 768), 'tablet');
  assert.equal(layoutTier(1366, 768), 'standard');
  assert.equal(layoutTier(1280, 720), 'standard');
});

test('main.ts and layout-tier.ts keep none of the numbers', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /const LOOT_LINE_MS = ui\('loot-line-ms'\);/);
  assert.match(main, /const HIT_STOP: .* = uiGroup\('hit-stop'\);/);
  assert.doesNotMatch(main, /const (LESSON_MS|REPLAY_TAIL|FACE_WAIT_MS) = \d/);
  assert.doesNotMatch(readFileSync(new URL('../src/layout-tier.ts', import.meta.url), 'utf8'), /_PX = \d/);
});

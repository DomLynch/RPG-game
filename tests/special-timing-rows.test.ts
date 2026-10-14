// The specials' timing numbers as rows (Dom's data-layer rule), pinned to the values they held in code. special-timing.ts is pure, so its exports are checked as well as the data.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import raw from '../src/fight/special-timing-rules.json' with { type: 'json' };
import man from '../src/fight/special-timing-rules.manifest.json' with { type: 'json' };
import { BOSS_TAIL, CAST_MARGIN, CUTS, CUT_GAP, DISSOLVE_TICKS, DROP_TICKS, RIPPLE } from '../src/fight/special-timing.ts';
import { BACK_TICKS, DRAG_FROM, LATERAL, STEP_WINDOW } from '../src/fight/special-class-timing.ts';
import { BUILD } from '../src/fight/special-boss-timing.ts';

test('each row keeps the number the file held in code', () => {
  assert.deepEqual(raw.specialTimingRule, [{ id: 'specialTiming', dropTicks: 24, ripple: 30, castMargin: 60, cuts: 7, cutGap: 4, dissolveTicks: 20, bossTail: 84 }]);
  assert.deepEqual(raw.classTimingRule, [{ id: 'classTiming', backTicks: 30, dragFrom: 36, lateral: 0.8, stepWindow: 26 }]);
  assert.deepEqual(raw.titheRule, [{ id: 'tithe', chamber: 0.55, chamberFrom: 0.84, strikeFrom: 0.92 }]);
  assert.deepEqual(raw.shieldSlamRule, [{ id: 'shieldSlam', lead: 14, hold: 18, release: 20 }]);
  assert.deepEqual(raw.bossTimingRule, [{ id: 'bossTiming', build: 30 }]);
});

test('the pure timing modules export the row values', () => {
  assert.deepEqual([DROP_TICKS, RIPPLE, CAST_MARGIN, CUTS, CUT_GAP, DISSOLVE_TICKS, BOSS_TAIL], [24, 30, 60, 7, 4, 20, 84]);
  assert.deepEqual([BACK_TICKS, DRAG_FROM, LATERAL, STEP_WINDOW, BUILD], [30, 36, 0.8, 26, 30]);
});

test('the rows file loads through the registry, one row per table', () => {
  assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'special-timing-rules.json'))));
  for (const rows of Object.values(raw)) assert.equal(rows.length, 1);
});

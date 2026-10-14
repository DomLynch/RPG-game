// The blood, gore, wounds and nightfall numbers are rows (src/fight/blood-rows.json), and every default is the literal the code held before (Dom's data-layer rule, 2026-10-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bloodNum } from '../src/fight/blood-rows.ts';
import { EDGE_MS, HEAD_ON, SPAN, WIDTH_VW } from '../src/fight/blood-edge.ts';
import { BLOOD } from '../src/fight/blood-style.ts';
import { DROPS, DRY, WOUNDS_PER_FIGHTER, WOUND_THRESHOLD } from '../src/fight/gore.ts';
import { FLOOR } from '../src/fight/nightfall-fx.ts';
import { RETURN, VEIL, VEIL_HOLD } from '../src/fight/nightfall-timing.ts';

test('the exported numbers are the literals the files held before', () => {
  assert.deepEqual([EDGE_MS, HEAD_ON, SPAN, WIDTH_VW], [480, 0.6, 68, 6]);
  assert.deepEqual({ ...BLOOD }, { slots: 112, hit: 15, kill: 25, drops: { hit: 2, kill: 3 }, start: '#690f0d', end: '#200504' });
  assert.deepEqual({ ...DROPS }, { every: [3, 6], until: 0.5, inFlight: 8, spots: 24, spot: [0.04, 0.08], gravity: 9.8, floor: 0.021, seconds: 25 });
  assert.deepEqual({ ...DRY }, { seconds: 20, roughness: [0.42, 0.75] });
  assert.deepEqual([WOUND_THRESHOLD, WOUNDS_PER_FIGHTER, FLOOR, VEIL_HOLD, RETURN, VEIL], [0.6, 5, 0.07, 15, 30, 24]);
});

test('the private numbers are rows with their old values', () => {
  const was: Record<string, number> = { 'blood-style.front': 0.35, 'blood-style.min-cam': 1.5, 'gore.arm-share': 0.5, 'gore.floor-dry': 8, 'nightfall-fx.rim-net': 0.65, 'wounds-fx.spots': 40, 'wounds-fx.spot-life': 25, 'wounds-fx.drip-size': 0.12, 'wounds-fx.mark-spread': 0.45 };
  for (const [id, v] of Object.entries(was)) assert.equal(bloodNum(id), v, id);
  assert.throws(() => bloodNum('no-such-row'), /no row/);
});

test('the six files keep none of the old literals', () => {
  const src = (f: string) => readFileSync(new URL(`../src/fight/${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src('blood-edge.ts'), /EDGE_MS = 480|WIDTH_VW = 6/);
  assert.doesNotMatch(src('gore.ts'), /WOUND_THRESHOLD = 0\.6|FLOOR_DRY = 8/);
  assert.doesNotMatch(src('wounds-fx.ts'), /SPOTS = 40/);
  assert.doesNotMatch(src('nightfall-timing.ts'), /RETURN = 30/);
});

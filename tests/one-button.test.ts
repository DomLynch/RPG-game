// CS31 one-button strike + touch layout A (Combat sandbox @93b1138c7): off by default, rows with the sandbox's values, the stab sector, and the layout's positions (the sandbox's numbers for the default variant).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEAVY_HOLD_MS, ONE_BUTTON, STAB_HALF_ANGLE, STAB_SLIDE_PX, stabSector } from '../src/fight/input.ts';
import { touchLayoutCss } from '../src/fight/touch-layout.ts';

test('the one-button strike is off by default and its rows hold the sandbox values', () => {
  assert.equal(ONE_BUTTON, false, 'off = today\'s Light button');
  assert.deepEqual([HEAVY_HOLD_MS, STAB_SLIDE_PX, STAB_HALF_ANGLE], [180, 18, 50]);
});

test('a slide within 50 degrees of straight up is the stab; a side slide or a downward one is not', () => {
  assert.equal(stabSector(0, -30), true, 'straight up');
  assert.equal(stabSector(20, -30), true, 'up and a little right (33 degrees)');
  assert.equal(stabSector(40, -30), false, 'more sideways than 50 degrees (53 degrees): a cut');
  assert.equal(stabSector(-40, -30), false, 'and the mirror');
  assert.equal(stabSector(0, 30), false, 'down is never the stab');
});

test('every one-button branch in input.ts is behind ONE_BUTTON, so off is the old code path', () => {
  const src = readFileSync(new URL('../src/fight/input.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(ONE_BUTTON\) \{ const dx[\s\S]*?\} else if \(side\) \{ fireSlash\(side\); return; \}/, 'the swipe decision is the old slash slide when off');
  assert.match(src, /\(ONE_BUTTON \? HEAVY_HOLD_MS : SLASH_DECIDE_MS\)/, 'the decide wait is the old one when off');
  assert.match(src, /if \(ONE_BUTTON && typeof document !== 'undefined'\) applyTouchLayout/, 'the layout is applied only while the strike is one-button');
});

test('touch layout A, default variant: the sandbox\'s placement (px from the right and bottom edge) and labels', () => {
  const css = touchLayoutCss('');
  const at = (id: string) => css.match(new RegExp(`\\.actions #${id}\\{right:(-?\\d+(?:\\.\\d+)?)px!important;bottom:(-?\\d+(?:\\.\\d+)?)px!important;width:(\\d+)px!important`))!.slice(1).map(Number);
  assert.deepEqual(at('attack-button'), [68, 92, 72], 'STRIKE at the thumb\'s rest point, 72 px');
  assert.deepEqual(at('skill-button'), [150, 174, 50], 'special upper-left');
  assert.deepEqual(at('guard-button'), [150, 32, 50], 'guard lower-left');
  assert.deepEqual(at('dodge-button'), [8, 32, 50], 'roll lower-right');
  assert.deepEqual(at('kick-button'), [180, 107, 42], 'kick far left, a touch smaller');
  for (const label of ['STRIKE', 'SPECIAL', 'GUARD', 'ROLL', 'KICK']) assert.match(css, new RegExp(`::after\\{content:"${label}"`));
});

test('?lay=1 and ?lay=3 grow STRIKE and its zone ring apart; anything else is the default', () => {
  const strike = (s: string) => Number(touchLayoutCss(s).match(/\.actions #attack-button\{right:[^}]*?width:(\d+)px/)![1]);
  assert.deepEqual([strike('?lay=1'), strike('?lay=3'), strike('?lay=9'), strike('')], [80, 64, 72, 72]);
});

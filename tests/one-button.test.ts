// CS31 one-button strike + touch layout A (Combat sandbox @93b1138c7): ON by default since RV80, rows with the sandbox's values, the stab sector, and the layout's positions (the sandbox's numbers for the default variant).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEAVY_HOLD_MS, HEAVY_HOLD_WINDOW_MS, heavyHoldMs, ONE_BUTTON, STAB_HALF_ANGLE, STAB_SLIDE_PX, stabSector } from '../src/fight/input.ts';
import { touchLayoutCss } from '../src/fight/touch-layout.ts';
import { idleIntent, initialDuel, stepDuel, type Duel } from '../src/fight/duel.ts';
import { RULES } from '../src/fight/moves.ts';

test('the one-button strike is ON by default (RV80, Dom 2026-10-19: "turn it on, I\'m not going to add different urls"), and its rows hold the sandbox values (heavyHold 220)', () => {
  assert.equal(ONE_BUTTON, true, 'on = layout A and the STRIKE wheel are the default pad; the row input.one-button 0 is the one-row way back to the Light, Thrust and Heavy buttons');
  assert.deepEqual([HEAVY_HOLD_MS, STAB_SLIDE_PX, STAB_HALF_ANGLE], [220, 18, 50]);
});

// CS36b: measured under layout A (RV79 PR, oneButton findings): the guard-counter window is 20 ticks (333 ms at 60 Hz) and a 220 ms hold plus the reaction to a block ran past it, so the heavy riposte could not be reached.
test('inside a counter window the heavy hold is the short window hold, which leaves a human reaction in the 20-tick window; outside it nothing changes', async () => {
  const { default: rules } = await import('../src/fight/rules-defs.json', { with: { type: 'json' } });
  const windowMs = (rules.rules as { id: string; n: number }[]).find((r) => r.id === 'guardCounter')!.n * (1000 / 60);
  assert.equal(heavyHoldMs(false), HEAVY_HOLD_MS, 'no window: the plain hold');
  assert.equal(heavyHoldMs(true), HEAVY_HOLD_WINDOW_MS);
  assert.ok(HEAVY_HOLD_WINDOW_MS < HEAVY_HOLD_MS, 'shorter than the plain hold');
  assert.ok(windowMs - HEAVY_HOLD_WINDOW_MS >= 240, `a thumb has ${Math.round(windowMs - HEAVY_HOLD_WINDOW_MS)} ms to react to a block before the hold must start (the plain hold left ${Math.round(windowMs - HEAVY_HOLD_MS)})`);
  const src = readFileSync(new URL('../src/fight/input.ts', import.meta.url), 'utf8');
  assert.match(src, /counterWindow > 0 \|\| f\.punish > 0/, 'the window is the hero\'s own counter or punish window');
});

// The riposte under layout A, in the real sim: a block opens the guard-counter window (RULES.guardCounter ticks); a thumb that reacts after REACTION ticks then holds STRIKE for the heavy hold before the
// 'heavy' action reaches the duel (input.ts fireHeavy). The duel makes it a heavy_counter only while the window is still open when the heavy starts.
test('the heavy riposte lands under layout A with the window hold, and did not with the plain hold (a 10-tick reaction to a block)', () => {
  const REACTION = 10, ticksOf = (ms: number) => Math.ceil((ms * 60) / 1000);
  const heavyAfter = (holdMs: number): string | null => {
    let d: Duel = initialDuel();
    d = { ...d, fighters: [{ ...d.fighters[0], phase: 'ready', counterWindow: RULES.guardCounter }, d.fighters[1]] };
    const wait = REACTION + ticksOf(holdMs);
    for (let t = 0; t < wait; t++) d = stepDuel(d, [idleIntent(), idleIntent()]);
    d = stepDuel(d, [{ ...idleIntent(), action: 'heavy' }, idleIntent()]);
    return d.fighters[0].move;
  };
  assert.equal(heavyAfter(HEAVY_HOLD_WINDOW_MS), 'heavy_counter', `an ${HEAVY_HOLD_WINDOW_MS} ms hold after a 10-tick reaction starts the heavy inside the ${RULES.guardCounter}-tick window`);
  assert.equal(heavyAfter(HEAVY_HOLD_MS), 'heavy_overhead', `a ${HEAVY_HOLD_MS} ms hold ran past the window: the plain heavy, no riposte (the finding this fixes)`);
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
  assert.match(src, /\(ONE_BUTTON \? heavyHoldMs\(counterOpen\(\)\) : SLASH_DECIDE_MS\)/, 'the decide wait is the old one when off');
  assert.match(src, /if \(ONE_BUTTON && typeof document !== 'undefined'\) applyTouchLayout/, 'the layout is applied only while the strike is one-button');
});

test('touch layout A, default variant: the sandbox\'s placement (px from the right and bottom edge) and labels', () => {
  const css = touchLayoutCss('');
  const at = (id: string) => css.match(new RegExp(`\\.actions #${id}\\{right:(-?\\d+(?:\\.\\d+)?)px!important;bottom:(-?\\d+(?:\\.\\d+)?)px!important;width:(\\d+)px!important`))!.slice(1).map(Number);
  assert.deepEqual(at('attack-button'), [68, 92, 72], 'STRIKE at the thumb\'s rest point, 72 px');
  assert.deepEqual(at('skill-button'), [150, 174, 50], 'special 1 upper-left');
  assert.deepEqual(at('skill2-button'), [8, 174, 50], 'special 2 upper-right (RV80: the sandbox\'s second special button, the game\'s own #skill2-button)');
  assert.deepEqual(at('guard-button'), [150, 32, 50], 'guard lower-left');
  assert.deepEqual(at('dodge-button'), [8, 32, 50], 'roll lower-right');
  assert.deepEqual(at('kick-button'), [180, 106, 44], 'kick far left, a touch smaller than the rest but at the 44 px touch-target minimum (CS36b; was 42)');
  for (const label of ['STRIKE', 'SPECIAL 1', 'SPECIAL 2', 'GUARD', 'ROLL', 'KICK']) assert.match(css, new RegExp(`::after\\{content:"${label}"`));
});

test('?lay=1 and ?lay=3 grow STRIKE and its zone ring apart; anything else is the default', () => {
  const strike = (s: string) => Number(touchLayoutCss(s).match(/\.actions #attack-button\{right:[^}]*?width:(\d+)px/)![1]);
  assert.deepEqual([strike('?lay=1'), strike('?lay=3'), strike('?lay=9'), strike('')], [80, 64, 72, 72]);
});

test('the zone-ring labels and their places are rows, not literals in touch-layout.ts', async () => {
  const { default: defs } = await import('../src/fight/touch-layout-defs.json', { with: { type: 'json' } });
  assert.deepEqual(defs.zones.map((z) => z.label), ['stab', 'sl', 'sh']);
  assert.ok(defs.zones.every((z) => z.place.length > 0));
});

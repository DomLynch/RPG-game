import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bandOf, FRESH } from '../src/fatigue.ts';
import { LOW_OFF, LOW_STAMINA, fatiguePreviewFrom, forcedFatigue, previewPractice, staminaLow } from '../src/fatigue-preview.ts';

test('?look=fatigue-preview parses; absent = today, and the force needs the flag', () => {
  assert.equal(fatiguePreviewFrom(''), null); assert.equal(fatiguePreviewFrom('?stamina=8'), null, 'the force alone does nothing');
  assert.deepEqual(fatiguePreviewFrom('?look=fatigue-preview'), { force: null }); assert.deepEqual(fatiguePreviewFrom('?look=souls,fatigue-preview&stamina=8'), { force: 8 });
  for (const bad of ['0', '101', 'x', '']) assert.deepEqual(fatiguePreviewFrom(`?look=fatigue-preview&stamina=${bad}`), { force: null }, `stamina=${bad} is ignored`);
});

test('the bar turns on in the last 10 % only', () => {
  assert.equal(LOW_STAMINA, 10); assert.equal(staminaLow(50), false); assert.equal(staminaLow(10.01), false); assert.equal(staminaLow(10), true); assert.equal(staminaLow(5), true); assert.equal(staminaLow(0), true);
});

test('hysteresis: on at <= 10, off only at >= 12, so regen around the edge cannot flicker the bar', () => {
  assert.equal(LOW_OFF, 12);
  assert.equal(staminaLow(10.67), false, 'a cold 10.67 is not low'); assert.equal(staminaLow(10), true);
  assert.equal(staminaLow(10.67, true), true, 'once on, 10.67 stays on'); assert.equal(staminaLow(11.99, true), true); assert.equal(staminaLow(12, true), false, 'off at 12');
  let on = false; const seen: boolean[] = []; for (const v of [12, 11, 10, 10.67, 10, 10.67, 11.5, 12.1, 11, 9.9]) { on = staminaLow(v, on); seen.push(on); }
  assert.deepEqual(seen, [false, false, true, true, true, true, true, false, false, true], 'the forced-10 case (10 / 10.67 alternating) turns on once and stays');
});

test('the wiring: the HUD flags only under the preview, the force is a recorder-less dummy spar only, and the bar is red + pulsing in CSS', () => {
  const hud = readFileSync(new URL('../src/fight/hud.ts', import.meta.url), 'utf8'), main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(hud, /const lowNext = !!view\.fatiguePreview && staminaLow\(staminaNow, staminaLowOn\)/, 'no flag, no low state'); assert.match(hud, /const staminaNow = view\.staminaShown \?\? practice\.stamina/); assert.match(hud, /\$\{Math\.floor\(staminaNow\)\}\$\{lowNext \? 'L' : ''\}/, 'the HUD skip key carries the low state'); assert.match(hud, /stamina\.dataset\.low = String\(staminaLowOn\)/);
  assert.match(main, /FATIGUE_PREVIEW\?\.force != null && match\.dummy && match\.practiceOnly && !match\.recorder \? FATIGUE_PREVIEW\.force : undefined/, 'never a career, recorded or PvP fight'); assert.match(main, /staminaShown: fatigueForce\(\)/, 'the HUD bar reads the force, accepts() the real stamina'); assert.doesNotMatch(main, /fighters\[0\]\.stamina = FATIGUE_PREVIEW/, 'the sim\'s stamina is never written (v2: Dom could not press anything at 8)'); assert.equal(main.split('fatigueShown(').length - 1, 2, 'the scene and the feedback read the display copy');
  assert.match(css, /#stamina\[data-low=true\] \{[^}]*outline: 2px solid #e0463a[^}]*animation: stamina-low 1\.2s/, 'the whole bar frame glows red, not only the fill'); assert.match(css, /#stamina-label\[data-low=true\] \{ color: #ff5a48/, 'the STAMINA word goes red'); assert.match(hud, /element\('stamina-label'\)\.dataset\.low = String\(staminaLowOn\)/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ #stamina\[data-low=true\], #stamina-label\[data-low=true\] \{ animation: none/);
});

test('the forced display: the bar reads N, the player\'s fatigue level is 1 - N/100 (.92 at 8), the foe and everything else stay real', () => {
  const real = { stamina: 80, fatigue: [FRESH, { ...FRESH, level: .3 }] as [typeof FRESH, typeof FRESH], other: 'kept' };
  const shown = previewPractice(real, 8);
  assert.equal(shown.stamina, 8); assert.ok(Math.abs(shown.fatigue[0].level - 0.92) < 1e-9); assert.equal(shown.fatigue[0].band, bandOf(0.92, 0)); assert.equal(shown.fatigue[0].band, 2, 'tired');
  assert.equal(shown.fatigue[1].level, .3, 'the foe is untouched'); assert.equal(shown.other, 'kept'); assert.equal(real.stamina, 80, 'the real state is not mutated'); assert.equal(forcedFatigue(FRESH, 100).level, 0);
});

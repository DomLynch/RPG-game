import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOW_STAMINA, fatiguePreviewFrom, staminaLow } from '../src/fatigue-preview.ts';

test('?look=fatigue-preview parses; absent = today, and the force needs the flag', () => {
  assert.equal(fatiguePreviewFrom(''), null); assert.equal(fatiguePreviewFrom('?stamina=8'), null, 'the force alone does nothing');
  assert.deepEqual(fatiguePreviewFrom('?look=fatigue-preview'), { force: null }); assert.deepEqual(fatiguePreviewFrom('?look=souls,fatigue-preview&stamina=8'), { force: 8 });
  for (const bad of ['0', '101', 'x', '']) assert.deepEqual(fatiguePreviewFrom(`?look=fatigue-preview&stamina=${bad}`), { force: null }, `stamina=${bad} is ignored`);
});

test('the bar turns on in the last 10 % only', () => {
  assert.equal(LOW_STAMINA, 10); assert.equal(staminaLow(50), false); assert.equal(staminaLow(10.01), false); assert.equal(staminaLow(10), true); assert.equal(staminaLow(5), true); assert.equal(staminaLow(0), true);
});

test('the wiring: the HUD flags only under the preview, the force is a recorder-less dummy spar only, and the bar is red + pulsing in CSS', () => {
  const hud = readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8'), main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(hud, /stamina\.dataset\.low = String\(!!view\.fatiguePreview && staminaLow\(practice\.stamina\)\)/, 'no flag, no low state');
  assert.match(main, /FATIGUE_PREVIEW\?\.force != null && match\.dummy && match\.practiceOnly && !match\.recorder/, 'never a career, recorded or PvP fight');
  assert.match(css, /#stamina\[data-low=true\] \{ --bar-color: #d4483b; animation: stamina-low 1\.4s/); assert.match(css, /@keyframes stamina-low \{ 50% \{ opacity: \.6; \} \}/, 'gentle: never below 60 %');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ #stamina\[data-low=true\] \{ animation: none/);
});

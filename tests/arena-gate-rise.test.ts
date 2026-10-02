import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RISE_M, RISE_MS, riseMetres, riseStep } from '../src/gate-rise.ts';

// Dom 2026-10-01: he walks up to the arena gate and the portcullis stays shut. The bars rise as he reaches the line, on every open path.
test('the bars lift RISE_M over RISE_MS, settle softly, and fall back faster', () => {
  let t = 0;
  for (let ms = 0; ms < RISE_MS; ms += 50) t = riseStep(t, true, 0.05);
  assert.equal(t, 1); assert.equal(riseMetres(1), RISE_M); assert.equal(riseMetres(0), 0);
  assert.ok(riseMetres(0.1) < RISE_M * 0.1, 'eased: the first tenth lifts less than a tenth');
  assert.ok(RISE_M >= 2.2 && RISE_M <= 2.4 && RISE_MS >= 1000 && RISE_MS <= 1500, 'about 2.3 m over about 1-1.5 s');
  assert.equal(riseStep(1, false, RISE_MS / 4000), 0, 'down in a quarter of the time');
});

test('openGate raises the bars on foot and the fade waits for them; the next fight lowers them', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const open = main.slice(main.indexOf('function openGate('), main.indexOf("pitButton.addEventListener('click'"));
  assert.match(open, /raiseGate\(true\)/, 'the bars rise on the open');
  assert.match(open, /Promise\.all\(\[loadPit\(\), barsUp\]\)\.then\(fade\)/, 'the fade starts only once the bars are up (and the chunk has landed)');
  assert.match(open, /RISE_MS/);
  assert.match(open, /feedback\.gate\(\)/, 'the winch plays with the bars');
  const began = main.slice(main.indexOf('function began()'), main.indexOf('function began()') + 900);
  assert.match(began, /view\.walkToGate\(false\); view\.raiseGate\(false\)/, 'the next fight or rematch lowers the bars');
  assert.match(main, /view\.walkToGate\(true\); feedback\.warmGate\(\);/, 'the winch is fetched when the walk starts, so the first on-foot open is not silent (Auditer F1)');
});

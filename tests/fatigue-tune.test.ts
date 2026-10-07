import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breathe, fatigueLayer } from '../src/fatigue-layer.ts';
import { FOE_TUNE, GUARD_DROP } from '../src/fatigue-tune.ts';

const tired = { level: .95, gassed: 0, second: 0 };   // inside the last tenth, where the body shows (Dom 2026-10-07)

test('the Goblin breathes faster and shallower than the Executioner', () => {
  assert.ok(breathe(tired, FOE_TUNE.goblin) > breathe(tired, FOE_TUNE.executioner));
  const peak = (t = FOE_TUNE.goblin) => fatigueLayer(tired, Math.PI / 2, 1, t).chest;
  assert.ok(peak(FOE_TUNE.goblin) < peak(FOE_TUNE.executioner));
});

test('the guard drop is a few cm: a small share of the raise', () => {
  assert.ok(GUARD_DROP > 0 && GUARD_DROP <= .3);
});

test('the body stays upright until the last tenth of stamina, unless exhausted (Dom 2026-10-07)', () => {
  const at = (level: number, gassed = 0) => fatigueLayer({ level, gassed, second: 0 }, Math.PI / 2, 1);
  for (const level of [0, .25, .5, .75, .89]) { const l = at(level); assert.ok(l.hunch === 0 && l.chest === 0 && l.arm === 0, `level ${level}`); }
  assert.ok(at(.95).hunch > 0 && at(.95).arm > 0 && at(1).arm > at(.95).arm);
  assert.ok(at(.3, 1).arm > 0);
});

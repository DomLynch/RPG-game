import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breathe, fatigueLayer } from '../src/fatigue-layer.ts';
import { FOE_TUNE, GUARD_DROP } from '../src/fatigue-tune.ts';

const tired = { level: .8, gassed: 0, second: 0 };

test('the Goblin breathes faster and shallower than the Executioner', () => {
  assert.ok(breathe(tired, FOE_TUNE.goblin) > breathe(tired, FOE_TUNE.executioner));
  const peak = (t = FOE_TUNE.goblin) => fatigueLayer(tired, Math.PI / 2, 1, t).chest;
  assert.ok(peak(FOE_TUNE.goblin) < peak(FOE_TUNE.executioner));
});

test('the guard drop is a few cm: a small share of the raise', () => {
  assert.ok(GUARD_DROP > 0 && GUARD_DROP <= .3);
});

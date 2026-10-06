import { describe, expect, it } from 'vitest';
import { breathe, fatigueLayer } from '../src/fatigue.ts';
import { FOE_TUNE, GUARD_DROP } from '../src/fatigue-tune.ts';

const tired = { level: .8, gassed: 0, second: 0 };
describe('per-body fatigue tuning', () => {
  it('the Goblin breathes faster and shallower than the Executioner', () => {
    expect(breathe(tired, FOE_TUNE.goblin)).toBeGreaterThan(breathe(tired, FOE_TUNE.executioner));
    const peak = (t = FOE_TUNE.goblin) => fatigueLayer(tired, Math.PI / 2, 1, t).chest;
    expect(peak(FOE_TUNE.goblin)).toBeLessThan(peak(FOE_TUNE.executioner));
  });
  it('the guard drop is a few cm: a small share of the raise', () => { expect(GUARD_DROP).toBeGreaterThan(0); expect(GUARD_DROP).toBeLessThanOrEqual(.25); });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NO_OPEN, openPose, openWeight } from '../src/opening-pose.ts';

describe('open stagger pose', () => {
  it('is nothing without an opening, and nothing once its ticks are spent', () => {
    assert.equal(openWeight(null), 0);
    assert.equal(openWeight({ left: 0, of: 90 }), 0);
    assert.equal(openPose(0), NO_OPEN);
  });
  it('falls off balance fast, holds through the middle, and has eased out before the opening ends', () => {
    const w = (left: number) => openWeight({ left, of: 90 });
    assert.ok(w(90) < .01 && w(80) > .5 && w(45) > .99);   // first tick not yet, 10 ticks in already well open, midway fully
    assert.ok(w(3) < w(9) && w(9) < w(18) && w(18) <= w(45));   // recovers monotonically through the last fifth
    assert.ok(w(1) < .1);                                   // never held past the sim's opening
  });
  it('drops the guard hard and leans, a posture break more off balance than a parry', () => {
    const p = openPose(1, 'parry'), q = openPose(1, 'posture');
    assert.ok(p.guard < .2 && p.lean > 0 && p.arm > 0);
    assert.ok(q.tilt > p.tilt);
  });
});

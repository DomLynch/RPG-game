import test from 'node:test';
import assert from 'node:assert/strict';
import { CC_LADDER, ccApply, ccLevel, emptyLadder, familyOf, type CcSource } from '../src/fight/cc-ladder.ts';

test('cc ladder: full, half, quarter, immune, from any source of the family', () => {
  let l = emptyLadder; const got: number[] = [];
  for (const [src, t] of [['postureBreak', 0], ['parryStun', 10], ['gambitFail', 20], ['exhaustedHeavy', 30]] as [CcSource, number][]) { const r = ccApply(l, src, t, 80); got.push(r.ticks); l = r.ladder; }
  assert.deepEqual(got, [80, 40, 20, 0]);
});

test('cc ladder: families are independent', () => {
  const a = ccApply(emptyLadder, 'postureBreak', 0, 80), b = ccApply(a.ladder, 'wallSlam', 1, 80), c = ccApply(b.ladder, 'legWound', 2, 80);
  assert.deepEqual([a.ticks, b.ticks, c.ticks], [80, 80, 80]);
  assert.equal(ccLevel(c.ladder, 'stun', 3), 1);
});

test('cc ladder: the window resets it, measured from the LAST landing; an immune landing does not refresh it', () => {
  let l = emptyLadder; for (let i = 0; i < 3; i++) l = ccApply(l, 'postureBreak', i, 80).ladder;
  assert.equal(ccLevel(l, 'stun', 3), 3);   // immune now
  const spam = ccApply(l, 'postureBreak', 800, 80); assert.equal(spam.ticks, 0); assert.equal(spam.ladder, l);   // refused, window not extended
  assert.equal(ccApply(l, 'postureBreak', 2 + CC_LADDER.window + 1, 80).ticks, 80);   // the window since landing 3 has passed
  assert.equal(ccApply(l, 'postureBreak', 2 + CC_LADDER.window, 80).ticks, 0);   // exactly on the window: still diminished
});

test('cc ladder: every source is in exactly one family, and ordinary stagger is in none', () => {
  const all = Object.values(CC_LADDER.families).flat();
  assert.equal(new Set(all).size, all.length);
  for (const s of all) assert.ok(familyOf(s));
  assert.throws(() => familyOf('stagger' as CcSource));
});

test('cc ladder: 3 attackers on one hero share one ladder; the hero on a boss has its own', () => {
  let hero = emptyLadder; const durations: number[] = [];
  for (const [src, t] of [['postureBreak', 0], ['postureBreak', 5], ['parryStun', 9]] as [CcSource, number][]) { const r = ccApply(hero, src, t, 60); durations.push(r.ticks); hero = r.ladder; }
  assert.deepEqual(durations, [60, 30, 15]);   // three different attackers, one victim ladder
  const boss = ccApply(emptyLadder, 'postureBreak', 12, 60); assert.equal(boss.ticks, 60);   // the boss's ladder is untouched by the hero's
  assert.equal(ccApply(boss.ladder, 'postureBreak', 20, 60).ticks, 30);
});

test('cc ladder: rows are data (a custom row changes the steps and the window)', () => {
  const rows = { ...CC_LADDER, window: 10, steps: [100, 0] };
  const a = ccApply(emptyLadder, 'wallSlam', 0, 50, rows); assert.equal(ccApply(a.ladder, 'wallSlam', 5, 50, rows).ticks, 0); assert.equal(ccApply(a.ladder, 'wallSlam', 11, 50, rows).ticks, 50);
});

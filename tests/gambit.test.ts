import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, withGambit, type Duel } from '../src/duel.ts';
import { GAMBIT_KILL_FLOOR, GAMBIT_ODDS, gambitMean, gambitUnit, resolveGambit } from '../src/gambit.ts';
import * as luck from '../origins/luck/luck.ts';
import { RULES } from '../src/moves.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { act, arena, guard, idle, W } from './strategies.ts';

// The Gambit (RV33, docs/specs/origins/combat-study.md): a second heavy press after the chamber arms the swing; an open body draws once (about 1 in 2 lands for 2x), else the thrower staggers.
// Defined once in src/gambit.ts; origins/luck re-exports it, so this is an identity test.
test('origins/luck and the duel share the one Gambit definition', () => {
  assert.equal(luck.resolveGambit, resolveGambit); assert.equal(luck.GAMBIT_ODDS, GAMBIT_ODDS); assert.equal(luck.GAMBIT_KILL_FLOOR, GAMBIT_KILL_FLOOR); assert.equal(luck.gambitMean, gambitMean);
});

// Press heavy at tick 0, press it again at tick `second` (age `second`), then stand still; the warden stands (or guards) throughout.
const run = (seed: number | null, second: number | null, guarded = false, ticks = 90): Duel => {
  let d = arena(); if (seed !== null) d = withGambit(d, seed);
  for (let i = 0; i < ticks; i++) d = stepDuel(d, [i === 0 || i === second ? act('heavy') : idle(), guarded ? guard(d) : idle()]);
  return d;
};
const trace = (seed: number | null, second: number | null, guarded = false) => {
  let d = arena(); if (seed !== null) d = withGambit(d, seed); const ev: Duel['events'] = [];
  for (let i = 0; i < 90; i++) { d = stepDuel(d, [i === 0 || i === second ? act('heavy') : idle(), guarded ? guard(d) : idle()]); ev.push(...d.events); }
  return { d, ev };
};

test('no flag: a second heavy press changes nothing and the duel grows no gambit field (the Pit, PvP and the ladder today)', () => {
  const a = run(null, 14), b = run(null, null);
  assert.ok(!('gambit' in a) && a.fighters.every(f => !('gambit' in f) && !('gambitOn' in f)));
  assert.equal(hashDuel(a), hashDuel(b));
});

test('flag on, no second press: the fight is the plain one, field for field apart from the stream', () => {
  const on = trace(5, null).d, off = trace(null, null).d, bare = ({ gambitOn: _, ...f }: Duel['fighters'][0]) => f;
  assert.deepEqual([bare(on.fighters[0]), bare(on.fighters[1])], [bare(off.fighters[0]), bare(off.fighters[1])]);
  assert.deepEqual(on.gambit, { seed: 5, draws: 0 });
});

test('the arm window opens only at the chamber: a press in the first ticks of the swing does not arm', () => {
  const { ev } = trace(1, 4);
  assert.equal(ev.filter(e => e.type === 'GambitArmed').length, 0);
});

test('an armed heavy that meets an open body draws exactly once and either lands for the odds\' multiple or staggers the thrower', () => {
  let landed = 0, failed = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const plain = trace(null, null), { d, ev } = trace(seed, 14);
    assert.equal(ev.filter(e => e.type === 'GambitArmed').length, 1);
    assert.equal(d.gambit!.draws, 1, 'one draw per armed blow that connects');
    const heavy = plain.ev.find(e => e.type === 'Hit')!;
    const hit = ev.find(e => e.type === 'Hit' && e.gambit), fail = ev.find(e => e.type === 'GambitFailed');
    assert.ok(!!hit !== !!fail, 'exactly one outcome');
    if (hit) { landed++; assert.equal(hit.damage, Math.min(Math.round(heavy.damage! * GAMBIT_ODDS.multiplier), W(d).maxHealth - 1)); assert.ok(W(d).health < W(plain.d).maxHealth); }
    else { failed++; assert.equal(W(d).health, W(d).maxHealth, 'nobody is hurt'); assert.ok(ev.some(e => e.type === 'Staggered' && e.actor === 0 && e.ticks === RULES.gambit.stagger), 'the thrower staggers'); }
  }
  assert.ok(landed > 15 && failed > 15, `both outcomes occur at about 1 in 2 (landed ${landed}, failed ${failed})`);
});

test('a guard settles an armed heavy as the plain heavy: no draw is taken', () => {
  const { d, ev } = trace(3, 14, true);
  assert.equal(d.gambit!.draws, 0); assert.equal(ev.filter(e => e.type === 'GambitFailed').length, 0);
});

test('C1: mean landed damage never beats the plain heavy, and a landed Gambit never kills from above the floor', () => {
  assert.ok(gambitMean(18) <= 18);
  assert.equal(resolveGambit(18, 0, 100, 100).damage, 36);
  assert.equal(resolveGambit(60, 0, 41, 100).damage, 40, 'above 40% health it leaves at least 1');
  assert.equal(resolveGambit(60, 0, 40, 100).damage, 120, 'at or under the floor the full blow may kill');
  assert.equal(resolveGambit(18, 0.5, 100, 100).landed, false);
  let lands = 0; for (let i = 0; i < 4000; i++) if (gambitUnit(9, i) < GAMBIT_ODDS.chance) lands++;
  assert.ok(Math.abs(lands / 4000 - 0.5) < 0.03, `the draw is uniform (${lands / 4000})`);
});

test('the draw is a pure function of (seed, draw number): a replay reproduces it', () => {
  assert.equal(hashDuel(run(77, 14)), hashDuel(run(77, 14)));
});

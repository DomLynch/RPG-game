// The tutorial start scene's slow foe (src/tutorial.ts, Match mode 'tutorial'): every step fires once, in order, when the player does it;
// the foe waits with no timeout, never ends the fight, records and awards nothing, and no normal fight is affected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_STEPS, type TutorialStep } from '../src/tutorial.ts';
import { Match } from '../src/match.ts';
import { OPPONENTS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { STRATEGIES, W, P, act, idle, ready, gap, swingStart, guard } from './strategies.ts';
import type { Duel, Intent } from '../src/duel.ts';

const counting = () => { const m = new Map<string, string>(); let writes = 0; return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { writes++; m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, writes: () => writes }; };
// A player who does exactly the step the foe is waiting on (and nothing else); null = a player who never does anything.
const doer = (step: () => TutorialStep | null) => (d: Duel): Intent => {
  const s = step();
  if (s === 'slash') return ready(d) && gap(d) <= 1.7 ? act('light') : idle();
  if (s === 'stab') return ready(d) && gap(d) <= 1.95 ? act('thrust') : idle();
  if (s === 'heavy') return ready(d) && gap(d) <= 1.8 ? act('heavy') : idle();
  if (s === 'guard') return guard(d);
  if (s === 'parry') return STRATEGIES['perfect parry']!(d);
  if (s === 'kick') return ready(d) && gap(d) <= 1.5 ? act('kick') : idle();
  if (s === 'roll') return swingStart(d) && ready(d) ? act('dodge') : idle();
  return idle();
};
function boot(seed: number) {
  const storage = counting(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
  const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed), writes = storage.writes();
  const beats: { id: TutorialStep; tick: number }[] = [];
  match.startTutorial((id) => beats.push({ id, tick: match.practice.duel.tick }));
  return { match, beats, writes: () => storage.writes() - writes };
}
const tick = (match: Match, who: (d: Duel) => Intent) => match.step(() => (P(match.practice.duel).phase === 'sheathed' ? act('light') : who(match.practice.duel)));

test('a player who does each step in turn completes all seven, once, in order, on every seed, and the fight never ends', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { match, beats, writes } = boot(seed * 2654435761 >>> 0);
    assert.equal(match.mode, 'tutorial'); assert.equal(match.recorder, null);
    const who = doer(() => match.tutorial!.current);
    let result = 'stepped', ticks = 0;
    for (; ticks < 20000 && result === 'stepped' && beats.length < TUTORIAL_STEPS.length; ticks++) result = tick(match, who);
    for (let i = 0; i < 600; i++) result = tick(match, who);   // after the last step the foe only stands
    assert.deepEqual(beats.map((b) => b.id), [...TUTORIAL_STEPS], `seed ${seed}: the seven steps, once each, in order (${ticks} ticks)`);
    assert.equal(result, 'stepped', `seed ${seed}: the fight does not end`);
    assert.ok(!match.practice.finish, `seed ${seed}`); assert.equal(match.tutorial!.current, null);
    assert.equal(writes(), 0, `seed ${seed}: nothing written`);
  }
});

test('the foe waits with no timeout: a player who does nothing sees no step done and is never beaten', () => {
  for (const seed of [1, 2, 3]) {
    const { match, beats } = boot(seed);
    let result = 'stepped';
    for (let i = 0; i < 12000 && result === 'stepped'; i++) result = tick(match, () => idle());
    assert.equal(beats.length, 0); assert.equal(result, 'stepped'); assert.equal(match.tutorial!.current, 'slash');
  }
});

test('the foe never kills the player nor falls, whatever the player does', () => {
  for (const name of ['light spam', 'heavy only', 'perfect parry', 'turtle and punish', 'roll and punish']) {
    const { match } = boot(5);
    let result = 'stepped';
    for (let i = 0; i < 6000 && result === 'stepped'; i++) { result = tick(match, STRATEGIES[name]!); assert.ok(P(match.practice.duel).health > 0 && W(match.practice.duel).health > 0, `${name}: both stand`); }
    assert.equal(result, 'stepped', name);
  }
});

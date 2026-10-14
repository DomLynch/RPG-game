// The tutorial foe's stepped duel, fingerprinted: a player who does each step, and three other kinds of player, on twelve seeds; the whole duel state, the beats and the tick count hashed into one digest.
// Written BEFORE the tutorial numbers (GAP, ROLL_SPAN, SETTLE, REACH, FLOOR) moved into rows (src/tutorial-rules.json), so a change that moves any of them fails here.
// TUTORIAL_PRINT=1 prints the digest instead of asserting it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { TUTORIAL_STEPS, type TutorialStep } from '../src/tutorial.ts';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { STRATEGIES, P, act, idle, ready, gap, swingStart, guard } from './strategies.ts';
import type { Duel, Intent } from '../src/fight/duel.ts';

const GOLDEN = 'TBD';
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
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

function run(seed: number, who: 'doer' | 'idle' | 'light spam' | 'perfect parry') {
  const storage = memory(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
  const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed);
  const beats: { id: TutorialStep; tick: number }[] = [];
  match.startTutorial((id) => beats.push({ id, tick: match.practice.duel.tick }));
  const player = who === 'doer' ? doer(() => match.tutorial!.current) : who === 'idle' ? () => idle() : STRATEGIES[who]!;
  const tick = () => match.step(() => (P(match.practice.duel).phase === 'sheathed' ? act('light') : player(match.practice.duel)));
  let result = 'stepped', ticks = 0;
  const limit = who === 'doer' ? 20000 : 3000;
  for (; ticks < limit && result === 'stepped' && (who !== 'doer' || beats.length < TUTORIAL_STEPS.length); ticks++) result = tick();
  if (who === 'doer') for (let i = 0; i < 600; i++) result = tick();
  return { who, seed, result, ticks, beats, duel: match.practice.duel };
}

test('the tutorial foe plays out exactly as it did before its numbers became rows', () => {
  const hash = createHash('sha256');
  for (const who of ['doer', 'idle', 'light spam', 'perfect parry'] as const) for (let seed = 1; seed <= 12; seed++) hash.update(JSON.stringify(run(seed * 2654435761 >>> 0, who)));
  const digest = hash.digest('hex');
  if (process.env.TUTORIAL_PRINT) console.log(`TUTORIAL_DIGEST ${digest}`);
  else assert.equal(digest, GOLDEN);
});

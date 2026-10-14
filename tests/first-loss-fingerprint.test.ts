// The scripted first loss's stepped duel, fingerprinted: six players x twelve seeds, the whole final duel state, the beats and the tick count hashed into one digest.
// Written BEFORE the first-loss numbers (GAP, REACH, FLOOR, TIMEOUT, FINALE_LIMIT) moved into rows (src/first-loss-rules.json), so a change that moves any of them,
// or the order the lessons fire in, fails here. FIRST_LOSS_PRINT=1 prints the digest instead of asserting it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { Match } from '../src/fight/match.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { loadProfile } from '../src/core/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { STRATEGIES, act, idle } from './strategies.ts';
import type { Duel, Intent } from '../src/fight/duel.ts';
import type { LessonId } from '../src/first-loss.ts';

const GOLDEN = 'TBD';
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
const PLAYERS: Record<string, (d: Duel) => Intent> = {
  idle: () => idle(),
  'light spam': STRATEGIES['light spam']!, 'heavy only': STRATEGIES['heavy only']!, 'perfect parry': STRATEGIES['perfect parry']!,
  'roll and punish': STRATEGIES['roll and punish']!, 'turtle and punish': STRATEGIES['turtle and punish']!,
};

function run(seed: number, name: string) {
  const storage = memory(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
  const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed);
  const beats: { id: LessonId; tick: number }[] = [];
  match.startLesson((id) => beats.push({ id, tick: match.practice.duel.tick }));
  let result = 'stepped', ticks = 0;
  for (; ticks < 9000 && result === 'stepped'; ticks++) result = match.step(() => (match.practice.duel.fighters[0].phase === 'sheathed' ? act('light') : PLAYERS[name]!(match.practice.duel)));
  return { result, ticks, beats, duel: match.practice.duel };
}

test('the first loss plays out exactly as it did before its numbers became rows', () => {
  const hash = createHash('sha256');
  for (const name of Object.keys(PLAYERS)) for (let seed = 1; seed <= 12; seed++) hash.update(JSON.stringify(run(seed * 2654435761 >>> 0, name)));
  const digest = hash.digest('hex');
  if (process.env.FIRST_LOSS_PRINT) console.log(`FIRST_LOSS_DIGEST ${digest}`);
  else assert.equal(digest, GOLDEN);
});

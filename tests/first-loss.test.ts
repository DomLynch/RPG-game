// The scripted first loss (src/first-loss.ts, Match mode 'lesson'): the player loses on every seed and every kind of player, each of the five
// lessons fires exactly once and in order, the fight is not recorded or awarded, and nothing the ladder owns moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, type LessonId } from '../src/first-loss.ts';
import { Match, PRESET_LEVEL } from '../src/match.ts';
import { OPPONENTS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import { STRATEGIES, act, idle } from './strategies.ts';
import type { Duel, Intent } from '../src/duel.ts';

const counting = () => { const m = new Map<string, string>(); let writes = 0; return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { writes++; m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, writes: () => writes }; };
// The players: the bot catalogue (tests/strategies.ts) plus one that does nothing and one that fights back as hard as it can.
const PLAYERS: Record<string, (d: Duel) => Intent> = {
  idle: () => idle(),
  'light spam': STRATEGIES['light spam']!, 'heavy only': STRATEGIES['heavy only']!, 'perfect parry': STRATEGIES['perfect parry']!,
  'roll and punish': STRATEGIES['roll and punish']!, 'turtle and punish': STRATEGIES['turtle and punish']!,
};
function run(seed: number, name: string) {
  const storage = counting(), trial = loadTrial(storage), scorecard = loadScorecard(storage), profile = loadProfile(storage, () => 'device').profile;
  const match = new Match(OPPONENTS.veteran, 'dev', { storage, trial, scorecard, profile }, seed), writes = storage.writes();
  const beats: { id: LessonId; tick: number }[] = [];
  match.startLesson((id) => beats.push({ id, tick: match.practice.duel.tick }));
  assert.equal(match.mode, 'lesson'); assert.equal(match.recorder, null);
  let result = 'stepped', ticks = 0;
  for (; ticks < 9000 && result === 'stepped'; ticks++) result = match.step(() => (match.practice.duel.fighters[0].phase === 'sheathed' ? act('light') : PLAYERS[name]!(match.practice.duel)));
  const ended = result === 'ended' ? match.end(false) : null;
  return { match, beats, result, ticks, ended, writes: storage.writes() - writes };
}

test('the first loss is lost on every seed and every kind of player, and all five lessons fire once, in order', () => {
  for (const name of Object.keys(PLAYERS)) for (let seed = 1; seed <= 12; seed++) {
    const { match, beats, result, ended, writes } = run(seed * 2654435761 >>> 0, name), label = `${name} seed ${seed}`;
    assert.equal(result, 'ended', `${label}: the fight ends`);
    assert.equal(match.practice.finish?.victim, 0, `${label}: the player fell`);
    assert.ok(!match.practice.finish?.draw, label);
    assert.deepEqual(beats.map((b) => b.id), [...LESSONS], `${label}: the five lessons, once each, in order`);
    assert.ok(beats[4]!.tick <= match.practice.duel.tick, `${label}: the last lesson came before the end`);
    assert.deepEqual({ won: ended!.won, rewarded: ended!.rewarded, record: ended!.record, lines: ended!.lines }, { won: false, rewarded: false, record: null, lines: [] }, label);
    assert.equal(writes, 0, `${label}: nothing written`);
    assert.equal(match.level, PRESET_LEVEL.easy);
  }
});

test('the first loss is deterministic and a rematch plays it again with its lessons', () => {
  const a = run(7, 'perfect parry'), b = run(7, 'perfect parry');
  assert.deepEqual(a.beats, b.beats); assert.equal(a.ticks, b.ticks);
  a.match.rematch();
  assert.equal(a.match.mode, 'lesson');
  const again: LessonId[] = [];
  (a.match as unknown as { onLesson: (id: LessonId) => void }).onLesson = (id) => again.push(id);
  assert.ok(a.match.lesson && a.match.lesson.fired.length === 0, 'a fresh script');
});

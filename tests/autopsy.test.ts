import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi, readOpponent, type Habits, type Reads } from '../src/ai.ts';
import { autopsy, cause, habit } from '../src/autopsy.ts';
import { stepDuel, type CombatEvent, type Duel, type Intent } from '../src/duel.ts';
import { OPPONENTS, RULES, type AiProfile, type Opponent } from '../src/moves.ts';
import { STRATEGIES, act, arena, idle, ready, swingStart } from './strategies.ts';

type Fight = { h: Habits; reads: Reads; log: CombatEvent[]; duel: Duel; lines: string[] };
// One scripted fight, the way the battery runs it, keeping the whole event log (main.ts keeps the same log for the death screen).
function fight(strategy: (d: Duel) => Intent, seed: number, opponent: Opponent = OPPONENTS.veteran, level: 'normal' | 'hard' = 'normal', ticks = 7200): Fight {
  let d = arena(opponent), ai = initialAi((seed * 2654435761) >>> 0);
  const log: CombatEvent[] = [];
  for (let i = 0; i < ticks && !d.finish; i++) { const w = decide(d, 1, ai, opponent.profiles[level] as AiProfile); ai = w.ai; d = stepDuel(d, [strategy(d), w.intent]); log.push(...d.events); }
  const reads = readOpponent(ai.habits);
  return { h: ai.habits, reads, log, duel: d, lines: autopsy(ai.habits, reads, log, d) };
}
const fights = (strategy: (d: Duel) => Intent, seeds = 12) => Array.from({ length: seeds }, (_, i) => fight(strategy, i + 1));
const died = (f: Fight) => !!f.duel.finish && !f.duel.finish.draw && f.duel.finish.victim === 0;
// A backstepping punisher: no battery strategy steps out of swings, so the stepper read gets its own script here.
const stepAndPunish = (d: Duel): Intent => (swingStart(d) && ready(d) ? act('backstep') : ready(d) && d.fighters[1].phase === 'hurt' ? act('light') : idle());

test('autopsy: every read the warden makes has a habit line with its numbers, found from the scripted strategies that produce it [slow]', () => {
  const cases: [string, (d: Duel) => Intent, keyof Reads, RegExp][] = [
    ['light spam', STRATEGIES['light spam'], 'spammer', /^\d+ of your \d+ swings were cuts;/],
    ['turtle and punish', STRATEGIES['turtle and punish'], 'turtle', /^You held guard for \d+ % of the fight;/],
    ['perfect parry', STRATEGIES['perfect parry'], 'parryHappy', /^You pressed parry against \d+ of his \d+ swings;/],
    ['roll and punish', STRATEGIES['roll and punish'], 'roller', /^You rolled from \d+ of his \d+ swings;/],
    ['step and punish', stepAndPunish, 'stepper', /^You slipped back from \d+ of his \d+ swings\.$/],
    ['kick only', STRATEGIES['kick only'], 'kicker', /^You threw \d+ kicks and \d+ swings\.$/],
    ['thrust from range', STRATEGIES['thrust from range'], 'poker', /^\d+ of your \d+ swings were thrusts\.$/],
    ['held lights', STRATEGIES['held lights'], 'parker', /^\d+ of your \d+ swings sat at the chamber\.$/],
  ];
  for (const [name, strategy, read, line] of cases) {
    const all = fights(strategy), hits = all.filter(f => f.reads[read]);
    assert.ok(hits.length > 0, `${name}: the warden never read "${read}" in ${all.length} fights`);
    for (const f of hits) {
      const text = habit(f.h, f.reads);
      assert.ok(text !== null, `${name}: a read fight has a habit line`);
      // The habit line belongs to the read this strategy produces unless a louder read (earlier in the order) is also true, which is itself a fact about the fight.
      const louder = (Object.keys(f.reads) as (keyof Reads)[]).filter(r => f.reads[r] && r !== read);
      if (!louder.length) assert.match(text!, line, `${name}`);
      assert.ok(!/[!?]/.test(text!) && text!.split('. ').length <= 2, `${name}: plain, no exclamation, one sentence: ${text}`);
    }
  }
});

test('autopsy: the cause line names what the events say — a posture break, a guard break, exhaustion, or the blow and where it landed — and nothing on a win or a draw [slow]', () => {
  const seen = { posture: 0, guard: 0, exhausted: 0, plain: 0 };
  for (const strategy of Object.values(STRATEGIES)) for (const f of fights(strategy, 8)) {
    const line = cause(f.log, f.duel), lines = f.lines;
    assert.ok(lines.length <= 2, 'at most two lines');
    if (!died(f)) { assert.equal(line, null, 'no cause on a win, a draw or a stall'); continue; }
    assert.ok(line, 'every death has a cause');
    const kill = f.log.filter(e => e.type === 'Killed' && e.target === 0).pop()!, finish = f.duel.finish!;
    const within = (type: CombatEvent['type']) => f.log.some(e => e.type === type && e.target === 0 && e.tick <= kill.tick && kill.tick - e.tick <= RULES.posture.stun + 60);
    if (finish.move === 'critical' || within('PostureBroken')) { assert.match(line, /^Your posture broke/); seen.posture++; }
    else if (within('GuardBroken')) { assert.match(line, /^Your guard broke/); seen.guard++; }
    else if (f.duel.fighters[0].exhausted) { assert.match(line, /^You were out of stamina/); seen.exhausted++; }
    else { assert.match(line, /^The (cut|heavy|thrust|kick|riposte|counter|critical) landed on your (head|torso|legs)\.$/); seen.plain++; }
    assert.equal(lines[0], line, 'the cause is the first line');
  }
  for (const [k, n] of Object.entries(seen)) assert.ok(n > 0, `no scripted death produced the "${k}" cause: ${JSON.stringify(seen)}`);
});

test('autopsy: nothing confident, nothing said — a fresh duel with no reads and no finish gives an empty list (fast: the stop gate keeps this pin)', () => {
  const ai = initialAi(1), d = arena();
  assert.deepEqual(autopsy(ai.habits, readOpponent(ai.habits), [], d), []);
});

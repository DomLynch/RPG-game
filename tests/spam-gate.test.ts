// RV31 (docs/specs/combat/l6-anti-spam.md): `spamRun` reads a masher early; absent = the old read, byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpponent, initialAi, decide, type Habits } from '../src/ai.ts';
import { OPPONENTS } from '../src/combat.ts';
import { movesOf, type Duel } from '../src/duel.ts';
import { profileAt, type AiProfile } from '../src/moves.ts';
import { STRATEGIES, battery, arena, act, ready, gap, k } from './strategies.ts';

const habits = (over: Partial<Habits> = {}): Habits => ({ ...initialAi().habits, ...over });
const gate = (spamRun: number): AiProfile => ({ ...OPPONENTS.veteran.profiles.normal, spamRun });
const GATED = ['veteran', 'pitborn', 'dwarf', 'knight', 'shieldmaiden'] as const;

test('the early gate reads the run alone: spamRun consecutive lights reads a spammer, one fewer or a reset run does not', () => {
  assert.equal(readOpponent(habits({ lights: 5, attacks: 5, run: 5 }), gate(5)).spammer, true);
  assert.equal(readOpponent(habits({ lights: 4, attacks: 4, run: 4 }), gate(5)).spammer, false, 'one light short');
  assert.equal(readOpponent(habits({ lights: 5, heavies: 1, attacks: 6, run: 0 }), gate(5)).spammer, false, 'a heavy resets the run');
  assert.equal(readOpponent(habits({ lights: 9, attacks: 9, guard: 1, run: 5 }), gate(5)).spammer, true, 'a guard long ago does not blind the gate: only the run counts');
});

const stepped = (opp: Partial<Duel['fighters'][0]>, events: Duel['events'] = []) => {
  const d = arena(OPPONENTS.veteran); d.fighters[0] = { ...d.fighters[0], ...opp }; d.events = events;
  return decide(d, 1, { ...initialAi(), habits: habits({ lights: 4, attacks: 4, run: 4 }) }, gate(5)).ai.habits.run;
};
const ev = (type: string, actor: number, extra: object = {}) => ({ tick: 0, type, actor, target: 1 - actor, move: 'light_right', ...extra }) as unknown as Duel['events'][0];

test('guard once, then spam: a block, parry or roll-dodge that meets a blow resets the run (decide-driven)', () => {
  assert.equal(stepped({ phase: 'guard', age: 3 }, [ev('Blocked', 0)]), 0, 'a block ends the run');
  assert.equal(stepped({ phase: 'guard', age: 3, parrying: true }, [ev('Parried', 0)]), 0, 'a parry ends the run');
  assert.equal(stepped({ phase: 'roll', age: 5 }, [ev('Dodged', 0)]), 0, 'a roll-dodge ends the run');
  assert.equal(stepped({ phase: 'backstep', age: 5 }, [ev('AttackMissed', 1, { target: undefined })]), 0, 'a swing missing a backstep ends the run');
});

test('guard-tap: a bare guard, roll or backstep that meets no blow does not reset the run', () => {
  for (const phase of ['guard', 'roll', 'backstep'] as const) assert.equal(stepped({ phase, age: 3 }), 4, `${phase} tick with no event`);
  assert.equal(stepped({ phase: 'ready' }, [ev('AttackMissed', 1, { target: undefined })]), 4, 'a miss on a standing player is not an evade');
  assert.equal(stepped({ phase: 'guard', age: 3 }, [ev('Blocked', 1)]), 4, 'my own block event is not his');
});

test('a guard HELD through my windup ends the run with no contact; a tap of a few ticks does not (RV31, Strategy)', () => {
  const at = (hold: number) => {
    const d = arena(OPPONENTS.veteran), w = d.fighters[1], move = 'light_right' as const;
    d.fighters[0] = { ...d.fighters[0], phase: 'guard', age: hold };
    d.fighters[1] = { ...w, phase: 'attack', move, age: movesOf(w)[move].windup - 1 };   // decide() reads the post-step state: age = windup on this tick's view
    d.fighters[1] = { ...d.fighters[1], age: movesOf(w)[move].windup };
    return decide(d, 1, { ...initialAi(), habits: habits({ lights: 4, attacks: 4, run: 4, hold: hold - 1 }) }, gate(5)).ai.habits.run;
  };
  assert.equal(at(8), 0, 'a guard held 8 ticks into my windup ends the run');
  assert.equal(at(3), 4, 'a 3-tick tap does not');
});

test('absent spamRun is the old read: 11 swings at 70 % lights, whatever the run', () => {
  assert.equal(readOpponent(habits({ lights: 5, attacks: 5, run: 5 }), OPPONENTS.goblin.profiles.normal).spammer, false, 'five lights are not yet a spammer');
  assert.equal(readOpponent(habits({ lights: 5, attacks: 5, run: 5 })).spammer, false, 'no profile: the old read');
  const old = habits({ lights: 8, heavies: 3, attacks: 11, guard: 4, run: 2 });
  assert.equal(readOpponent(old, OPPONENTS.goblin.profiles.normal).spammer, true);
  assert.equal(readOpponent(old).spammer, true);
});

test('the early gate REPLACES the old read for every gated opponent, the Shieldmaiden included', () => {
  const defended = habits({ lights: 8, heavies: 3, attacks: 11, guard: 4, run: 2 });   // the old read fires, the gate does not (run 2 < 5)
  assert.equal(readOpponent(defended, gate(5)).spammer, false);
});

test('only the five measured opponents carry spamRun, at every tier and level; the rest read as they always did', () => {
  for (const id of GATED) for (const level of [1, 6, 12, 18, 30, 46, 50]) assert.equal(profileAt(OPPONENTS[id], level).spamRun, id === 'pitborn' ? 6 : 5, `${id} L${level}`);
  for (const id of Object.keys(OPPONENTS).filter(i => !(GATED as readonly string[]).includes(i))) for (const level of [1, 6, 18, 46])
    assert.equal(profileAt(OPPONENTS[id as keyof typeof OPPONENTS], level).spamRun, undefined, `${id} L${level}: absent = today's read`);
});

test('light spam at L6 stays under the 80 % cap against every gated opponent (24 seeds)', () => {
  for (const id of GATED) {
    const r = battery(6, 24, 7200, OPPONENTS[id], { 'light spam': STRATEGIES['light spam'] })['light spam'];
    assert.ok(r.wins / 24 <= .8, `${id}: light spam wins ${r.wins}/24 at L6 (cap 80 %)`);
  }
});

// RV31 (Strategy 2026-10-07): a masher who backsteps once every 4 lights to make the warden whiff must still read as one: the punishing light
// does not count toward the run, but the other four do, and the whiff itself does not reset it.
test('spam + one backstep every 4 lights to force our whiff stays under the 80 % cap at L6 against every gated opponent (120 seeds)', () => {
  let n = 0;
  const strategy = (d: Duel) => {
    if (d.tick === 0) n = 0;
    if (!ready(d) || gap(d) > 1.7 * k(d)) return STRATEGIES['light spam'](d);
    return ++n % 5 === 0 ? act('backstep') : act('light');
  };
  for (const id of GATED) {
    const r = battery(6, 120, 7200, OPPONENTS[id], { 'spam + backstep': strategy })['spam + backstep'];
    assert.ok(r.wins / 120 <= .8, `${id}: spam + a backstep every 4 lights wins ${r.wins}/120 at L6 (cap 96)`);
  }
});

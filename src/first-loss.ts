// The scripted first loss: a new player's first fight, staged so the five lessons land and the fight is lost on purpose.
//
// The idea is ported from `src/sim/tutorial/death_lesson.ts` in levy-street/world-of-claudecraft at commit f46f30f
// (https://github.com/levy-street/world-of-claudecraft), MIT licence, Copyright (c) 2026 Levy Street. That file stages a
// player's first death, scripted and consented to, so they learn it where nothing hunts them; the code here is this game's own
// and shares none of it. The licence notice follows, as the MIT licence requires of a derived work:
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
//   files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
//   modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
//   Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice
//   shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY
//   OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
//   PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
//   THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// What it is (Lead, Dom approved 2026-10-05): its own seeded encounter, outside the sim files (like stepSparring: decide(), the rules,
// the ladder, the level table and RECORD_VERSION are untouched). It writes no record and awards nothing. The foe's attacks are scripted,
// one episode per lesson, in the order the lessons are taught; each episode ends on the player's own cue (a parry, a block, a roll, a
// wound) or, failing that, on a timeout, so every beat fires on every seed whatever the player does. Until the last beat the player is
// kept above half health, and the foe is always kept above half: the lessons are not punishment. Then a finishing blow ends the player,
// forced if it has to be, and the fight is a loss. The prompts are the Web lane's: this file only says WHICH lesson, once, on the tick its cue happens.
import { decide } from './ai.ts';
import { project, type Practice } from './combat.ts';
import { distance, legal, stepDuel, timing, type Action, type CombatEvent, type Duel, type Intent } from './duel.ts';
import { RULES, type MoveId } from './moves.ts';
import { SPARRING_DUMMY, disarm } from './sparring.ts';

export const LESSONS = ['stayAfterParry', 'blockEarnsNothing', 'rollSideways', 'woundedStamina', 'tapStepHoldRoll'] as const;
export type LessonId = (typeof LESSONS)[number];

// Per lesson: the foe's attack, the ticks the prompt gets to be read after its beat fires, and what the player did to earn the beat.
const EPISODES: readonly { attack: Action | null; dwell: number; cue: (events: readonly CombatEvent[]) => boolean }[] = [
  { attack: 'heavy', dwell: 150, cue: (e) => e.some((x) => x.type === 'Parried' && x.actor === 0) },        // a parry: the foe is open, stay and hit
  { attack: 'light', dwell: 120, cue: (e) => e.some((x) => x.type === 'Blocked' && x.actor === 0) },        // a block: safe, and it earns nothing
  { attack: 'thrust', dwell: 150, cue: (e) => e.some((x) => x.type === 'Dodged' && x.actor === 0) },        // a roll through the thrust: roll sideways, re-enter
  { attack: 'light', dwell: 150, cue: () => false },                                                          // the wound: judged on the bar (below)
  { attack: null, dwell: 300, cue: () => true },                                                              // tap = step, hold = roll: said, then the finish
];
const TIMEOUT = 600;      // ticks an episode waits for its cue before the beat fires anyway (10 s)
const GAP = 90;           // ticks between the foe's swings
const REACH = 2.1;        // the foe swings only inside this
const FINALE_LIMIT = 240; // ticks the finishing blow is given to land by itself before it is forced
const FLOOR = 0.5;        // share of a bar the lessons keep both fighters above

export function createFirstLoss(onLesson: (id: LessonId) => void = () => {}) {
  const fired: LessonId[] = [];
  let episode = 0, started = -1, firedAt = -1, lastSwing = -GAP, finaleAt = -1, bar = 0;
  const fire = (tick: number) => { const id = LESSONS[episode]!; fired.push(id); firedAt = tick; onLesson(id); };
  return {
    get fired(): readonly LessonId[] { return fired; },
    step(current: Practice, intent: Intent): Practice {
      const before = current.duel, tick = before.tick, [p0, f0] = before.fighters;
      const live = !before.finish && p0.health > 0 && f0.health > 0;
      // The lessons are not punishment: the player stays above half health and the foe above half until the finishing blow.
      const keep = (f: typeof p0): typeof p0 => f.health < f.maxHealth * FLOOR ? { ...f, health: Math.ceil(f.maxHealth * FLOOR) } : f;
      const duel: Duel = live ? { ...before, fighters: [finaleAt >= 0 ? p0 : keep(p0), keep(f0)] } : before;   // the foe never falls; the player is spared until the finishing blow
      const dec = decide(duel, 1, current.ai, SPARRING_DUMMY), foe = duel.fighters[1], player = duel.fighters[0];
      if (live && started < 0 && player.phase === 'ready') { started = tick; bar = player.maxStamina; }   // the lesson starts when the sword is out
      let action: Action | null = null;
      const plan = finaleAt >= 0 ? 'thrust' : firedAt < 0 && started >= 0 ? EPISODES[episode]!.attack : null;
      if (live && plan && foe.phase === 'ready' && tick - lastSwing >= GAP && distance(foe.body, player.body) <= REACH && legal(foe, plan)) action = plan;
      let next = stepDuel(duel, [intent, { ...disarm(dec.intent), ...(action ? { action } : {}) }]);
      if (next.events.some((e) => e.type === 'AttackStarted' && e.actor === 1)) lastSwing = tick;
      if (live && next.fighters[0].health > 0 && started >= 0) {
        if (finaleAt < 0) {
          const e = EPISODES[episode]!;
          if (firedAt < 0) {
            const wounded = episode === 3 && next.fighters[0].maxStamina < bar, timedOut = tick - started >= TIMEOUT;
            if (wounded || (episode !== 3 && e.cue(next.events)) || timedOut) {
              // A timeout on the wound lesson shows the rule on the bar itself: the sim's own attrition, once, so the lesson has a bar to point at.
              if (episode === 3 && !wounded) { const p = next.fighters[0]; next = { ...next, fighters: [{ ...p, maxStamina: Math.max(RULES.attrition.floor, p.maxStamina - RULES.attrition.stamina), stamina: Math.min(p.stamina, Math.max(RULES.attrition.floor, p.maxStamina - RULES.attrition.stamina)) }, next.fighters[1]] }; }
              fire(tick);
            }
          } else if (tick - firedAt >= e.dwell) {
            if (episode === EPISODES.length - 1) finaleAt = tick; else { episode++; started = tick; firedAt = -1; bar = next.fighters[0].maxStamina; }
          }
        } else {
          // The finishing blow: left to land by itself, forced if the player rolled it, parried it or the foe could not reach.
          const f = next.fighters[1], strikes = f.phase === 'attack' && f.move !== null && f.age >= timing(f).windup;
          if (strikes || tick - finaleAt >= FINALE_LIMIT) {
            const p = next.fighters[0], move: MoveId = f.move ?? 'thrust';
            next = {
              ...next,
              fighters: [{ ...p, health: 0, phase: 'dead', age: 0, stun: RULES.death, buffer: null }, f],
              finish: { victim: 0, location: 'torso', move, heading: f.body.heading },
              events: [...next.events, { tick, type: 'Killed', actor: 1, target: 0, move, location: 'torso', heading: f.body.heading }],
            };
          }
        }
      }
      return project(next, dec.ai, current);
    },
  };
}

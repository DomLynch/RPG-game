// The tutorial start scene's fight (Match mode 'tutorial', `?tutorial=1`): a slow warden who waits on each step until the player does it.
// Characters & Art owns this file (the foe's pacing); the Web lane owns the instructions and the step machine and reads `onDone` / `current`.
// Outside the sim files like stepSparring and first-loss.ts: decide(), the rules, the ladder and RECORD_VERSION are untouched, nothing is
// recorded or awarded, and normal fights never reach it. There are no timeouts: the foe re-offers the same thing until the cue happens, and
// after the last step it stands and never ends the fight itself. Both fighters are kept above half health.
import { decide } from './ai.ts';
import { project, type Practice } from './combat.ts';
import { distance, legal, stepDuel, type Action, type CombatEvent, type Duel, type Intent } from './duel.ts';
import { SPARRING_DUMMY, disarm } from './sparring.ts';

export const TUTORIAL_STEPS = ['slash', 'stab', 'heavy', 'guard', 'parry', 'kick', 'roll'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

// Per step: what the foe does while it waits, and the player's own cue. Events name the DEFENDER as actor for Blocked / Parried / Dodged and the attacker for Hit.
const STEPS: Record<TutorialStep, { swing: Action | null; guard: boolean; cue: (e: CombatEvent) => boolean }> = {
  slash: { swing: null, guard: false, cue: (e) => e.type === 'Hit' && e.actor === 0 && (e.move === 'light_right' || e.move === 'light_left') },
  stab: { swing: null, guard: false, cue: (e) => e.type === 'Hit' && e.actor === 0 && e.move === 'thrust' },
  heavy: { swing: null, guard: false, cue: (e) => e.type === 'Hit' && e.actor === 0 && e.move === 'heavy_overhead' },
  guard: { swing: 'light', guard: false, cue: (e) => e.type === 'Blocked' && e.actor === 0 },
  parry: { swing: 'heavy', guard: false, cue: (e) => e.type === 'Parried' && e.actor === 0 },
  kick: { swing: null, guard: true, cue: (e) => e.actor === 0 && e.move === 'kick' && (e.type === 'Hit' || e.type === 'GuardBroken') },
  roll: { swing: 'thrust', guard: false, cue: (e) => e.type === 'Dodged' && e.actor === 0 },
};
const GAP = 150;      // ticks between the foe's swings: one at a time, the window to answer is clear
const SETTLE = 60;    // ticks the foe stands after a step is done, so the next prompt is read before he moves
const REACH = 2.1;    // the foe swings only inside this
const FLOOR = 0.5;    // share of a bar both fighters are kept above

export function createTutorial(onDone: (id: TutorialStep) => void = () => {}) {
  const done: TutorialStep[] = [];
  let index = 0, lastSwing = -GAP, settleUntil = 0;
  return {
    get done(): readonly TutorialStep[] { return done; },
    get current(): TutorialStep | null { return TUTORIAL_STEPS[index] ?? null; },
    step(current: Practice, intent: Intent): Practice {
      const before = current.duel, tick = before.tick, [p0, f0] = before.fighters;
      const live = !before.finish && p0.health > 0 && f0.health > 0;
      const keep = (f: typeof p0): typeof p0 => f.health < f.maxHealth * FLOOR ? { ...f, health: Math.ceil(f.maxHealth * FLOOR) } : f;
      const duel: Duel = live ? { ...before, fighters: [keep(p0), keep(f0)] } : before;
      const dec = decide(duel, 1, current.ai, SPARRING_DUMMY), foe = duel.fighters[1], player = duel.fighters[0];
      const id = TUTORIAL_STEPS[index], want = id ? STEPS[id] : null;
      const waiting = live && want && tick >= settleUntil && player.phase !== 'sheathed';
      let action: Action | null = null;
      if (waiting && want.swing && foe.phase === 'ready' && tick - lastSwing >= GAP && distance(foe.body, player.body) <= REACH && legal(foe, want.swing)) action = want.swing;
      const foeIntent = { ...disarm(dec.intent), guard: waiting && want.guard ? true : false, ...(action ? { action } : {}) };
      const next = stepDuel(duel, [intent, foeIntent]);
      if (next.events.some((e) => e.type === 'AttackStarted' && e.actor === 1)) lastSwing = tick;
      if (waiting && id && next.events.some(want.cue)) { done.push(id); index++; settleUntil = tick + SETTLE; lastSwing = tick; onDone(id); }
      return project(next, dec.ai, current);
    },
  };
}

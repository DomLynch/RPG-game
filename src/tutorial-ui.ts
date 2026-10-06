// The tutorial start scene's instructions (`?tutorial=1`, Match 'tutorial'): ONE large word above the fight and a short "how" line under it, for the
// step the foe is waiting on (src/tutorial.ts, Characters & Art, decides when a step is done; this file only says what to do). Words are the
// phone buttons' own labels (index.html data-mobile). Presentation only: no sim, no record, no camera.
import type { Practice } from './combat.ts';
import { TUTORIAL_STEPS, type TutorialStep } from './tutorial.ts';

export type TutorialPrompt = { word: string; how: string; now?: boolean; ready?: boolean };

const PROMPT: Record<TutorialStep, { word: string; how: string }> = {
  slash: { word: 'SLASH', how: 'tap Fight' },
  stab: { word: 'STAB', how: 'tap Stab' },
  heavy: { word: 'HEAVY', how: 'hold Heavy, then let go' },
  guard: { word: 'GUARD', how: 'hold Guard as his swing comes' },
  parry: { word: 'PARRY', how: 'tap Guard just as his swing lands' },
  kick: { word: 'KICK', how: 'he is guarding: tap Kick' },
  roll: { word: 'ROLL', how: 'tap Roll as he thrusts' },
};
export const TUTORIAL_READY: TutorialPrompt = { word: "YOU'RE READY", how: 'tap Fight!', ready: true };

// The parry answers a guard raised inside RULES.parry (10 ticks) before the blow lands; the warden's heavy lands at windup 32. "now!" shows from
// tick 10 of the swing (22 ticks, about a third of a second, before it lands) so a thumb can answer, and stays until the blow is over.
const PARRY_NOW_FROM = 10;
export const parryNow = (p: Pick<Practice, 'threat' | 'threatMove' | 'enemyAge'>): boolean => p.threat && p.threatMove === 'heavy_overhead' && p.enemyAge >= PARRY_NOW_FROM;

/** The prompt for the step the foe waits on; the ready card once every step is done; null when there is nothing to show. */
export function tutorialPrompt(current: TutorialStep | null, done: number, practice: Pick<Practice, 'threat' | 'threatMove' | 'enemyAge'>): TutorialPrompt | null {
  if (current === null) return done === TUTORIAL_STEPS.length ? TUTORIAL_READY : null;
  const base = PROMPT[current];
  return current === 'parry' && parryNow(practice) ? { word: 'NOW!', how: base.how, now: true } : base;
}

type Lookup = <T extends HTMLElement>(id: string) => T;
export function createTutorialUi(element: Lookup, onGo: () => void) {
  const box = element('tutorial-prompt'), word = element('tutorial-word'), how = element('tutorial-how'), go = element<HTMLButtonElement>('tutorial-go');
  go.addEventListener('click', onGo);
  let last = '';
  return {
    update(current: TutorialStep | null, done: number, practice: Pick<Practice, 'threat' | 'threatMove' | 'enemyAge'>) {
      const p = tutorialPrompt(current, done, practice), key = p ? `${p.word}|${p.how}` : '';
      if (key === last) return;
      last = key;
      box.hidden = !p;
      if (!p) return;
      word.textContent = p.word; how.textContent = p.how;
      box.dataset.now = p.now ? '1' : ''; box.dataset.ready = p.ready ? '1' : '';
      go.hidden = !p.ready;
    },
  };
}

// The Frontier's fight entry and exit (Combat's side of the encounter → duel → result loop; Expansion owns the mob, resolveFight, loot and the
// Bounty). The duel is the Pit's own (pit-duel.ts, loaded on demand); an encounter adds its twist flags (src/twist.ts, read each tick) and
// reports the two fields resolveFight reads: `result` and `twistOutcome`. Preview only: the sim and the record are untouched.
import type { Finished } from '../pit/pit.ts';
import type { TwistOutcome } from '../../src/twist.ts';
import type { FightSetup } from '../encounters/encounters.ts';
import { styleOf } from '../mobs/styles.ts';
import type { Shown } from './pit-duel.ts';

export type EncounterEnd = { result: 'won' | 'lost'; twistOutcome: TwistOutcome | null };

// How a finished duel reads back: the foe fell (victim 1) is a win, `caught` when it fell inside a flee-at catch window; the player fell, or a
// draw, is a loss (a retry, no payout). The twist's own endings (fled, escaped) leave both standing: `won` with the outcome named.
export const endOf = (finish: Finished, twist: TwistOutcome | null): EncounterEnd =>
  finish && !finish.draw && finish.victim === 1 ? { result: 'won', twistOutcome: twist === 'caught' ? 'caught' : null } : { result: 'lost', twistOutcome: null };
export const standingEnd = (twist: 'fled' | 'escaped'): EncounterEnd => ({ result: 'won', twistOutcome: twist });


// Fight `setup` (fightSetup's) with `seed` (fightSeed's). `done` fires once, when the fight is over.
export async function startEncounterDuel(host: HTMLElement, setup: FightSetup, seed: number, done: (end: EncounterEnd) => void, leave: () => void, as?: Shown): Promise<void> {
  const duel = await import('./pit-duel.ts');
  let over = false;
  const finish = (end: EncounterEnd) => { if (!over) { over = true; done(end); } };
  duel.openDuel(host, { opponent: setup.opponent.body, level: setup.opponent.level, seed, flags: setup.combatFlags, bar: setup.bar, mob: styleOf(setup.opponent.body), as }, {
    ended: (f) => { finish(endOf(f, duel.duelTwist().outcome)); },
    again: as ? leave : () => {},   // a creature has no rematch: its one end button goes back to the walk
    twisted: (outcome) => { if (outcome === 'fled' || outcome === 'escaped') finish(standingEnd(outcome)); },
  }, leave);
}

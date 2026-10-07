// Coach mode, slice 1 (Combat, docs/briefs/coach-mode.md; Lead's GO 2026-10-07: the four LIVE stance names, no extra instruction, Pit duels only): the player's side driven by the SAME brain that drives a
// warden. `decide()` (src/ai.ts) already works for either side of a duel, so a coach is that brain with a profile shaped by the stance the player picked (the stance battery's `bystance` brains: a
// human who picks Defensive guards and parries, an Aggressive one presses, a Trickster feints and kicks, Neutral plays it straight) and a player-level base profile.
// Outside SIM_FILES on purpose, like src/mobkit.ts: it reads a Duel and returns an Intent, writes nothing back. A coached fight's INTENTS are what the record stores, so a coached record is a played
// record: no RECORD_VERSION, same replay (tests/coach.test.ts replays one). The stance itself is the sim's (src/stance.ts, withStances), picked exactly as a human picks it.
// Human reaction, by construction identical to the AI's: the coach never overrides `reaction`, `tellReaction`, `anticipate`, `accuracy` or `discipline`, so it notices a cut after the same ticks the
// warden does at that level, and `decide()` applies the same reaction cap. tests/coach.test.ts pins that no stance brain touches them and that none is faster than the quickest AI profile.
import { decide, initialAi, type AiState } from './ai.ts';
import type { Duel, Intent } from './duel.ts';
import { PROFILES, type AiProfile, type Level } from './moves.ts';
import type { PickedStance } from './stance.ts';

// The knobs a stance brain may set: how it PLAYS (cadence, guard, feints, kicks), never how fast it sees. Numbers are the stance battery's BY_STANCE brains (scripts/stance-battery.mjs), which
// Strategy ruled (2026-10-07) are what a human who picks that stance plays; neutral is the player-level profile untouched.
export const COACH_BRAINS: Readonly<Record<PickedStance, Partial<AiProfile>>> = {
  neutral: {},
  aggressive: { aggression: 0.9, parry: 0.2, lapse: 0.1 },
  defensive: { parry: 0.7, dodge: 0.1, aggression: 0.35, guard: 1, lapse: 0.1, read: 0.9 },
  trickster: { feint: 0.5, kick: 0.6, aggression: 0.7, parry: 0.2, read: 0.8 },
};
// What a brain must leave alone: the noticing and timing limits it shares with the warden.
export const COACH_FIXED: readonly (keyof AiProfile)[] = ['reaction', 'tellReaction', 'anticipate', 'accuracy', 'discipline'];
export const coachProfile = (stance: PickedStance, level: Level = 'normal'): AiProfile => ({ ...PROFILES[level], ...COACH_BRAINS[stance] });

export type Coach = { stance: PickedStance; level: Level; step(duel: Duel): Intent };
// The coach is the player's side (fighters[0]): a fresh brain state per fight from the fight's seed, so a coached fight is a pure function of (seed, stance, level) and the record's intents.
export function createCoach(stance: PickedStance, seed: number, level: Level = 'normal', side: 0 | 1 = 0): Coach {
  const profile = coachProfile(stance, level);
  let ai: AiState = initialAi((seed * 2654435761) >>> 0);
  return {
    stance, level,
    step(duel) { const r = decide(duel, side, ai, profile); ai = r.ai; return r.intent; },
  };
}

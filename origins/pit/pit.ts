// Origins greybox, the Pit duel's rules glue: which legend the Pit offers next, and what a finished duel pays the ONE career.
// Pure (no DOM, clock, random or storage): the page passes the time and the fight's id in. The pay itself is the progression model's
// award() (origins/progression/model.ts): a won duel is an 'arena-win', a legend event keyed opponent@level that pays its first win only.
// The duel is the arena game's own simulation, fought at the career level; this module never sees a tick of it, only how it ended.
import {
  fillPermille, legendKey, levelOfCredit, newCareer, nextLegend, requirement, settleAll, cumulative, MAX_LEVEL,
  type Award, type CareerState,
} from '../progression/model.ts';

export type Outcome = 'win' | 'loss' | 'draw';
// The arena's finish (src/duel.ts Finish), by shape: side 1 is the opponent. A draw is never a win.
export type Finished = { victim: 0 | 1; draw?: boolean } | null;
export const outcomeOf = (finish: Finished): Outcome | null => (!finish ? null : finish.draw ? 'draw' : finish.victim === 1 ? 'win' : 'loss');

// The preview's session: the career, the server's one-settlement-per-id index (modelled), and how many fights it has started.
export type PitSession = { career: CareerState; settled: ReadonlySet<string>; fights: number };
// A character at `level` (the greybox's standing), nothing beaten.
export const newSession = (level: number): PitSession => ({ career: newCareer(Math.max(0, Math.floor(level) - 1)), settled: new Set(), fights: 0 });

// One fight the Pit offers: a legend at the career level. `legend` false = every legend at this level is beaten; the Pit then offers
// `fallback` again as a re-fight, which pays nothing (the model's 'already-beaten'), so the duel is never locked away in the preview.
export type PitFight = { id: string; opponent: string; level: number; seed: number; legend: boolean };
// `opponents`: the legend pool (src/legends.ts LEGEND_OPPONENTS); `key`: the pick's hash, as the model's nextLegend takes it.
export function nextFight(session: PitSession, opponents: readonly string[], key: number, pick?: string): PitFight | null {
  if (!opponents.length) return null;
  const level = levelOfCredit(session.career.credit), n = session.fights + 1;
  const asked = pick !== undefined && opponents.includes(pick) ? pick : undefined;
  if (pick !== undefined && !asked) return null;
  const open = nextLegend(session.career, opponents, key);
  const opponent = asked ?? open ?? opponents[(key >>> 0) % opponents.length]!;
  return { id: `pit-preview:${n}`, opponent, level, seed: fightSeed(key, n), legend: !session.career.beaten.includes(legendKey(opponent, level)) };
}
// The duel's seed: deterministic from the key and the fight's number, never 0 (src/match.ts nextSeed is the same LCG).
export const fightSeed = (key: number, n: number): number => ((Math.imul((key ^ Math.imul(n, 0x9e3779b1)) >>> 0, 1664525) + 1013904223) >>> 0) || 731;
// Starting a fight counts it, so the next one has a new id and seed.
export const started = (session: PitSession): PitSession => ({ ...session, fights: session.fights + 1 });

// The end of a duel. A win settles one arena-win through the model (first win over this legend at this level pays, a re-fight pays 0,
// a repeated id pays 0 and changes nothing); a loss or a draw settles nothing. `at`: server-style whole seconds.
export type Settled = { session: PitSession; outcome: Outcome; award: Award | null };
export function settle(session: PitSession, fight: PitFight, outcome: Outcome, at: number): Settled {
  if (outcome !== 'win') return { session, outcome, award: null };
  const settled = new Set(session.settled);
  const { state, awards } = settleAll(session.career, [{ kind: 'arena-win', id: fight.id, at: Math.floor(at), opponent: fight.opponent }], settled);
  return { session: { ...session, career: state, settled }, outcome, award: awards[0] ?? null };
}

// What the HUD shows: the level, the CP inside it and what the level needs, the fill, and the career total.
export type CareerLine = { level: number; credit: number; into: number; need: number; fillPermille: number; top: boolean };
export function careerLine(career: CareerState): CareerLine {
  const level = levelOfCredit(career.credit), top = level >= MAX_LEVEL;
  return { level, credit: career.credit, into: career.credit - cumulative(level), need: top ? 0 : requirement(level), fillPermille: fillPermille(career.credit), top };
}

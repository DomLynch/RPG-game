// The anti-farm layer for duel rewards (Lead brief 2026-10-06, Dom approved 10-05): pure rules, no I/O. The VERIFIER's result is the only input
// that counts (scripts/verify-duels.mjs: a replay of both streams), never a client claim. Three rules, in this order:
//   1. Elo: a rating per account, moved by a counted win. 2. First win per opponent per UTC day: a rematch win that day moves nothing and pays
//   nothing, so two accounts cannot trade wins. 3. A daily taper: each counted win past the first few that day pays less.
// Rewards stay OFF: `decideDuelResult` pays 0 while PVP_REWARDS is false (src/net/rewards.ts, pinned by tests/net-rollback.test.ts), and says
// what it WOULD have paid so the numbers can be checked before anything is switched on. Every number is in DUEL_ANTIFARM and is a placeholder.
// Persistence (a rating per account, the day's counted wins) needs a migration and is NOT here; callers pass the history in.
import { PVP_REWARDS } from './rewards.ts';

export const DUEL_ANTIFARM = {
  elo: { start: 1000, k: 32, floor: 100 },        // TODO(Stats): starting rating, K factor, lowest rating
  reward: { base: 10, perFullWin: 3, step: 0.5, min: 0.1 },   // TODO(Stats): base pay of a counted win, how many a day pay in full, the multiplier after each further win, its floor
  dayMs: 24 * 60 * 60 * 1000,                       // the day is the UTC day
} as const;
export type AntifarmConfig = typeof DUEL_ANTIFARM;

/** A counted win this account already has: who it beat and when (ms). The caller loads these for the winner's current UTC day. */
export type CountedWin = { opponent: string; at: number };
export type DuelDecision = {
  counted: boolean;                // the win moves ratings and counts toward the day
  reason: 'ok' | 'unverified' | 'same-account' | 'draw' | 'repeat-opponent';
  winner: number; loser: number;   // the two ratings after
  wouldPay: number;                // what a counted win pays at today's taper (0 when not counted)
  pay: number;                     // what is actually paid: 0 while rewards are off
};

export const utcDay = (ms: number, cfg: AntifarmConfig = DUEL_ANTIFARM): number => Math.floor(ms / cfg.dayMs);
export const expectedScore = (own: number, other: number): number => 1 / (1 + 10 ** ((other - own) / 400));
const rating = (r: number | null | undefined, cfg: AntifarmConfig): number => (typeof r === 'number' && Number.isFinite(r) ? Math.max(cfg.elo.floor, r) : cfg.elo.start);

/** The multiplier on the n-th counted win of the day (n = how many the winner already has today, from 0). */
export function taper(already: number, cfg: AntifarmConfig = DUEL_ANTIFARM): number {
  return Math.max(cfg.reward.min, cfg.reward.step ** Math.max(0, already - cfg.reward.perFullWin + 1));
}

export function decideDuelResult(input: {
  winnerId: string; loserId: string; winnerRating?: number | null; loserRating?: number | null; verified: boolean; draw?: boolean;
  winnerTodayWins: readonly CountedWin[]; now: number; cfg?: AntifarmConfig;
}): DuelDecision {
  const cfg = input.cfg ?? DUEL_ANTIFARM;
  const w = rating(input.winnerRating, cfg), l = rating(input.loserRating, cfg);
  const none = (reason: DuelDecision['reason']): DuelDecision => ({ counted: false, reason, winner: w, loser: l, wouldPay: 0, pay: 0 });
  if (!input.verified) return none('unverified');
  if (input.winnerId === input.loserId) return none('same-account');
  if (input.draw) return none('draw');
  const today = input.winnerTodayWins.filter((x) => utcDay(x.at, cfg) === utcDay(input.now, cfg));
  if (today.some((x) => x.opponent === input.loserId)) return none('repeat-opponent');
  const gain = Math.round(cfg.elo.k * (1 - expectedScore(w, l)));
  const wouldPay = Math.round(cfg.reward.base * taper(today.length, cfg) * 100) / 100;
  return { counted: true, reason: 'ok', winner: w + gain, loser: Math.max(cfg.elo.floor, l - gain), wouldPay, pay: PVP_REWARDS ? wouldPay : 0 };
}

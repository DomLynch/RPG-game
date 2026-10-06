// Server-side award rule (brief 19 deliverable 3; migration 202609230001). The verifier calls this once per verified ladder-win claim with
// the account's server standing BEFORE that win (public.standing_of: seed marks + earlier verified claims, seed owned ∪ earlier awards),
// never the device's cached marks or loot. Pure: the same claim and standing give the same award on every sweep.
//
// SCOPE.md Loot v2 (Strategy, 2026-09-23): the player takes ONE piece of his choice, armour or weapon. The claim names it; the server only
// checks it — the piece must be in the opponent's kit at the tier he was met at (the server's marks before the win, src/grades.ts tierAt).
// A claim with no piece (the take declined) is still a mark.
import { DIAL_TRAIL, FIRST_FIFTY_VERSION, OLD_MAX_LEVEL, levelOf as rankLevel } from './career.ts';
import { TIERS, levelOf, tierAt, type Tier } from './grades.ts';
import { LOOT, WORN_FROM, isLootId, type LootId, type WornFrom } from './loot.ts';
import type { OpponentId } from './roster.ts';

export type Claim = { opponent: string; piece: string | null };
export type Standing = { marks: number; owned: readonly string[] };
export type Award = { piece: string; tier: number };
// The kit floor is src/loot.ts WORN_FROM (empty in beta: every piece worn from Recruit). `wornFrom` is only for tests to inject a floor.

export const kitAt = (opponent: string, tier: Tier, wornFrom: WornFrom = WORN_FROM): readonly LootId[] =>
  (LOOT[opponent as OpponentId] ?? []).filter(id => levelOf(wornFrom[id] ?? TIERS[0]) <= levelOf(tier));

// null: nothing to award (the take was declined, or the piece is already his). A string: the claim is refused outright.
export function awardFor(claim: Claim, standing: Standing, wornFrom: WornFrom = WORN_FROM): Award | null | string {
  if (claim.piece === null) return null;
  const tier = tierAt(standing.marks);
  if (!isLootId(claim.piece) || !kitAt(claim.opponent, tier, wornFrom).includes(claim.piece)) return `${claim.piece} is not in ${claim.opponent}'s kit at ${tier}`;
  return standing.owned.includes(claim.piece) ? null : { piece: claim.piece, tier: levelOf(tier) };
}

// The level a ladder win was fought at (records carry it since RV16) must be at or above the dial's floor under the account's SERVER rank
// before this win: rank level − DIAL_TRAIL, never below 1 (Lead's ruling, 2026-09-27). The dial lets an honest player trail his rank by up
// to DIAL_TRAIL after losses (career.ts turnDial), so the floor is the dial's, not the rank's; harder than the rank is never an exploit.
// null: the win stands. A string: the claim is refused (no mark); the text is the player's (Lead, 2026-09-27), stored as the claim's note. A record with no level (before RV16) keeps the older rules.
// The floor reads the rank, and the rank's top moved 46 -> 50 with the 50-level ladder (RV27): it changes only for an account past 45 wins, whose ranks 47–50 did
// not exist before. A record older than RV27 was played under the 46 top, so it is judged by the rank that ladder gave (min(rank, 46): floor 41), never refused for a floor it could not know.
export function levelRefusal(level: number | undefined, marks: number, version?: number): string | null {
  if (level === undefined) return null;
  const rank = version !== undefined && version < FIRST_FIFTY_VERSION ? Math.min(rankLevel(marks), OLD_MAX_LEVEL) : rankLevel(marks), floor = Math.max(1, rank - DIAL_TRAIL);
  return level < floor ? `This win was fought below your rank and didn't count (level ${level}; your rank is level ${rank}, floor ${floor}).` : null;
}

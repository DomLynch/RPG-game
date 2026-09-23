// Server-side award rule (brief 19 deliverable 3; migration 202609230001). The verifier calls this once per verified ladder-win claim with
// the account's server standing BEFORE that win (public.standing_of: seed marks + earlier verified claims, seed owned ∪ earlier awards),
// never the device's cached marks or loot. Pure: the same claim and standing give the same award on every sweep.
//
// SCOPE.md Loot v2 (Strategy, 2026-09-23): the player takes ONE piece of his choice, armour or weapon. The claim names it; the server only
// checks it — the piece must be in the opponent's kit at the tier he was met at (the server's marks before the win, src/grades.ts tierAt).
// A claim with no piece (the take declined) is still a mark.
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

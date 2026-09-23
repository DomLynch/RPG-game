// Server-side award rule (brief 19 deliverable 3; migration 202609230001). The verifier calls this once per verified ladder-win claim with
// the account's server standing BEFORE that win (public.standing_of: seed marks + earlier verified claims, seed owned ∪ earlier awards),
// never the device's cached marks or loot. Pure: the same claim and standing give the same award on every sweep.
//
// An armour drop is the server's to choose (`dropFor` at the sub-rank the fight was fought at); a claim names a piece only for the
// "Take one" weapon choice. The claim is still a mark when there is nothing to award.
import { levelOf, tierAt } from './grades.ts';
import { LOOT, dropFor, isLootId, isWeaponLoot } from './loot.ts';
import type { OpponentId } from './roster.ts';

export type Claim = { opponent: string; piece: string | null };
export type Standing = { marks: number; owned: readonly string[] };
export type Award = { piece: string; tier: number };

// null: nothing to award (he has nothing left to drop, or the weapon is already yours). A string: the claim is refused outright.
export function awardFor(claim: Claim, standing: Standing): Award | null | string {
  const pieces: readonly string[] | undefined = LOOT[claim.opponent as OpponentId];
  const tier = levelOf(tierAt(standing.marks));
  if (claim.piece === null) {
    const piece = pieces ? dropFor(claim.opponent as OpponentId, standing.marks, standing.owned) : null;
    return piece ? { piece, tier } : null;
  }
  if (!isLootId(claim.piece) || !pieces?.includes(claim.piece) || !isWeaponLoot(claim.piece)) return `${claim.piece} is not a weapon ${claim.opponent} carries`;
  return standing.owned.includes(claim.piece) ? null : { piece: claim.piece, tier };
}

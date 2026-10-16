// Another player's gear on their body (v2 of the other-players view; v1 draws the base hero). ONE dressing path: the call the player's own actor takes, scene.ts's `warriors.player.wear(pieces.filter(lootWorn), failed, tierOf)` and gear-stage.ts's
// `dress`. This module only turns a worn set ({ slot: loot id }, as the server sends it) into that call's arguments; it draws nothing and loads nothing (the caller owns the actor and the loadLoot pieces).
// Materials: `wear` resolves a piece's material from the actor's own rig palette (sourceMaterial) and tints it by rank; no material is made here, so a remote dressed with a piece the local player has worn compiles nothing new.
import type { SkinnedMesh } from 'three';
import { lootIds, lootWorn } from '../../src/fight/index.ts';
import type { Tier } from '../../src/core/index.ts';

export type Worn = Readonly<Record<string, string>>;   // slot -> loot id, e.g. { Helmet: 'goblin.Helmet.Steel' }
type Dressable = { wear(pieces: readonly SkinnedMesh[], failed?: (id: string, error: unknown) => void, tierOf?: (piece: SkinnedMesh) => Tier | undefined): void };

/** The worn set's ids: the slot key only labels the entry (the id says which piece it is), and an empty id is nothing worn. */
export const wornIds = (worn: Worn): string[] => Object.values(worn).filter((id) => id.length > 0);

/**
 * Dress `actor` with exactly `worn` (nothing else: a re-dress undresses what is no longer worn, as `wear` always does).
 * `pieces` is loadLoot's result, `tiers` the rung each id was taken at (a missing id shows Recruit, as the player's own does). Returns the ids that matched no piece, so the caller can log a set the build does not know.
 */
export function dressRemote(actor: Dressable, pieces: readonly SkinnedMesh[], worn: Worn, tiers: Readonly<Record<string, Tier>> = {}, failed?: (id: string, error: unknown) => void): string[] {
  const ids = wornIds(worn), chosen = pieces.filter((piece) => lootWorn(piece, ids));
  actor.wear(chosen, failed, (piece) => tiers[lootIds(piece).find((id) => ids.includes(id)) ?? ''] ?? 'Recruit');
  const matched = new Set(chosen.flatMap((piece) => lootIds(piece)));
  return ids.filter((id) => !matched.has(id));
}

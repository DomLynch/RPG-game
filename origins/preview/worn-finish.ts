// The hand and paperdoll look of a starter item (Lead 2026-10-17: one row per item, no second table, no new mesh). A starter piece wields as a borrowed LootId (starter-wield.json, Backend #2973), so
// the dress code sees a plain goblin knife; the item's own look row (ground-looks.json) already names the finish it wears on the ground (rust, dull-iron, old-bronze). This reads that row for every
// EQUIPPED piece of the server's gear view and keys the finish by the LootId the piece stands as, the key the dress code (wear(), grade()) already holds: finishedAs(metal, finish) is then the same call as
// the ground view's. A piece with no look row (a legacy item:loot.* drop) or no finish is left out, so it keeps its own metal. Pure.
import { groundFinish } from './ground-looks.ts';

export type WornPiece = { readonly item: string; readonly lootId: string | null; readonly where: 'pack' | 'bank' | 'equipped' };

/** LootId -> finish row id, for the equipped pieces that carry a finish. */
export function wornFinishes(pieces: readonly WornPiece[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of pieces) {
    if (p.where !== 'equipped' || p.lootId === null) continue;
    const finish = groundFinish(p.item);
    if (finish !== undefined) out[p.lootId] = finish;
  }
  return out;
}

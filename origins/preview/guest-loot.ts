// A signed-out player fights and loots the whole of Zone 1 (Dom, 2026-10-16): the guest's kill rolls the SAME loot table from the SAME data rows the server rolls on a verified kill
// (origins/server/mob-rewards.ts mobBatch: fightSetup -> resolveFight -> rollLoot, the encounters module), but nothing is paid or saved. The roll stays on the page for this session: no CP,
// no ledger, no leaderboard, no career row, no network call. Pure: the page hands in the encounter content and a seed.
import { rollLoot, type EncounterContent } from '../encounters/encounters.ts';

export type GuestLoot = { loot: { item: string; quantity: number }[]; bronze: number };

/** The loot a guest's kill of `fight` (the creature's character id) at `level` drops for `seed`, or null when its row has no loot table or the roll is refused. The table is the creature row's own (content.local.creatureLoot, what the server's payout rolls), so the same table, seed and level give the same drops the server would pay. */
export function guestKillLoot(content: EncounterContent, fight: string, level: number, seed: number): GuestLoot | null {
  const table = content.local.creatureLoot[fight];
  if (!table) return null;
  const rolled = rollLoot(table, seed, content, { foeLevel: level });
  return rolled.ok ? { loot: rolled.value.items.map((d) => ({ item: d.item, quantity: d.quantity })), bronze: rolled.value.metal } : null;
}

/** What a guest holds this session: in memory only, gone with the page, never written to storage or sent anywhere. */
export function guestBag(): { add(g: GuestLoot): void; items(): readonly { item: string; quantity: number }[]; bronze(): number } {
  const held = new Map<string, number>();
  let bronze = 0;
  return {
    add: (g) => { for (const l of g.loot) held.set(l.item, (held.get(l.item) ?? 0) + l.quantity); bronze += g.bronze; },
    items: () => [...held].map(([item, quantity]) => ({ item, quantity })),
    bronze: () => bronze,
  };
}

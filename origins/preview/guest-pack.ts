// A signed-out player's pack (Dom 2026-10-16, guest loot): the session's held items (guest-loot.ts guestBag, in memory only) as the SAME GearView the bank's Backpack grid reads from the server
// (play.ts), so a guest sees what they took and what a kill rolled in the one panel, with no second pack and nothing written. Pure: the page hands in the held list, an item lookup and the pack size.
import type { GearPiece, GearView, StockRow } from '../../src/core/index.ts';

export type ItemInfo = { name: string; category: string; lootId?: string | null };
export type Held = readonly { item: string; quantity: number }[];

/** Gear (category 'gear') becomes one pack piece per copy; everything else (pelts, ore) one stock row per item. Cells fill in order and stop at `packSize`: the grid has no cell beyond it. */
export function guestViewOf(held: Held, info: (item: string) => ItemInfo | undefined, packSize: number): GearView {
  const pieces: GearPiece[] = [], stock: StockRow[] = [];
  let cell = 0;
  for (const h of held) {
    const i = info(h.item);
    if (i?.category === 'gear') {
      for (let n = 0; n < h.quantity && cell < packSize; n++) pieces.push({ id: `guest:${cell}`, item: h.item, lootId: i.lootId ?? null, slot: null, where: 'pack', index: cell++, paperdoll: null, tier: null, version: 0, level: 0 });
    } else if (cell < packSize) stock.push({ id: `guest:${cell}`, item: h.item, name: i?.name ?? h.item, category: i?.category ?? 'material', quantity: h.quantity, where: 'pack', index: cell++, version: 0 });
  }
  return { pieces, stock, worn: {}, packSize, bankSize: 0 };
}

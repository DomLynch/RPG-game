// POST /origins/gear_wear {character}: read only, no counter needed (like shop_stock). Every wearable piece the character holds that is worn, with its wear and the quote the smith
// would charge for repairing all of it, priced by the same rows gear_repair uses (origins/gear/wear-repair.json). An unworn piece is not listed: an empty list is the answer
// "nothing is worn", not an error. The page shows these numbers and sends only {character, op, instance} to gear_repair; it computes no cost itself.
import { repairCost, wearKindOf } from '../gear/wear-repair.ts';
import { Refused } from './errors.ts';
import { BadRequest, type Handler } from './handlers.ts';
import { openHoldingsWith, type Content } from './holdings.ts';
import * as store from './store.ts';

export type WearLine = { instance: string; slot: string; worn: number; max: number; baseMax: number; quote: { points: number; bronze: number; metal: { item: string; qty: number } } };

export function gearWearHandler(content: Content): Handler {
  return async ({ db, account }, body) => {
    const { character } = body;
    if (typeof character !== 'string' || character.length > 80) throw new BadRequest('character: a character id');
    const { inventory } = await openHoldingsWith(db, account, character, content);
    const held = inventory.items.flatMap((i) => { const kind = wearKindOf(i.item); return kind ? [{ id: i.id, kind }] : []; });
    if (!held.length) return { pieces: [] as WearLine[] };
    const wears = await store.itemWears(db, account, held.map((h) => h.id));
    if (wears === 'absent') throw new Refused(503, 'the wear ledger is not installed (migration 20261013174936)');
    const pieces: WearLine[] = held.flatMap(({ id, kind }) => {
      const w = wears[id];
      if (!w || w.worn <= 0) return [];
      const q = repairCost(kind.tier, w, w.worn, undefined, kind.slot);
      return [{ instance: id, slot: kind.slot, worn: w.worn, max: w.max, baseMax: w.baseMax, quote: { points: q.points, bronze: q.gold, metal: { item: q.metalItem, qty: q.metal } } }];
    });
    return { pieces };
  };
}

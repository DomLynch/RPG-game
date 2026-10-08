// The gear screen's rules (TOP10 holding-cell move, Web): ONE screen for what you wear and what you carry, docked beside the vault at the Concord Exchange.
// Pure: reads and changes an Inventory only through origins/inventory/inventory.ts (the one inventory authority); no DOM here (play.ts renders it with ui.ts).
// inventory.ts `equip` refuses an occupied paperdoll slot (no silent swap, so a full pack can never strand the piece taken off); the screen's Wear is a swap
// built on the two public calls: take the occupant off into a free pack slot, then put the new piece on. If either step is refused nothing changed.
import { PAPERDOLL, paperdollOf, type Paperdoll } from '../../src/loot.ts';
import { fail, type Result } from '../contracts/core.ts';
import type { ItemInstance } from '../contracts/items.ts';
import type { CareerStanding } from '../contracts/world.ts';
import { equip, find, unequip, worn, type Inventory, type Lookup } from '../inventory/inventory.ts';

export const DOLL = Object.keys(PAPERDOLL) as Paperdoll[];
export type WornRow = { slot: Paperdoll; item: ItemInstance | null };
// Every paperdoll slot, in the doll's order, with the piece on it (or null).
export const wornRows = (inv: Inventory): WornRow[] => {
  const on = worn(inv);
  return DOLL.map((slot) => ({ slot, item: on.find((i) => i.location.kind === 'equipped' && i.location.slot === slot) ?? null }));
};
export const SLOT_LABEL: Record<Paperdoll, string> = { head: 'Helmet', crest: 'Crest', chest: 'Body', arms: 'Arms', hands: 'Gloves', legs: 'Greaves', feet: 'Boots', main: 'Weapon', off: 'Shield' };

// Wear a piece from the pack, swapping out whatever holds its slot. Refused (inventory untouched): not in the pack, rank too low, no free pack slot for the piece it replaces.
export function wearSwap(inv: Inventory, id: string, lookup: Lookup, standing: CareerStanding): Result<Inventory> {
  const inst = find(inv, id);
  const def = inst && lookup(inst.item);
  if (!inst || !def || def.slot === null || inst.location.kind !== 'pack') return equip(inv, id, lookup, standing);   // let equip name the refusal
  const slot = paperdollOf(def.slot);
  const on = wornRows(inv).find((r) => r.slot === slot)?.item;
  if (!on) return equip(inv, id, lookup, standing);
  const off = unequip(inv, on.id, lookup);
  if (!off.ok) return /full|no free/i.test(off.issues[0]?.message ?? '') ? fail('rule-violation', 'id', `your pack is full: make room to swap the ${SLOT_LABEL[slot].toLowerCase()}`) : off;
  return equip(off.value, id, lookup, standing);
}

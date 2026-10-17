import { loadRegistry, tableFromFile, type Manifest } from './registry.ts';
import SLOT_DEFS from '../fight/spell-slot-defs.json' with { type: 'json' };
import SLOT_MANIFEST from '../fight/spell-slot-defs.manifest.json' with { type: 'json' };

// A read-only view of the special slots for the entry chunk (equip, grimoire, HUD): the SAME rows the sim reads (src/fight/spell-rows.ts), loaded through the registry here
// so the page never imports the 700-row spell catalogue. The sim owns the rules; this file only lists the slots and the duplicate rule. Read once at load.
const SLOT_T = tableFromFile(SLOT_MANIFEST.tables[0] as unknown as Manifest, SLOT_DEFS, 'spell-slot-defs.json');
const RULE_T = tableFromFile(SLOT_MANIFEST.tables[1] as unknown as Manifest, SLOT_DEFS, 'spell-slot-defs.json');
loadRegistry([SLOT_T, RULE_T]);
export type SlotView = { readonly id: string; readonly action: string; readonly order: number };
/** The slots in HUD order. */
export const SLOTS: readonly SlotView[] = (SLOT_T.rows as unknown as SlotView[]).map((r) => ({ id: r.id, action: r.action, order: r.order })).sort((a, b) => a.order - b.order);
/** 1 = the same spell may sit in both slots (the sim's replay refuses it otherwise). */
export const ALLOW_DUPLICATE_SLOTS: boolean = (RULE_T.rows as unknown as { id: string; value: number }[]).find((r) => r.id === 'allowDuplicate')?.value === 1;
/** Whether slot `slot`'s button is shown given each slot's resolved pick (undefined = empty): an empty slot shows none, and slot b needs a slot-a spell beside it (the record refuses one without). The open-world page calls it on a pick, never per frame; the Pit HUD uses the fighter's own slot instead and the Pit never fills slot b. */
export const slotShown = (picks: readonly unknown[], slot: number): boolean => picks[slot] !== undefined && (slot === 0 || picks[0] !== undefined);

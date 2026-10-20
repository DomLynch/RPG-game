// The four beta specials the SPECIAL 1 / 2 picker offers (Dom 2026-10-20: the sandbox four, all unlocked from the start, two slotted by default, any of the four swapped into either slot).
// Everything here is a row: the sandbox's `specialPick` table in sandbox-rules-defs.json gives the ids, their order, role lines, display labels and the default slots (slot1Default / slot2Default / slot2Alt).
// Read straight from the JSON, whether or not the sandbox era is on: the era only decides which rules a replayed record runs, never what the picker lists. Presentation only: equipping still checks the
// betaCut row (special-equip.ts), a bow worn swaps the names through special-names.ts, and nothing here reaches the sim.
import DEFS from './sandbox-rules-defs.json' with { type: 'json' };

type PickRow = { id: string; role: string; label?: string; slot1Default?: number; slot2Default?: number; slot2Alt?: number };
const ROWS: readonly PickRow[] = (DEFS as unknown as { specialPick?: PickRow[] }).specialPick ?? [];

/** The picks in row order, as the picker lists them. */
export const pickChoices = (): readonly { readonly id: string; readonly role: string }[] => ROWS.map((r) => ({ id: r.id, role: r.role }));
/** The row's display name for a skill id; undefined when the row has none. */
export const pickName = (id: string): string | undefined => ROWS.find((r) => r.id === id)?.label;
/** The default slots the rows name: SPECIAL 1's default, SPECIAL 2's default, and SPECIAL 2's alternative when SPECIAL 1 already is its default. */
export const pickDefaults = (): { readonly slot1?: string; readonly slot2?: string; readonly slot2Alt?: string } => ({
  slot1: ROWS.find((r) => r.slot1Default)?.id,
  slot2: ROWS.find((r) => r.slot2Default)?.id,
  slot2Alt: ROWS.find((r) => r.slot2Alt)?.id,
});

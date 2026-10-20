// Look-test for Dom's open special-picker decision (Lead 2026-10-20, the look-test skill): ?picker=sandbox shows the sandbox's four specials in the SPECIAL 1 / 2 picker instead of the betaCut's seven.
// Preview only: the ids, roles and display names are the sandbox's own `specialPick` rows (sandbox-rules-defs.json), read whether or not the sandbox era is on; nothing is equipped differently (equipping still
// checks the betaCut row) and a page without the flag is exactly as before. The flag never reaches the sim.
import DEFS from './sandbox-rules-defs.json' with { type: 'json' };

type PickRow = { id: string; role: string; label?: string };
const ROWS: readonly PickRow[] = (DEFS as unknown as { specialPick?: PickRow[] }).specialPick ?? [];

/** ?picker=sandbox turns the look-test on; anything else (or no flag) leaves the picker on the betaCut list. */
export const pickerLookFlag = (search: string): boolean => /[?&]picker=sandbox(&|#|$)/.test(search);
/** The sandbox's picks, in row order, as the picker lists them. */
export const sandboxPickerChoices = (): readonly { readonly id: string; readonly role: string }[] => ROWS.map((r) => ({ id: r.id, role: r.role }));
/** The sandbox's display name for a skill id (its row's label); undefined when the row has none. */
export const sandboxPickerName = (id: string): string | undefined => ROWS.find((r) => r.id === id)?.label;

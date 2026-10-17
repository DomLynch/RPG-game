// The two SPECIAL slots the player takes into a fight (Dom 2026-10-17, Strategy signed off; Combat): SPECIAL 1 / SPECIAL 2, each one of the beta's `specialPick` class skills (career-rules.json betaCut). The list, its order and its role
// lines are rows (career-ladder.ts BETA_SPECIAL_PICK / BETA_SPECIAL_ROLES), so nothing here names a skill. Pure and synchronous, because the Match's `skill` and `skill2` ports are read at begin(). A skill is an existing skill-defs row, so
// its move, clip and cost exist already. The server stays the authority (record and claim judging refuse a skill outside the pick, the way the cut refuses a level).
import { BETA_SPECIAL_PICK, BETA_SPECIAL_ROLES, BETA_SPECIAL_SLOTS, inBetaSpecials } from './career-ladder.ts';
export type SpecialStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const SPECIAL_SLOT_COUNT = BETA_SPECIAL_SLOTS;   // a row (betaCut.specialSlots): SPECIAL 1 (index 0, the 'skill' button) and SPECIAL 2 (index 1, the 'skill2' button); the same two buttons the spell slots used
const KEY = 'frankendom.special.slots.v1';
let store: SpecialStore | undefined;
const listeners: (() => void)[] = [];
/** The page gives it localStorage once; a viewer without storage simply never keeps a pick. */
export const useSpecialStore = (s: SpecialStore | undefined): void => { store = s; };
/** Called after a pick changes (the HUD shows or hides a slot's button on it, never per frame). */
export const onSpecialsChanged = (fn: () => void): void => { listeners.push(fn); };
/** The picks on offer, in row order, each with its role line ("opener", "control", "heavy", "posture break"): what the picker lists. An empty list in the row lifts the cut and offers nothing here. */
export const specialChoices = (): readonly { readonly id: string; readonly role: string }[] => BETA_SPECIAL_PICK.map((id) => ({ id, role: BETA_SPECIAL_ROLES[id] ?? '' }));
const stored = (): (string | undefined)[] => {
  const empty = Array.from({ length: SPECIAL_SLOT_COUNT }, () => undefined as string | undefined);
  let raw: string | null | undefined;
  try { raw = store?.getItem(KEY); } catch { return empty; }
  if (!raw) return empty;
  try { const a = JSON.parse(raw) as unknown; if (Array.isArray(a)) return empty.map((_, i) => (typeof a[i] === 'string' ? (a[i] as string) : undefined)); } catch { /* a corrupt value reads as no pick */ }
  return empty;
};
/** The equipped skill id per slot, in slot order; a slot is undefined when empty or when its pick is not in the row (the cut changed). */
export const equippedSpecials = (): (string | undefined)[] => stored().map((id) => (id && inBetaSpecials(id) ? id : undefined));
/** The equipped skill id of one slot (default SPECIAL 1). */
export const equippedSpecial = (slot = 0): string | undefined => equippedSpecials()[slot];
/** Equip a skill from the row's list into a slot; undefined (or an id not in the list) clears that slot. A skill already in the other slot MOVES (two different specials: the same skill is never in both). */
export function equipSpecial(id: string | undefined, slot = 0): void {
  if (slot < 0 || slot >= SPECIAL_SLOT_COUNT) return;
  try {
    const next = stored();
    next[slot] = id && inBetaSpecials(id) ? id : undefined;
    if (next[slot]) next.forEach((other, i) => { if (i !== slot && other === next[slot]) next[i] = undefined; });
    if (next.every((x) => x === undefined)) store?.removeItem(KEY); else store?.setItem(KEY, JSON.stringify(next.map((x) => x ?? null)));
  } catch { /* storage refused: the pick lasts this page only through the picker */ }
  for (const fn of listeners) fn();
}

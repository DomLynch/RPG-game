// The spells the player takes into a fight (Web, programme 2b; two universal slots, spell-slot-defs.json): which spells the account owns (the grimoire's ids, filled by the spell book's read) and which one sits in each slot.
// Pure and synchronous, because the Match's `spell` port is read at begin(). Data only: an id is whatever the grimoire holds, so nothing here names a spell. The server stays the authority (it re-checks grimoire and skill).
import { ALLOW_DUPLICATE, SPELL_SLOTS } from '../fight/spell-slot-rows.ts';   // the light slot rows, never the 700-row catalogue (tests/spell-rows.test.ts walks this chunk's imports)
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'frankendom.spell.slots.v1', ONE_SLOT_KEY = 'frankendom.spell.equipped.v1';   // the old one-spell key reads into slot a until the first pick writes the new key
let owned: readonly string[] = [];
let store: Store | undefined;
const listeners: (() => void)[] = [];
/** The page gives it localStorage once; a viewer without storage simply never keeps a pick. */
export const useSpellStore = (s: Store | undefined): void => { store = s; };
/** The grimoire's spell ids, as the last read of the book left them (a guest, an offline writer or no read yet: none). */
export const setOwnedSpells = (ids: readonly string[]): void => { owned = [...new Set(ids)]; };
export const ownedSpells = (): readonly string[] => owned;
/** Called after a pick changes (the HUD shows or hides a slot's button on it, never per frame). */
export const onSpellsChanged = (fn: () => void): void => { listeners.push(fn); };
const stored = (): (string | undefined)[] => {
  try {
    const raw = store?.getItem(KEY);
    if (raw) { const a = JSON.parse(raw) as unknown; if (Array.isArray(a)) return SPELL_SLOTS.map((_, i) => (typeof a[i] === 'string' ? (a[i] as string) : undefined)); }
    const old = store?.getItem(ONE_SLOT_KEY);
    return SPELL_SLOTS.map((_, i) => (i === 0 && old ? old : undefined));
  } catch { return SPELL_SLOTS.map(() => undefined); }
};
/** The equipped id per slot, in slot order; a slot is undefined when empty or when its pick is not in the book (a book that shrank, another account). */
export const equippedSpells = (): (string | undefined)[] => stored().map((id) => (id && owned.includes(id) ? id : undefined));
/** The equipped spell id of one slot (default slot a). */
export const equippedSpell = (slot = 0): string | undefined => equippedSpells()[slot];
/** Equip a spell from the book into a slot (default slot a); undefined (or an id not in the book) clears that slot. A spell already in another slot moves unless the slot rules allow duplicates. */
export function equipSpell(id: string | undefined, slot = 0): void {
  if (slot < 0 || slot >= SPELL_SLOTS.length) return;
  try {
    const next = stored();
    next[slot] = id && owned.includes(id) ? id : undefined;
    if (next[slot] && !ALLOW_DUPLICATE) next.forEach((other, i) => { if (i !== slot && other === next[slot]) next[i] = undefined; });
    if (next.every((x) => x === undefined)) { store?.removeItem(KEY); store?.removeItem(ONE_SLOT_KEY); } else store?.setItem(KEY, JSON.stringify(next.map((x) => x ?? null)));
  } catch { /* storage refused: the pick lasts this page only through the book */ }
  for (const fn of listeners) fn();
}

// The spell the player takes into a fight (Web, programme 2b): which spells the account owns (the grimoire's ids, filled by the spell book's read) and which one is equipped.
// Pure and synchronous, because the Match's `spell` port is read at begin(). Data only: an id is whatever the grimoire holds, so nothing here names a spell. The server stays the authority (it re-checks grimoire and skill).
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'frankendom.spell.equipped.v1';
let owned: readonly string[] = [];
let store: Store | undefined;
/** The page gives it localStorage once; a viewer without storage simply never keeps a pick. */
export const useSpellStore = (s: Store | undefined): void => { store = s; };
/** The grimoire's spell ids, as the last read of the book left them (a guest, an offline writer or no read yet: none). */
export const setOwnedSpells = (ids: readonly string[]): void => { owned = [...new Set(ids)]; };
export const ownedSpells = (): readonly string[] => owned;
/** The equipped spell id, or undefined when none is picked or the pick is not in the book (a book that shrank, another account). */
export function equippedSpell(): string | undefined {
  try { const id = store?.getItem(KEY); return id && owned.includes(id) ? id : undefined; } catch { return undefined; }
}
/** Equip a spell from the book; undefined (or an id not in the book) clears the pick. */
export function equipSpell(id: string | undefined): void {
  try { if (id && owned.includes(id)) store?.setItem(KEY, id); else store?.removeItem(KEY); } catch { /* storage refused: the pick lasts this page only through the book */ }
}

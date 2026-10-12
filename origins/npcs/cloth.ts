// The townspeople's worn pieces are ROWS (origins/npcs/cloth.json, loaded and checked by the registry loader). A slot row is where a piece sits (one piece per slot) and which hash bits
// choose it (`shift`; `optional` = the slot may stay empty); a piece row names its slot and, if it needs another piece, `requires` (the apron needs a tunic). The mesh of a piece is the
// existing `Cloth_<piece>` node in public/world/town/clothes.glb (scripts/character/town_clothes.py). A new piece is a row plus a glb node; no generator code.
import cloth from './cloth.json' with { type: 'json' };

export type ClothSlotRow = { order: number; shift: number; optional?: boolean };
export type ClothPieceRow = { order: number; slot: string; requires?: string };
export const CLOTH_SLOTS = cloth.slots as Readonly<Record<string, ClothSlotRow>>;
export const CLOTH_PIECE_ROWS = cloth.pieces as Readonly<Record<string, ClothPieceRow>>;
const byOrder = <T extends { order: number }>(rows: Readonly<Record<string, T>>): [string, T][] => Object.entries(rows).sort((a, b) => a[1].order - b[1].order);
export const CLOTH_PIECES: readonly string[] = byOrder(CLOTH_PIECE_ROWS).map(([id]) => id);
/** The slots in order, each with its pieces in order: what the outfit generator walks. */
export const clothSlotsInOrder = (): { id: string; row: ClothSlotRow; pieces: string[] }[] =>
  byOrder(CLOTH_SLOTS).map(([id, row]) => ({ id, row, pieces: byOrder(CLOTH_PIECE_ROWS).filter(([, p]) => p.slot === id).map(([pid]) => pid) }));

/** Problems with a worn-piece list: unknown pieces, two pieces in one slot, a piece whose required piece is missing. Empty = valid. */
export function outfitProblems(pieces: readonly string[]): string[] {
  const out: string[] = [], slots = new Set<string>();
  for (const p of pieces) {
    const row = CLOTH_PIECE_ROWS[p];
    if (!row || !Object.hasOwn(CLOTH_PIECE_ROWS, p)) { out.push(`${p} is not a cloth piece`); continue; }
    if (slots.has(row.slot)) out.push(`two pieces in the ${row.slot} slot`);
    slots.add(row.slot);
    if (row.requires && !pieces.includes(row.requires)) out.push(`${p} needs ${row.requires}`);
  }
  return out;
}

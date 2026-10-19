// What a kill drops and what the hero wears of it (zone sandbox, Dom 2026-10-18: "take everything from the body, mix and match"). SANDBOX ONLY and local to this device: no account item is made
// (Strategy: a sandbox mint would be an unverified mint). Reuses the main game's own rules: a piece id is `<body>.<Slot>` (src/core/loot.ts), one worn piece per paperdoll slot, each at the rung it was won at,
// no set tier (gear-stats.ts kit). Donor: UO/ModernUO corpse (everything it wore is on the body, take what you want).
import { droppedPiece } from '../world/loadouts-rules.ts';
import type { Loadout } from '../world/loadouts-rules.ts';
import { isWeaponLoot, paperdollOf, slotOf, type LootId } from '../../src/core/index.ts';

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The weapon a loadout carries as a loot id (`goblin.Gladius`), or undefined for a row with no weapon or no pieces to name the body by. */
export function weaponPiece(row: Loadout | undefined): string | undefined {
  const body = row?.pieces[0]?.split('.')[0];
  return row?.weapon && body ? `${body}.${capital(row.weapon)}` : undefined;
}

/** What one kill drops. `limit` is the take limit row (the Pit takes 1; 0 = everything): everything the body wore and carried, or `limit` pieces starting at the one a normal kill would drop. */
export function dropSet(row: Loadout | undefined, creatureId: string, limit: number): string[] {
  if (!row) return [];
  const all = [...row.pieces, ...(weaponPiece(row) ? [weaponPiece(row)!] : [])];
  if (limit <= 0 || limit >= all.length) return all;
  const first = droppedPiece(row, creatureId), at = first ? all.indexOf(first) : 0;
  return [...all.slice(Math.max(at, 0)), ...all.slice(0, Math.max(at, 0))].slice(0, limit);
}

/** The ground-looks.json row a dropped piece lies by: an armour piece by its own id (loot:goblin.Helmet), a weapon by its slot whatever body carried it (loot:weapon.Warhammer). */
export const groundItemOf = (piece: string): string => (isWeaponLoot(piece as LootId) ? `loot:weapon.${slotOf(piece as LootId)}` : `loot:${piece}`);

export type Worn = { id: string; tier: string };

/** The hero's outfit: one piece per paperdoll slot, a new take of the same slot replaces the old one (each piece keeps the rung it was won at). PAGE MEMORY ONLY (Lead's ruling): nothing is stored on this device or sent to an account, a reload or leaving the zone restores the account gear. */
export function createOutfit() {
  const slotKey = (id: string): string => paperdollOf(slotOf(id as LootId));
  let worn: Record<string, Worn> = {};
  return {
    take(id: string, tier: string): { replaced?: string } { const slot = slotKey(id), replaced = worn[slot]?.id; worn = { ...worn, [slot]: { id, tier } }; return replaced && replaced !== id ? { replaced } : {}; },
    ids: (): string[] => Object.values(worn).map((w) => w.id).filter((id) => !isWeaponLoot(id as LootId)),
    tierOf: (id: string): string => Object.values(worn).find((w) => w.id === id)?.tier ?? 'Recruit',
    weapon: (): Worn | undefined => worn.main,
    all: (): readonly Worn[] => Object.values(worn),
    clear(): void { worn = {}; },
  };
}

/**
 * The set the hero's figure wears. A LISTED zone is the account gear exactly as it comes (`account`, no change). In an UNLISTED zone (the sandbox) a piece taken from a body REPLACES the account's piece in that
 * paperdoll slot, per slot: the slots nothing was taken for keep the account gear. Weapons are not dressed (the figure's weapon is the sheet's). Pure; `outfit` empty gives back `account`.
 */
export function dressedSet(account: { ids: readonly string[]; tiers: Readonly<Record<string, string>> }, outfit: Pick<ReturnType<typeof createOutfit>, 'ids' | 'tierOf'>, unlisted: boolean): { ids: string[]; tiers: Record<string, string> } {
  if (!unlisted) return { ids: [...account.ids], tiers: { ...account.tiers } };
  const taken = outfit.ids(), slots = new Set(taken.map((id) => paperdollOf(slotOf(id as LootId))));
  const ids = [...account.ids.filter((id) => !slots.has(paperdollOf(slotOf(id as LootId)))), ...taken];
  const tiers: Record<string, string> = Object.fromEntries(Object.entries(account.tiers).filter(([id]) => ids.includes(id)));
  for (const id of taken) tiers[id] = outfit.tierOf(id);
  return { ids, tiers };
}

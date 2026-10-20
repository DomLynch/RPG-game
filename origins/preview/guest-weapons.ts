// A signed-out player's picked-up weapon, wieldable for this session (Zone 1, Lead 2026-10-19: the guest took the Hunter's bow at the Ferry Landing and could not hold it). The take lands in the
// in-memory guest bag (guest-loot.ts); this reads the weapons out of it as the LootIds they wield as (starter-wield.json) and lays them over the device's ledger as a VIEW: the gear sheet lists
// them, Wear sets MAIN HAND, the rig and the world fight read the same ledger. PAGE MEMORY ONLY: the device's stored profile never receives them (the setter strips them), so a reload, leaving
// the zone or signing in brings the account's gear back and nothing is imported or sent. Presentation of a local ledger only: no record, no server, nothing the sim reads.
import { PACK, emptyLoot, fightWeapon, isLootId, isWeaponLoot, type Loot, type LootId } from '../../src/core/index.ts';
import { DEFAULT_WEAPON, type WeaponId } from '../../src/fight/index.ts';

/** The weapon LootIds a guest bag holds: each held item that stands as a weapon piece (`standsAs`: item id -> LootId), once each, in the order taken. */
export function sessionWeapons(items: readonly { item: string }[], standsAs: (item: string) => string | undefined): LootId[] {
  const ids: LootId[] = [];
  for (const { item } of items) { const id = standsAs(item); if (id && isLootId(id) && isWeaponLoot(id) && !ids.includes(id)) ids.push(id); }
  return ids;
}

/** The ledger the sheet shows: the device's with the session weapons owned, the unworn ones in the pack while it has room, and `main` (a session weapon the guest set as MAIN HAND) worn. Pure. */
export function withSession(loot: Loot, ids: readonly LootId[], main: LootId | null): Loot {
  if (!ids.length) return loot;
  const owned = [...loot.owned, ...ids.filter((id) => !loot.owned.includes(id))], equipped = { ...loot.equipped, ...(main && ids.includes(main) ? { main } : {}) };
  const pack = [...(loot.pack ?? [])];
  for (const id of ids) if (id !== equipped.main && !pack.includes(id) && pack.length < PACK.open) pack.push(id);
  return { ...loot, owned, equipped, pack };
}

/** What the device may store: the ledger without any session weapon (owned, pack, worn, provenance). Pure. */
export function withoutSession(loot: Loot, ids: readonly LootId[]): Loot {
  if (!ids.length) return loot;
  const equipped = Object.fromEntries(Object.entries(loot.equipped).filter(([, id]) => !ids.includes(id as LootId))) as Loot['equipped'];
  const taken = loot.taken ? Object.fromEntries(Object.entries(loot.taken).filter(([id]) => !ids.includes(id as LootId))) as Loot['taken'] : undefined;
  return { ...loot, owned: loot.owned.filter((id) => !ids.includes(id)), equipped, ...(loot.pack ? { pack: loot.pack.filter((id) => !ids.includes(id)) } : {}), ...(taken ? { taken } : {}) };
}

/** The weapon a guest wields in the world: the session weapon set as MAIN HAND when the rig can draw it (`carried`), else the default; a device-stored main hand is not read (a guest fought with the longsword before). */
export function guestWeapon(loot: Loot, held: readonly LootId[], carried: readonly WeaponId[]): WeaponId {
  const main = loot.equipped.main;
  return main && held.includes(main) ? fightWeapon(loot, carried) : DEFAULT_WEAPON;
}

/**
 * The profile the gear sheet reads and writes for a guest: `loot` reads the device's ledger with the session weapons laid over it, and a write (the sheet's wear / unwear / stow) is split back, the
 * session weapons kept here (which one is MAIN HAND) and the rest handed to the device's profile. Wearing another main-hand piece, or taking the weapon off, clears it.
 */
export function guestProfile(device: { loot?: Loot }, ids: () => readonly LootId[]): { loot: Loot } {
  let main: LootId | null = null;
  return {
    get loot(): Loot { const held = ids(); if (main && !held.includes(main)) main = null; return withSession(device.loot ?? emptyLoot(), held, main); },
    set loot(next: Loot) {
      const held = ids(), wield = next.equipped.main;
      main = wield && held.includes(wield) ? wield : null;
      device.loot = withoutSession(next, held);
    },
  };
}

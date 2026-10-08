// Fight = state on the creature (seamless Zone 1 combat, step 5; Lead's TOP10 row 5, Dom's max-7-attackers rule). Pure and immutable: the zone's engage
// state is who is fighting whom, nothing else. A creature is `hostile` while it is on some player's engaged list; a player is in combat while their list
// is not empty, and combat ends when it empties (donor: AzerothCore CombatManager, SetInCombatWith / EndCombat; World of Claudecraft enterCombat sets the
// flag on both entities and the renderer only reads it). The list keeps engage order (first in, first listed). Who of the engaged may swing at once (the
// attack-token cap of 3-4) is Combat's sim, not this. Field names are World's (2026-10-08): `hostile` per creature, `engaged` per player.

export const ENGAGE_MAX = 7;   // Dom: up to 7 attackers on one player

export type EngageState = { readonly engaged: ReadonlyMap<string, readonly string[]> };   // player id -> creature ids attacking them, engage order
export type EngageResult = { ok: true; state: EngageState } | { ok: false; reason: 'full' | 'taken' };

export const EMPTY: EngageState = { engaged: new Map() };

export const engagedOf = (s: EngageState, player: string): readonly string[] => s.engaged.get(player) ?? [];
export const inCombat = (s: EngageState, player: string): boolean => engagedOf(s, player).length > 0;
export const hostile = (s: EngageState, creature: string): boolean => holderOf(s, creature) !== null;
export function holderOf(s: EngageState, creature: string): string | null {
  for (const [player, list] of s.engaged) if (list.includes(creature)) return player;
  return null;
}

// The creature aggroes on (or is pulled by) the player. One creature fights one player at a time ('taken' if another holds it); an eighth is refused ('full')
// and stays unengaged, so the caller leaves it circling. Engaging one already on this player's list changes nothing.
export function engage(s: EngageState, player: string, creature: string): EngageResult {
  const holder = holderOf(s, creature);
  if (holder === player) return { ok: true, state: s };
  if (holder !== null) return { ok: false, reason: 'taken' };
  const list = engagedOf(s, player);
  if (list.length >= ENGAGE_MAX) return { ok: false, reason: 'full' };
  return { ok: true, state: withList(s, player, [...list, creature]) };
}

// The creature leaves the fight: killed, ran past its leash home, or broke off at low health (all release the same way).
export function release(s: EngageState, creature: string): EngageState {
  const holder = holderOf(s, creature);
  return holder === null ? s : withList(s, holder, engagedOf(s, holder).filter((c) => c !== creature));
}

// The player died, left the zone or disconnected: every creature on their list is released.
export function releasePlayer(s: EngageState, player: string): EngageState {
  return s.engaged.has(player) ? withList(s, player, []) : s;
}

function withList(s: EngageState, player: string, list: readonly string[]): EngageState {
  const engaged = new Map(s.engaged);
  if (list.length) engaged.set(player, list); else engaged.delete(player);
  return { engaged };
}

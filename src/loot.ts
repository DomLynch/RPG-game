// Loot (beta plan brief 5): visual cosmetics only, no stats. Every armour piece is a draw in src/assets/loot.glb (Scalable Chars' export,
// 2026-09-21), named `<opponent>.<slot>.<material>`; its id here is the name without the material. One fixed armour piece per opponent
// per career sub-rank drops on a win, never a duplicate; nothing is ever lost (the trophy rack keeps everything owned). A weapon piece
// is takeable instead (WEAPON_SLOTS below) and fills the paperdoll's main hand. The paperdoll is the six armour slots plus the two hands;
// the beta opens one locker and greys the rest. Pure: the loader and the journal read this.
import { TITLES, rankFor } from './career.ts';
import type { Tier } from './grades.ts';
import type { WeaponId } from './moves.ts';
import { isOpponentId, type OpponentId } from './roster.ts';

export const ARMOUR_SLOTS = ['Helmet', 'Crest', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots', 'Shield'] as const;   // loot.glb's slots (userData.slot)
// A fallen opponent's weapon is takeable (owner, 2026-09-22: "any item can be taken, armour or weapon"): the slot is the weapon's name, the id `<opponent>.<Weapon>`.
// No draw in loot.glb — the visual is the weapon's equip file (src/assets/weapons/player/<weapon>.glb, the #309 contract) loaded when
// `equipped.main` is set, and the fight is fought with that weapon (moves.ts PLAYER_WEAPONS). Grows with the equip files; whether a
// weapon is OFFERED stays moves.ts PLAYER_WEAPONS_OFFERED (Combat's fairness table), not this list.
export const WEAPON_SLOTS = ['Trident', 'Cleaver', 'Knife', 'Estoc', 'Gladius', 'Scythe', 'Warhammer', 'Maul', 'Longsword'] as const;
export const LOOT_SLOTS = [...ARMOUR_SLOTS, ...WEAPON_SLOTS] as const;
export type LootSlot = (typeof LOOT_SLOTS)[number];
export type WeaponSlot = (typeof WEAPON_SLOTS)[number];
export const isWeaponSlot = (slot: LootSlot): slot is WeaponSlot => (WEAPON_SLOTS as readonly string[]).includes(slot);
export const PAPERDOLL = { head: ['Helmet', 'Crest'], chest: ['Body'], arms: ['Arms'], hands: ['Gloves'], legs: ['Greaves'], feet: ['Boots'], main: WEAPON_SLOTS, off: ['Shield'] } as const satisfies Record<string, readonly LootSlot[]>;
export type Paperdoll = keyof typeof PAPERDOLL;
export type LootId = `${OpponentId}.${LootSlot}`;
// Provenance (Strategy 2026-09-21): where a piece came from, written once at the drop and never edited; the record's short id fills once
// from null when that fight is published (a Share happens after the drop). Cosmetic and historical: the paperdoll reads it, nothing else.
export type Provenance = { opponent: OpponentId; attempt: number; healthLeft: number; recordId: string | null; day: string };
// `declined`: a kill that was offered gear and refused (the lead's shape, 2026-09-22 — the kill recorded with the take omitted, so the
// journal and a replay agree on "offered and refused" without a second source of truth). Newest last, the last 50 kept.
export type Loot = { owned: LootId[]; equipped: Partial<Record<Paperdoll, LootId>>; taken?: Partial<Record<LootId, Provenance>>; declined?: Provenance[] };
export const DECLINED_KEPT = 50;
export const LOCKERS = { open: 1, total: 6 } as const;   // beta: one open locker; lockers 2–6 greyed, no code behind them

// The pieces in loot.glb by opponent, in the file's slot order — every visible armour slot a fallen opponent wears (owner, 2026-09-22:
// "I should be able to pick up any armour or weapon slot"; weapons are the Weapons lane's). Drop order = this order (tests/loot-data.test.ts
// pins the list against the file's draws). An opponent without pieces drops nothing. Scalable Chars appends here when a piece ships.
// A piece may be SHARED: brief 14's gloves are one mesh worn by the whole roster, exported once as `~kit.Gloves` with loot.glb's own
// scene userData mapping `<opponent>.Gloves` to it. The id here stays `<opponent>.<slot>` either way — sharing is a fact about the file,
// never about what a player owns.
// Body is the tunic and what hangs on it (baldric, belt, buckle, studs, collar) in the opponent's own linen; kilts are leg cloth with no
// paperdoll slot and stay the player's. The Goblin's Body carries his trophy necklace, the Pitborn's Arms his bone plates.
export const LOOT: Partial<Record<OpponentId, readonly LootId[]>> = {
  veteran: ['veteran.Helmet', 'veteran.Crest', 'veteran.Body', 'veteran.Arms', 'veteran.Greaves', 'veteran.Boots', 'veteran.Gloves', 'veteran.Shield', 'veteran.Trident'],
  executioner: ['executioner.Helmet', 'executioner.Crest', 'executioner.Body', 'executioner.Arms', 'executioner.Greaves', 'executioner.Boots', 'executioner.Gloves', 'executioner.Scythe'],
  nightborn: ['nightborn.Helmet', 'nightborn.Body', 'nightborn.Arms', 'nightborn.Boots', 'nightborn.Gloves', 'nightborn.Estoc'],
  // His Body is the rag sash and belt worn `over` the player's tunic: a sash covers 26 % of a tunic, so as a `replace` it would undress him (#434, tests/loot.test.ts).
  pitborn: ['pitborn.Helmet', 'pitborn.Body', 'pitborn.Arms', 'pitborn.Greaves', 'pitborn.Boots', 'pitborn.Gloves', 'pitborn.Cleaver'],
  dwarf: ['dwarf.Greaves', 'dwarf.Boots', 'dwarf.Gloves', 'dwarf.Warhammer'],   // Helmet/Body/Arms held (Lead, 2026-09-23 18:4x): the metallic-mask cut left shards; re-cut follows
  goblin: ['goblin.Helmet', 'goblin.Body', 'goblin.Arms', 'goblin.Greaves', 'goblin.Boots', 'goblin.Gloves', 'goblin.Knife'],   // Phase R: the scrap cap, iron shin plates and rag foot bindings
  knight: ['knight.Maul'],   // his Helmet and Body (the Recruit-2 carriers) come post-beta: a .12 cut on untextured Steel read as shards (UV-seam split)
  shieldmaiden: ['shieldmaiden.Helmet', 'shieldmaiden.Body', 'shieldmaiden.Arms', 'shieldmaiden.Greaves', 'shieldmaiden.Boots', 'shieldmaiden.Gloves', 'shieldmaiden.Gladius'],   // Phase R: her six (reference A); the gladius is an equip file, not a draw
  // The Plague Doctor's six (Phase R): cut from his TRELLIS surface on his own baked maps, welded, ratio .5 (PR #590's recipe): loot_dwarf.py --family plaguedoctor --all --boots --slots Helmet,Body,Arms,Gloves,Greaves,Boots --ratio .5 --material PlaguedoctorCloth --color-size 512 --repose warrior. Greaves carries his coat skirt with the legs (bone-dominant).
  plaguedoctor: ['plaguedoctor.Helmet', 'plaguedoctor.Body', 'plaguedoctor.Arms', 'plaguedoctor.Gloves', 'plaguedoctor.Greaves', 'plaguedoctor.Boots', 'plaguedoctor.Longsword'],   // Strategy 2026-09-23: every rung offers its weapon, the longsword included (player/longsword.glb is the hero's own SwordDrawn)
  witch: ['witch.Trident'],   // her Helmet (the hood) and Body (the robe) join when their loot.glb draws are cut (Brief 16's six slots)
};
// The rung each piece is first worn from (the kit floor; server awards read it through src/awards.ts kitAt). Data, not a parameter:
// filling it is a data change, no schema or code change. Empty = every piece worn from Recruit (beta ruling 2026-09-23); the values
// are Multi Chars' to set, post-beta.
export type WornFrom = Partial<Record<LootId, Tier>>;
export const WORN_FROM: WornFrom = {};
export const LOOT_IDS: ReadonlySet<string> = new Set(Object.values(LOOT).flat());
export const isLootId = (value: unknown): value is LootId => typeof value === 'string' && LOOT_IDS.has(value);
export const slotOf = (id: LootId): LootSlot => id.split('.')[1] as LootSlot;
export const isWeaponLoot = (id: LootId): boolean => isWeaponSlot(slotOf(id));
// The weapon a weapon piece is fought with: the slot, lower-cased, is the moves.ts id ('Trident' → 'trident').
export const weaponOf = (id: LootId): WeaponId => { const slot = slotOf(id); if (!isWeaponSlot(slot)) throw new Error(`${id} is not a weapon piece`); return slot.toLowerCase() as WeaponId; };
export const paperdollOf = (slot: LootSlot): Paperdoll => (Object.keys(PAPERDOLL) as Paperdoll[]).find(key => (PAPERDOLL[key] as readonly LootSlot[]).includes(slot))!;
// A piece's name for a line of copy: "the Veteran's helmet".
export const lootName = (id: LootId, opponentName: string): string => `${opponentName}'s ${slotOf(id).toLowerCase()}`;

// The career sub-rank as one number: Recruit I is 0, Legionary I is 5, Origin is 45.
export function subRank(marks: number): number {
  const rank = rankFor(marks);
  return rank.title === 'Origin' ? 45 : TITLES.indexOf(rank.title) * 5 + ['I', 'II', 'III', 'IV', 'V'].indexOf(rank.numeral);
}
// The drop for a win against `opponent` at the sub-rank the fight was fought at: fixed per sub-rank, never a duplicate. Armour only:
// a weapon is never dropped, it is TAKEN — the kill screen's "Take one" choice (lead) offers LOOT[opponent] minus owned, weapons included.
export function dropFor(opponent: OpponentId, marks: number, owned: readonly string[]): LootId | null {
  const pieces = LOOT[opponent]?.filter(id => !isWeaponLoot(id));
  if (!pieces?.length) return null;
  const id = pieces[subRank(marks) % pieces.length];
  return owned.includes(id) ? null : id;
}

// A saved loot record, whatever it came from (this device, the cloud): only known ids, no duplicates, equipped pieces must be owned and
// sit in their own paperdoll slot. Anything else is dropped, never thrown.
export function cleanLoot(value: unknown): Loot {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Loot>;
  const owned = Array.isArray(raw.owned) ? [...new Set(raw.owned.filter(isLootId))] : [];
  const equipped: Loot['equipped'] = {};
  if (raw.equipped && typeof raw.equipped === 'object') for (const [key, id] of Object.entries(raw.equipped)) if (key in PAPERDOLL && isLootId(id) && owned.includes(id) && paperdollOf(slotOf(id)) === key) equipped[key as Paperdoll] = id;
  const taken: NonNullable<Loot['taken']> = {};
  if (raw.taken && typeof raw.taken === 'object') for (const [id, p] of Object.entries(raw.taken)) if (isLootId(id) && owned.includes(id) && cleanProvenance(p)) taken[id] = cleanProvenance(p)!;
  const declined = Array.isArray(raw.declined) ? raw.declined.map(cleanProvenance).filter((p): p is Provenance => !!p).slice(-DECLINED_KEPT) : [];
  return { owned, equipped, ...(Object.keys(taken).length ? { taken } : {}), ...(declined.length ? { declined } : {}) };
}
const DAY = /^\d{4}-\d{2}-\d{2}$/, SHORT_ID = /^[A-Za-z0-9_-]{1,12}$/;   // a share id: minted 1–6 char base-36 since 2026-09-22, or the 8-char form before it (share-store SHARE_ID)
export function cleanProvenance(value: unknown): Provenance | null {
  const p = value as Partial<Provenance> | null;
  if (!p || typeof p !== 'object' || !isOpponentId(p.opponent) || !Number.isSafeInteger(p.attempt) || p.attempt! < 1 || !Number.isSafeInteger(p.healthLeft) || p.healthLeft! < 0 || p.healthLeft! > 1000
    || !(p.recordId === null || (typeof p.recordId === 'string' && SHORT_ID.test(p.recordId))) || typeof p.day !== 'string' || !DAY.test(p.day)) return null;
  return { opponent: p.opponent, attempt: p.attempt!, healthLeft: p.healthLeft!, recordId: p.recordId ?? null, day: p.day };
}
export const emptyLoot = (): Loot => ({ owned: [], equipped: {} });
// The kill where the player left the gear: the same fight fields a take would carry, with no piece.
export const decline = (loot: Loot | undefined, kill: Provenance): Loot => { const l = loot ?? emptyLoot(); return { ...l, declined: [...(l.declined ?? []), kill].slice(-DECLINED_KEPT) }; };
// A new piece joins the rack with its provenance; a piece already owned is left exactly as it was (written once).
export const store = (loot: Loot | undefined, id: LootId, taken?: Provenance): Loot => { const l = loot ?? emptyLoot(); return l.owned.includes(id) ? l : { ...l, owned: [...l.owned, id], ...(taken ? { taken: { ...l.taken, [id]: taken } } : {}) }; };
// The fight's short id, once it exists: fills a null recordId and nothing else.
export const recordTaken = (loot: Loot, id: LootId, recordId: string): Loot => (loot.taken?.[id] && loot.taken[id]!.recordId === null ? { ...loot, taken: { ...loot.taken, [id]: { ...loot.taken[id]!, recordId } } } : loot);
export const wear = (loot: Loot, id: LootId): Loot => (loot.owned.includes(id) ? { ...loot, equipped: { ...loot.equipped, [paperdollOf(slotOf(id))]: id } } : loot);
export const unwear = (loot: Loot, key: Paperdoll): Loot => { const equipped = { ...loot.equipped }; delete equipped[key]; return { ...loot, equipped }; };
// A device record and a cloud record together: nothing is lost (owned and declined are unions, declined kept to the last
// DECLINED_KEPT); the cloud's worn set wins when it has one.
export const sameKill = (a: Provenance, b: Provenance) => a.opponent === b.opponent && a.attempt === b.attempt && a.day === b.day;
export const mergeLoot = (device: Loot | undefined, cloud: Loot): Loot => {
  const declined = [...(cloud.declined ?? []), ...(device?.declined ?? []).filter(k => !cloud.declined?.some(c => sameKill(c, k)))]
    .sort((a, b) => a.day.localeCompare(b.day));   // oldest first, so the cap drops the oldest whichever side holds it
  return cleanLoot({ owned: [...(device?.owned ?? []), ...cloud.owned], equipped: Object.keys(cloud.equipped).length ? cloud.equipped : device?.equipped ?? {}, taken: { ...cloud.taken, ...device?.taken }, declined });
};

// Loot (beta plan brief 5): visual cosmetics only, no stats. Every piece is a draw in src/assets/loot.glb (Scalable Chars' export,
// 2026-09-21), named `<opponent>.<slot>.<material>`; its id here is the name without the material. One fixed piece per opponent per
// career sub-rank drops on a win, never a duplicate; nothing is ever lost (the trophy rack keeps everything owned). The paperdoll is the
// six armour slots plus the two hands; the beta opens one locker and greys the rest. Pure: the loader and the journal read this.
import { TITLES, rankFor } from './career.ts';
import type { OpponentId } from './roster.ts';

export const LOOT_SLOTS = ['Helmet', 'Crest', 'Body', 'Arms', 'Gloves', 'Greaves', 'Boots'] as const;   // the file's slots (userData.slot)
export type LootSlot = (typeof LOOT_SLOTS)[number];
export const PAPERDOLL = { head: ['Helmet', 'Crest'], chest: ['Body'], arms: ['Arms'], hands: ['Gloves'], legs: ['Greaves'], feet: ['Boots'], main: [], off: [] } as const satisfies Record<string, readonly LootSlot[]>;
export type Paperdoll = keyof typeof PAPERDOLL;
export type LootId = `${OpponentId}.${LootSlot}`;
export type Loot = { owned: LootId[]; equipped: Partial<Record<Paperdoll, LootId>> };
export const LOCKERS = { open: 1, total: 6 } as const;   // beta: one open locker; lockers 2–6 greyed, no code behind them

// The pieces in loot.glb by opponent, in drop order (tests/loot-data.test.ts pins this against the file's draws). An opponent without
// pieces drops nothing. Scalable Chars appends here when a piece ships.
export const LOOT: Partial<Record<OpponentId, readonly LootId[]>> = {
  veteran: ['veteran.Helmet', 'veteran.Crest', 'veteran.Greaves'],
  executioner: ['executioner.Helmet', 'executioner.Crest', 'executioner.Greaves'],
  nightborn: ['nightborn.Helmet', 'nightborn.Body', 'nightborn.Boots'],
  pitborn: ['pitborn.Arms'],
  dwarf: ['dwarf.Greaves'],
};
export const LOOT_IDS: ReadonlySet<string> = new Set(Object.values(LOOT).flat());
export const isLootId = (value: unknown): value is LootId => typeof value === 'string' && LOOT_IDS.has(value);
export const slotOf = (id: LootId): LootSlot => id.split('.')[1] as LootSlot;
export const paperdollOf = (slot: LootSlot): Paperdoll => (Object.keys(PAPERDOLL) as Paperdoll[]).find(key => (PAPERDOLL[key] as readonly LootSlot[]).includes(slot))!;
// A piece's name for a line of copy: "the Veteran's helmet".
export const lootName = (id: LootId, opponentName: string): string => `${opponentName}'s ${slotOf(id).toLowerCase()}`;

// The career sub-rank as one number: Recruit I is 0, Legionary I is 5, Origin is 45.
export function subRank(marks: number): number {
  const rank = rankFor(marks);
  return rank.title === 'Origin' ? 45 : TITLES.indexOf(rank.title) * 5 + ['I', 'II', 'III', 'IV', 'V'].indexOf(rank.numeral);
}
// The drop for a win against `opponent` at the sub-rank the fight was fought at: fixed per sub-rank, never a duplicate.
export function dropFor(opponent: OpponentId, marks: number, owned: readonly string[]): LootId | null {
  const pieces = LOOT[opponent];
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
  return { owned, equipped };
}
export const emptyLoot = (): Loot => ({ owned: [], equipped: {} });
export const store = (loot: Loot | undefined, id: LootId): Loot => { const l = loot ?? emptyLoot(); return l.owned.includes(id) ? l : { ...l, owned: [...l.owned, id] }; };
export const wear = (loot: Loot, id: LootId): Loot => (loot.owned.includes(id) ? { ...loot, equipped: { ...loot.equipped, [paperdollOf(slotOf(id))]: id } } : loot);
export const unwear = (loot: Loot, key: Paperdoll): Loot => { const equipped = { ...loot.equipped }; delete equipped[key]; return { ...loot, equipped }; };
// A device record and a cloud record together: nothing is lost (owned is the union); the cloud's worn set wins when it has one.
export const mergeLoot = (device: Loot | undefined, cloud: Loot): Loot => cleanLoot({ owned: [...(device?.owned ?? []), ...cloud.owned], equipped: Object.keys(cloud.equipped).length ? cloud.equipped : device?.equipped ?? {} });

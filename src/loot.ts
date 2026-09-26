// Loot (beta plan brief 5): visual cosmetics only, no stats. Every armour piece is a draw in src/assets/loot.glb (Scalable Chars' export,
// 2026-09-21), named `<opponent>.<slot>.<material>`; its id here is the name without the material. One fixed armour piece per opponent
// per career sub-rank drops on a win, never a duplicate; nothing is ever lost (the trophy rack keeps everything owned). A weapon piece
// is takeable instead (WEAPON_SLOTS below) and fills the paperdoll's main hand. The paperdoll is the six armour slots plus the two hands;
// Store on a worn slot moves the piece into the pack (PACK below): two open slots, three drawn locked. Pure: the loader and the journal read this.
import { TITLES, rankFor } from './career.ts';
import type { Tier } from './grades.ts';
import { PLAYER_WEAPONS, type SkillId, type WeaponId } from './moves.ts';
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
// `tier` (Block A tier dressing, Lead 2026-09-24): the level (1..10) of the rung the opponent was met at — tierAt(marks before the win), the
// formula the server's awardFor uses. A RECORD only: nothing paints by it (Strategy's ruling C, #705: a worn piece keeps its source
// opponent's finish at every rung). Gear stats come from the server award, never from this field. Absent (every piece taken before it existed) = Recruit.
export type Provenance = { opponent: OpponentId; attempt: number; healthLeft: number; recordId: string | null; day: string; tier?: number };
// `declined`: a kill that was offered gear and refused (the lead's shape, 2026-09-22 — the kill recorded with the take omitted, so the
// journal and a replay agree on "offered and refused" without a second source of truth). Newest last, the last 50 kept.
export type Loot = { owned: LootId[]; equipped: Partial<Record<Paperdoll, LootId>>; pack?: LootId[]; taken?: Partial<Record<LootId, Provenance>>; declined?: Provenance[]; skill?: SkillId };
// A skill (SCOPE #729 item 8, docs/briefs/skill-witch-arm.md): a kill of its opponent offers the move as a tile beside her armour, one or
// the other, one take per win. It is TAKEN, not grafted, and stored with the loot so it saves and syncs like a piece. One move per duel:
// `skill` is the one equipped; the fight hands it to the player's fighter at the draw (match.ts). The label is the move's name, plain.
// `opponent` null: the hero's own move, never offered by a kill. The day-one skill (Dom, 2026-09-25: "Hero starts with Pommel Strike; one
// skill slot; a take swaps it"): a profile with no skill stored fights with DAY_ONE_SKILL, and a take overwrites the one slot.
export const SKILLS: Record<SkillId, { opponent: OpponentId | null; name: string }> = { witchfire: { opponent: 'witch', name: 'Witch-fire' }, pommel: { opponent: null, name: 'Pommel Strike' },
  lunge: { opponent: 'nightborn', name: 'Estoc Lunge' }, reaping: { opponent: 'executioner', name: 'Reaping Blow' }, shove: { opponent: 'veteran', name: 'Scutum Shove' }, jab: { opponent: 'goblin', name: 'Dirty Jab' }, cleave: { opponent: 'pitborn', name: 'Butcher\'s Cleave' }, stomp: { opponent: 'dwarf', name: 'Anvil Stomp' }, miasma: { opponent: 'plaguedoctor', name: 'Miasma' }, ironrush: { opponent: 'knight', name: 'Iron Rush' }, hewer: { opponent: 'shieldmaiden', name: 'Shield-Hewer' } };   // SkillId is the sim's (moves.ts)
// PULLED from the SCOPE 8 batch (Strategy 07:24): offered by no kill until their numbers pass the battery — the Estoc Lunge (22/24, estoc on
// the Goblin, bar 12), the Iron Rush (22/24) and the Dirty Jab (14/24 after its knob round, reach 1.0). Their MoveDefs and record codes stay (append only); a fix ships as its own bump.
export const DAY_ONE_SKILL: SkillId = 'pommel';
export const equippedSkill = (loot: Loot | undefined): SkillId => loot?.skill ?? DAY_ONE_SKILL;
export const isSkillId = (value: unknown): value is SkillId => typeof value === 'string' && Object.hasOwn(SKILLS, value);
export const skillOf = (opponent: OpponentId): SkillId | null => (Object.keys(SKILLS) as SkillId[]).find((id) => SKILLS[id].opponent === opponent) ?? null;
export const DECLINED_KEPT = 50;
// The pack under WORN on the Profile tab (Strategy, from Dom's profile screenshot 2026-09-24: Store unwore a piece and it vanished). Two open
// slots; slots 3–5 are drawn locked, a cosmetic placeholder with no price and no shop behind it.
export const PACK = { open: 2, total: 5 } as const;

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
  nightborn: ['nightborn.Helmet', 'nightborn.Body', 'nightborn.Arms', 'nightborn.Greaves', 'nightborn.Boots', 'nightborn.Gloves', 'nightborn.Estoc'],
  // His Body is the rag sash and belt worn `over` the player's tunic: a sash covers 26 % of a tunic, so as a `replace` it would undress him (#434, tests/loot.test.ts).
  pitborn: ['pitborn.Helmet', 'pitborn.Body', 'pitborn.Arms', 'pitborn.Greaves', 'pitborn.Boots', 'pitborn.Gloves', 'pitborn.Cleaver'],
  // Phase R six: the iron helm, war-belt and apron, shoulder plates and greaves built in build-warrior.mjs (@build:dwarf-*), the boots
  // (loot/dwarf_boots.glb, heel to toe) cut by loot_dwarf.py, and the shared gloves.
  dwarf: ['dwarf.Helmet', 'dwarf.Body', 'dwarf.Arms', 'dwarf.Greaves', 'dwarf.Boots', 'dwarf.Gloves', 'dwarf.Warhammer'],
  goblin: ['goblin.Helmet', 'goblin.Body', 'goblin.Arms', 'goblin.Greaves', 'goblin.Boots', 'goblin.Gloves', 'goblin.Knife'],   // Phase R: the scrap cap, iron shin plates and rag foot bindings
  knight: ['knight.Helmet', 'knight.Body', 'knight.Arms', 'knight.Gloves', 'knight.Greaves', 'knight.Boots', 'knight.Maul'],   // Phase R: his six, cut from his own welded TRELLIS body, re-posed onto the hero rest, on his baked KnightIron maps (#603)
  shieldmaiden: ['shieldmaiden.Helmet', 'shieldmaiden.Body', 'shieldmaiden.Arms', 'shieldmaiden.Greaves', 'shieldmaiden.Boots', 'shieldmaiden.Gloves', 'shieldmaiden.Shield', 'shieldmaiden.Gladius'],   // Phase R: her six (reference A) and her own board shield (@build:shieldmaiden-shield); the gladius is an equip file, not a draw
  // The Plague Doctor's six (Phase R): cut from his TRELLIS surface on his own baked maps, welded, ratio .5 (PR #590's recipe): loot_dwarf.py --family plaguedoctor --all --boots --slots Helmet,Body,Arms,Gloves,Greaves,Boots --ratio .5 --slot-ratio Boots=1 --material PlaguedoctorCloth --color-size 512 --repose warrior; Helmet and Boots `conform` out over the player's crown and toes (loot.json). Greaves carries his coat skirt with the legs (bone-dominant) and stays at .5: .35 and .2 shatter it (docs/character-references/loot-weld/).
  plaguedoctor: ['plaguedoctor.Helmet', 'plaguedoctor.Body', 'plaguedoctor.Arms', 'plaguedoctor.Gloves', 'plaguedoctor.Greaves', 'plaguedoctor.Boots', 'plaguedoctor.Longsword'],   // Strategy 2026-09-23: every rung offers its weapon, the longsword included (player/longsword.glb is the hero's own SwordDrawn)
  witch: ['witch.Helmet', 'witch.Body', 'witch.Arms', 'witch.Gloves', 'witch.Greaves', 'witch.Boots', 'witch.Trident'],   // all six built shells (build-warrior.mjs): hood, a laced bodice and cross-gartered wraps worn under the robe, bracers, boots; Gloves the shared pair
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
// The armour an opponent is dressed in for a fight (tier dressing): his pieces minus the weapon, and minus the shield when he fights
// two-handed. A two-hander stows the shield on his back (moves.ts Grip), and back-stow is not built, so it stays off rather than hang
// on the forearm across his haft. A one-hander (the Shieldmaiden's gladius) brings it up, which is the shield as authored.
// A Recruit's kit carries no crest (Strategy, #705): the plume is the first thing a Legionary earns, and at 375 it is what tells the two apart.
// Presentation only — the award rule (awards.ts kitAt, WORN_FROM) is untouched, so a crest taken at Recruit is still the player's to wear.
// Pieces an opponent offers but does not wear over his own scan (Character Main, #705 stills): the Dwarf's Greaves are iron shells fitted
// to the PLAYER's shin and float off his calves when retargeted, and his Boots are cut from his own scan surface, so worn over it they z-fight.
// The Plague Doctor's hat: his cloth's roughness (~.56) on a flat crown and brim throws the sun's highlight at the camera when he faces it
// (the sun is behind him), so it read as a silver hat over his own hooded scan. He fights hatless, as before #705; the hero still wears it.
const NOT_WORN: Partial<Record<OpponentId, readonly LootSlot[]>> = { dwarf: ['Greaves', 'Boots'], plaguedoctor: ['Helmet'] };
export const kitWorn = (opponent: OpponentId, twoHanded: boolean, tier?: Tier): LootId[] => (LOOT[opponent] ?? []).filter(id => !isWeaponLoot(id) && !(twoHanded && slotOf(id) === 'Shield') && !(tier === 'Recruit' && slotOf(id) === 'Crest') && !NOT_WORN[opponent]?.includes(slotOf(id)));
// The weapon a weapon piece is fought with: the slot, lower-cased, is the moves.ts id ('Trident' → 'trident').
export const weaponOf = (id: LootId): WeaponId => { const slot = slotOf(id); if (!isWeaponSlot(slot)) throw new Error(`${id} is not a weapon piece`); return slot.toLowerCase() as WeaponId; };
// The weapon a career or rematch fight is fought with: the equipped main hand when the hero rig carries it (moves.ts PLAYER_WEAPONS),
// else the longsword. main.ts gives it to the Match and the scene draws the Match's, so the hand and the simulation never disagree.
// `carried`: the weapons this build can draw (scene.ts CARRIED_WEAPONS, those with an equip file).
export const fightWeapon = (loot: Loot | undefined, carried: readonly WeaponId[] = PLAYER_WEAPONS): WeaponId => {
  const weapon = loot?.equipped.main && weaponOf(loot.equipped.main);
  return weapon && PLAYER_WEAPONS.includes(weapon) && carried.includes(weapon) ? weapon : 'longsword';
};
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
  if (raw.equipped && typeof raw.equipped === 'object') for (const [key, id] of Object.entries(raw.equipped)) {
    // Keyed by PAPERDOLL key (legs, chest), never slot name (Greaves, Body): a wrong key is dropped, and said so — it once hid a live check's answer.
    if (!(key in PAPERDOLL)) { console.warn(`loot: equipped key "${key}" is not a paperdoll key (${Object.keys(PAPERDOLL).join(', ')}); ${String(id)} is not worn`); continue; }
    if (isLootId(id) && owned.includes(id) && paperdollOf(slotOf(id)) === key) equipped[key as Paperdoll] = id;
  }
  // The pack: owned, unworn, no duplicates, at most PACK.open.
  const worn = Object.values(equipped);
  const pack = Array.isArray(raw.pack) ? raw.pack.filter((id, i, all): id is LootId => isLootId(id) && owned.includes(id) && !worn.includes(id) && all.indexOf(id) === i).slice(0, PACK.open) : null;
  const taken: NonNullable<Loot['taken']> = {};
  if (raw.taken && typeof raw.taken === 'object') for (const [id, p] of Object.entries(raw.taken)) if (isLootId(id) && owned.includes(id) && cleanProvenance(p)) taken[id] = cleanProvenance(p)!;
  const declined = Array.isArray(raw.declined) ? raw.declined.map(cleanProvenance).filter((p): p is Provenance => !!p).slice(-DECLINED_KEPT) : [];
  return { owned, equipped, ...(pack ? { pack } : {}), ...(Object.keys(taken).length ? { taken } : {}), ...(declined.length ? { declined } : {}), ...(isSkillId(raw.skill) ? { skill: raw.skill } : {}) };
}
const DAY = /^\d{4}-\d{2}-\d{2}$/, SHORT_ID = /^[A-Za-z0-9_-]{1,12}$/;   // a share id: minted 1–6 char base-36 since 2026-09-22, or the 8-char form before it (share-store SHARE_ID)
export function cleanProvenance(value: unknown): Provenance | null {
  const p = value as Partial<Provenance> | null;
  if (!p || typeof p !== 'object' || !isOpponentId(p.opponent) || !Number.isSafeInteger(p.attempt) || p.attempt! < 1 || !Number.isSafeInteger(p.healthLeft) || p.healthLeft! < 0 || p.healthLeft! > 1000
    || !(p.recordId === null || (typeof p.recordId === 'string' && SHORT_ID.test(p.recordId))) || typeof p.day !== 'string' || !DAY.test(p.day)) return null;
  return { opponent: p.opponent, attempt: p.attempt!, healthLeft: p.healthLeft!, recordId: p.recordId ?? null, day: p.day, ...(Number.isSafeInteger(p.tier) && p.tier! >= 1 && p.tier! <= TITLES.length ? { tier: p.tier } : {}) };
}
export const emptyLoot = (): Loot => ({ owned: [], equipped: {} });
// The kill where the player left the gear: the same fight fields a take would carry, with no piece.
export const decline = (loot: Loot | undefined, kill: Provenance): Loot => { const l = loot ?? emptyLoot(); return { ...l, declined: [...(l.declined ?? []), kill].slice(-DECLINED_KEPT) }; };
// A new piece joins the rack with its provenance; a piece already owned is left exactly as it was (written once).
export const store = (loot: Loot | undefined, id: LootId, taken?: Provenance): Loot => { const l = loot ?? emptyLoot(); return l.owned.includes(id) ? l : { ...l, owned: [...l.owned, id], ...(taken ? { taken: { ...l.taken, [id]: taken } } : {}) }; };
// The fight's short id, once it exists: fills a null recordId and nothing else.
export const recordTaken = (loot: Loot, id: LootId, recordId: string): Loot => (loot.taken?.[id] && loot.taken[id]!.recordId === null ? { ...loot, taken: { ...loot.taken, [id]: { ...loot.taken[id]!, recordId } } } : loot);
// Wearing a piece takes it out of the pack if it was there: a piece is worn or packed, never both.
export const wear = (loot: Loot, id: LootId): Loot => (loot.owned.includes(id) ? { ...loot, equipped: { ...loot.equipped, [paperdollOf(slotOf(id))]: id }, ...(loot.pack ? { pack: loot.pack.filter((p) => p !== id) } : {}) } : loot);
export const unwear = (loot: Loot, key: Paperdoll): Loot => { const equipped = { ...loot.equipped }; delete equipped[key]; return { ...loot, equipped }; };
// A record from before the pack (no `pack` at all): Store had unworn its pieces into nothing. Its owned, unworn pieces go into the pack, so
// what Dom lost comes back; profile.ts applies this once, at load. A record that has a pack, even an empty one, is left as it is.
export const recoverPack = (loot: Loot): Loot => {
  if (loot.pack) return loot;
  const worn = Object.values(loot.equipped), pack = loot.owned.filter((id) => !worn.includes(id)).slice(0, PACK.open);
  return pack.length ? { ...loot, pack } : loot;
};
export const packFull = (loot: Loot) => (loot.pack?.length ?? 0) >= PACK.open;
// Store: the worn piece leaves its slot for the first open pack slot. A full pack refuses (the journal disables the button and says why).
export const stow = (loot: Loot, key: Paperdoll): Loot => {
  const id = loot.equipped[key];
  return id && !packFull(loot) ? { ...unwear(loot, key), pack: [...(loot.pack ?? []), id] } : loot;
};
// A take into an occupied slot (the kill-screen loot panel): the piece it replaces goes into the pack when there is room. With the pack
// full it would leave the Profile tab, so the panel asks first (takeWouldDrop) and the take goes through only on the player's word.
export const displacedBy = (loot: Loot, id: LootId): LootId | null => { const held = loot.equipped[paperdollOf(slotOf(id))]; return held && held !== id ? held : null; };
export const takeWouldDrop = (loot: Loot, id: LootId) => !!displacedBy(loot, id) && packFull(loot);
export const wearTaken = (loot: Loot, id: LootId): Loot => {
  const held = displacedBy(loot, id);
  return wear(held && !packFull(loot) ? { ...loot, pack: [...(loot.pack ?? []), held] } : loot, id);
};
// Wear from the pack: the piece leaves the pack for its slot, and whatever that slot held takes the pack place it left.
export const wearFromPack = (loot: Loot, id: LootId): Loot => {
  const at = loot.pack?.indexOf(id) ?? -1;
  if (at < 0) return loot;
  const displaced = loot.equipped[paperdollOf(slotOf(id))], pack = [...loot.pack!];
  if (displaced) pack[at] = displaced; else pack.splice(at, 1);
  return { ...wear(loot, id), pack };
};
// A device record and a cloud record together (the sign-in merge in account.ts): nothing is lost (owned and declined are unions,
// declined kept to the last DECLINED_KEPT). The worn set is the account's once the account owns anything, an emptied one included: a
// device that unwore everything and saved, then an older device signing in, must not bring the old worn set back (audit 2026-09-24, A).
// A device-worn piece the account never owned is the device's alone: it stays worn when the cloud leaves that slot empty, else it goes
// to the pack while there is room (cleanLoot caps the pack; it comes last, so a full pack drops it, never a saved piece).
// Provenance is written once at the drop and the record's id fills later: per piece the fuller side wins, so a device still holding
// null never blanks a Watch link the account already has.
export const sameKill = (a: Provenance, b: Provenance) => a.opponent === b.opponent && a.attempt === b.attempt && a.day === b.day;
export const mergeLoot = (device: Loot | undefined, cloud: Loot): Loot => {
  const declined = [...(cloud.declined ?? []), ...(device?.declined ?? []).filter(k => !cloud.declined?.some(c => sameKill(c, k)))]
    .sort((a, b) => a.day.localeCompare(b.day));   // oldest first, so the cap drops the oldest whichever side holds it
  const equipped: Loot['equipped'] = { ...(cloud.owned.length ? cloud.equipped : device?.equipped ?? {}) }, spilled: LootId[] = [];
  if (cloud.owned.length) for (const [key, id] of Object.entries(device?.equipped ?? {}) as [Paperdoll, LootId][]) {
    if (cloud.owned.includes(id)) continue;
    if (equipped[key]) spilled.push(id); else equipped[key] = id;
  }
  const taken: NonNullable<Loot['taken']> = { ...cloud.taken };
  for (const [id, p] of Object.entries(device?.taken ?? {}) as [LootId, Provenance][]) if (!taken[id] || (p.recordId !== null && taken[id]!.recordId === null)) taken[id] = p;
  const pack = [...(cloud.pack ?? []), ...(device?.pack ?? []), ...spilled];
  const skill = device?.skill ?? cloud.skill;   // the equipped move is the device's word, like the worn set; a new device takes the account's
  return cleanLoot({ owned: [...(device?.owned ?? []), ...cloud.owned], equipped, ...(cloud.pack || device?.pack || spilled.length ? { pack } : {}), taken, declined, ...(skill ? { skill } : {}) });
};

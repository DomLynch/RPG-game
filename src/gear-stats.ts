// Gear stats (brief 19, deliverable 1): what a kit is worth, as four multipliers. Data only — nothing here changes a fight yet, and
// `src/loot.ts`'s "visual cosmetics only, no stats" header stands until deliverable 5 puts a Loadout into `stepDuel`.
//
// The seam this file is built for: the simulation takes a `Loadout` — the four numbers, already resolved — and never sees a tier, a
// slot or a table. That is why this module is deliberately NOT in eslint.config.js's SIM list and never needs to be: the resolution
// happens once, outside the duel, and only its four results cross the boundary. It also keeps `src/duel.ts` free of any import of
// `loot.ts` or `grades.ts`, which the sim-boundary test would refuse.
//
// The bar (brief 19): gear tilts, skill decides. A full Origin set moves any one stat by at most 25% against no gear, so a naked
// fighter can still beat every rung under its fairness cap. The caps below are the whole of that promise and `tests/gear-stats.test.ts`
// holds them exactly.
import { levelOf, type Tier } from './grades.ts';
import { ARMOUR_SLOTS, WEAPON_SLOTS, isWeaponSlot, type LootSlot } from './loot.ts';

// The four multipliers a fight is fought with. Attack and Defence/Poise multiply, Stamina IS the pool (points, not a factor) — the
// shapes differ because what they scale differs, and pretending Stamina is a multiplier would hide that the naked pool is 100.
export type Loadout = { attack: number; defence: number; poise: number; stamina: number };
// No gear: the exact identity. Every number here is what the game does today, so a naked loadout must be a no-op at the seam and a
// naked fight must replay byte-identical to a record made before stats existed (that is deliverable 2's flag, proved against this).
export const NAKED: Loadout = { attack: 1, defence: 1, poise: 1, stamina: 100 };

// What a full Origin set is worth. Attack gets the smallest range on purpose (brief 19): raw damage is what kill timings, finisher
// windows and the fight-length pins are measured against, so it moves least. Poise moves most because posture is the stat a player
// feels without reading a number.
export const CAPS = { attack: 1.15, defence: 0.80, poise: 0.75, stamina: 125 } as const;

// One number per tier per slot (brief 19: "no hand values per piece"). The number is a slot's COVERAGE WEIGHT, and the tier scales it
// linearly by its place on the ladder ABOVE THE BOTTOM RUNG — `levelOf - 1` over 9, so Recruit is 0 and Origin its whole weight. So the
// table below plus `levelOf` IS the 10 × 7 grid; `tests/gear-stats.test.ts` pins every one of its cells so a weight cannot be nudged
// without the grid saying so.
//
// Recruit is the identity and that is a design decision, not an off-by-one (Strategy, 2026-09-22, overriding this lane's first cut,
// which had rags at a tenth of a cap). Brief 14's Recruit is rag & scrap on 2 of 6 slots — salvage, not armour — and the naked bracket
// is only a real guarantee if the new player actually standing in rags is inside it. So Legionary leather is the first tilt in the game,
// and a Recruit fights on skill alone with nothing subtracted.
//
// The weights are a judgement about how much of a fighter each slot actually covers, and they are mine (Stats lane, 2026-09-22), not
// inherited from a brief: the tunic is the largest area and the legs the next, the head is small but is where the kill lands, and the
// gloves are the least armour a man wears. They sum to 100 so that a full set is exactly one whole cap and no constant is fitted.
//
// The Crest is 0 and that is the design, not an omission: brief 19 says it carries nothing, because it is a mark of rank and not
// armour. It stays in the table rather than being left out so that every armour slot resolves, and 0 reads as a decision.
export const SLOT_WEIGHT: Record<LootSlot, number> = {
  Helmet: 20, Crest: 0, Body: 30, Arms: 12, Gloves: 8, Greaves: 18, Boots: 12,
  // A weapon carries the whole Attack pool by itself, at its own tier — there is one main hand, so a weapon's weight is not shared
  // with anything and every weapon weighs the same. Which weapon you hold is `moves.ts`'s business (reach, speed, the fairness table);
  // this number is only how much its TIER is worth.
  Trident: 100, Cleaver: 100, Knife: 100, Estoc: 100, Scythe: 100, Warhammer: 100,
};
// The full armour pool and the full weapon pool, in the points `SLOT_WEIGHT × (levelOf - 1)` yields. Both are 900 (100 weight × the 9
// rungs above Recruit), which is what makes a full Origin set land exactly on a cap rather than near it.
export const FULL_POINTS = 900;

// What one piece is worth. Pure arithmetic on two integers, so the same on any platform — no transcendentals, nothing the arm64/x64
// digest drift (docs/state/lead.md) can reach.
export const pointsFor = (tier: Tier, slot: LootSlot): number => SLOT_WEIGHT[slot] * (levelOf(tier) - 1);

// A kit as the paperdoll holds it: at most one piece per slot, each at its own tier. A map rather than a list so a duplicated slot
// cannot be expressed at all.
export type Kit = Partial<Record<LootSlot, Tier>>;

// The one place a points total becomes numbers, and the only place a cap is spelled out (lead's condition, 2026-09-22). Beta runs
// Defence, Poise and Stamina off a SINGLE armour total, so a piece cannot be heavy but soft — at a ≤25% ceiling that difference sits
// under the noise floor and a second column would double the tuning surface for an effect nobody can feel. Should Strategy ever want
// it, this function is where the split lands: `armour` becomes two totals and the three lines below read different ones. Nothing
// outside this function knows how many totals there are, so that stays a data change.
//
// Every multiplier is one integer division of exact integers, so a full set is exactly its cap (72000/90000, not 0.7999999…) and a
// partial kit is the correctly-rounded double of an exact ratio on every machine. The literals 15/20/25 below are the caps' distances
// from 1 (0.15, 0.20, 0.25) times 90000 / FULL_POINTS, and the test derives the caps from the table rather than repeating them.
function multipliers(armour: number, weapon: number): Loadout {
  return {
    attack: (90000 + 15 * weapon) / 90000,
    defence: (90000 - 20 * armour) / 90000,
    poise: (90000 - 25 * armour) / 90000,
    stamina: (90000 + 25 * armour) / 900,
  };
}

// The four multipliers for a kit. Total function: it validates nothing and throws nothing, because a fight must start with whatever
// the player is actually wearing.
export function loadoutFor(kit: Kit): Loadout {
  let armour = 0, weapon = 0;
  for (const [slot, tier] of Object.entries(kit) as [LootSlot, Tier][]) {
    const points = pointsFor(tier, slot);
    // The paperdoll holds ONE main hand, so a kit naming two weapons is already malformed; the better one wins rather than the last
    // one iterated, so the answer never depends on key order.
    if (isWeaponSlot(slot)) weapon = Math.max(weapon, points);
    else armour += points;
  }
  return multipliers(armour, weapon);
}

// A full set at one tier: the six armour slots (never the Crest, which is worth nothing) and, given a weapon slot, that weapon too.
// The Origin case is the cap row the whole brief is measured against, so it is worth having one name rather than six call sites
// spelling it out.
export const fullSet = (tier: Tier, weapon?: (typeof WEAPON_SLOTS)[number]): Kit =>
  Object.fromEntries([...ARMOUR_SLOTS.filter(slot => SLOT_WEIGHT[slot] > 0), ...(weapon ? [weapon] : [])].map(slot => [slot, tier]));

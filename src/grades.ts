// Grade materials (brief 14): the same kit piece at eight qualities. A grade is a MATERIAL VARIANT, never a different mesh — the draw,
// its triangles and the coverage it gives the wearer are identical at leather and at ruby, only the factors on the material change.
// That is the rule #434 bought: a `replace` piece must not undress the player, and it cannot if grading never touches geometry
// (tests/loot.test.ts holds the coverage floor; tests/grades.test.ts holds this file to factors only).
//
// One shared kit library dressed eight ways is what makes a 60-opponent roster affordable: 8 grades × N pieces costs N meshes, not 8N.
// Pure data — no three, no loader. The runtime reads `gradeFor(tier, material)` and writes the factors onto the piece's own material.
import type { LootId } from './loot.ts';

// The lead's settled order, poorest to richest (OPPONENTS.grade.tier). The ladder is read as an order in places: `TIERS.indexOf` is the
// only ranking there is, so nothing may be inserted in the middle without a look at what reads it.
export const TIERS = ['leather', 'bronze', 'iron', 'steel', 'blackened', 'vanadium', 'gold', 'ruby'] as const;
export type Tier = (typeof TIERS)[number];
export const isTier = (value: unknown): value is Tier => typeof value === 'string' && (TIERS as readonly string[]).includes(value);

// What a grade can repaint. The cloth is NOT here: a tunic's colour is the opponent's house dye (OPPONENTS.grade.house), so a Recruit
// and a champion of the same house wear the same linen over different metal — which is how a house reads across a roster.
export type Finish = { color: string; metalness: number; roughness: number };
export type Grade = { metal: Finish; trim: Finish; leather: Finish };

// The palette material names that loot.glb actually carries (scripts/build-warrior.mjs's palette), mapped to what a grade repaints.
// `null` is deliberate exemption, not an oversight: bone is bone at every grade, and the Nightborn's Ruby crown is authored artwork the
// owner approved (2026-09-18), not a tier — note that tier 'ruby' and material 'Ruby' are different things and neither implies the other.
// Gambeson_<opponent> is the house dye's business. A material missing from this table is a build error, not a silent pass-through.
export const CLASS_OF: Record<string, keyof Grade | 'cloth' | null> = {
  Steel: 'metal', Bronze: 'metal', DwarfIron: 'metal', Blade: 'metal',
  'Antique brass': 'trim',
  Leather: 'leather', Wrap: 'leather',
  Heraldry: 'cloth', Gambeson: 'cloth',
  Bone: null, BoneWorn: null, Ruby: null, Skin: null, Hair: null, Eyes: null,
};
// `<opponent>.<slot>.<material>`: the material is everything after the second dot, and a per-opponent tunic (Gambeson_veteran) grades as
// its base (Gambeson).
export const materialOf = (drawName: string): string => drawName.split('.').slice(2).join('.');
export const classOf = (material: string): keyof Grade | 'cloth' | null | undefined => CLASS_OF[material.split('_')[0] === 'Gambeson' ? 'Gambeson' : material];

export const GRADES: Record<Tier, Grade> = {
  // Poor kit: iron fittings gone dull, no shine to catch the sun. The metal barely reads as metal, which is the point.
  leather:   { metal: { color: '#6b5a48', metalness: .35, roughness: .95 }, trim: { color: '#7a6348', metalness: .40, roughness: .85 }, leather: { color: '#4a3a2c', metalness: 0, roughness: .90 } },
  // The hero's own furniture (build-warrior's 'Antique brass'): worn bronze, warm and soft-edged.
  bronze:    { metal: { color: '#8a6a3c', metalness: .85, roughness: .50 }, trim: { color: '#a07a42', metalness: .85, roughness: .45 }, leather: { color: '#57402d', metalness: 0, roughness: .85 } },
  iron:      { metal: { color: '#5a5b5e', metalness: .90, roughness: .62 }, trim: { color: '#6d6a63', metalness: .85, roughness: .60 }, leather: { color: '#4b3b30', metalness: 0, roughness: .82 } },
  // The hero's Steel and bronze furniture: the middle of the ladder is what the player already wears, so a mid-grade opponent reads as his equal.
  steel:     { metal: { color: '#c3c7ca', metalness: .92, roughness: .30 }, trim: { color: '#8a6a3c', metalness: .85, roughness: .50 }, leather: { color: '#3e3a36', metalness: 0, roughness: .80 } },
  blackened: { metal: { color: '#2b2d31', metalness: .95, roughness: .38 }, trim: { color: '#4a4036', metalness: .90, roughness: .45 }, leather: { color: '#2a2622', metalness: 0, roughness: .78 } },
  // The top three are the only ones allowed to be bright: a hard blue-grey, then gold, then the dark ruby metal of the Nightborn's crown.
  vanadium:  { metal: { color: '#7d879a', metalness: 1, roughness: .18 }, trim: { color: '#59637a', metalness: 1, roughness: .22 }, leather: { color: '#2c3038', metalness: 0, roughness: .72 } },
  gold:      { metal: { color: '#c9a233', metalness: 1, roughness: .22 }, trim: { color: '#e0c463', metalness: 1, roughness: .18 }, leather: { color: '#3a2e1c', metalness: 0, roughness: .70 } },
  ruby:      { metal: { color: '#4a0d18', metalness: .80, roughness: .35 }, trim: { color: '#c9a233', metalness: 1, roughness: .22 }, leather: { color: '#2a1418', metalness: 0, roughness: .70 } },
};

// The factors to write onto one draw's material, or null to leave it alone (bone, authored artwork, and cloth — cloth is the house dye).
export function gradeFor(tier: Tier, material: string): Finish | null {
  const group = classOf(material);
  return group && group !== 'cloth' ? GRADES[tier][group] : null;
}
// The house dye for a draw, or null if the draw is not cloth. Kept beside gradeFor so a caller walks a piece's draws once.
export function houseFor(house: string, material: string): string | null {
  return classOf(material) === 'cloth' ? house : null;
}
// A grade record as it will sit on OPPONENTS (lead, 2026-09-22). Declared here so the shape is one thing; the field is the lead's to add,
// and nothing in this lane reads OPPONENTS until it exists on trunk.
export type GradeRecord = { level: number; tier: Tier; kit: LootId[]; epithet: string; house: string };

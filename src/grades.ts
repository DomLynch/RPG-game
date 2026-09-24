// Grade materials (brief 14): the same kit piece at eight qualities. A grade is a MATERIAL VARIANT, never a different mesh — the draw,
// its triangles and the coverage it gives the wearer are identical at leather and at ruby, only the factors on the material change.
// That is the rule #434 bought: a `replace` piece must not undress the player, and it cannot if grading never touches geometry
// (tests/loot.test.ts holds the coverage floor; tests/grades.test.ts holds this file to factors only).
//
// One shared kit library dressed eight ways is what makes a 60-opponent roster affordable: 8 grades × N pieces costs N meshes, not 8N.
// Pure data — no three, no loader. The runtime reads `gradeFor(tier, material)` and writes the factors onto the piece's own material.
import { TITLES, rankFor } from './career.ts';
import type { LootId } from './loot.ts';
import type { OpponentId } from './roster.ts';

// The ladder is the CAREER ladder: a tier and a rank are the same word (owner via Strategy, 2026-09-22), so the journal can say
// "Praetorian iron" and mean one thing. `TIERS` is `career.ts`'s `TITLES` itself, not a copy — ten names that cannot drift from the
// ranks they're named for, and `tests/grades.test.ts` holds them identical. A level is the rank's place on it, 1..10.
export const TIERS = TITLES;
export type Tier = (typeof TIERS)[number];
export const isTier = (value: unknown): value is Tier => typeof value === 'string' && (TIERS as readonly string[]).includes(value);
export const levelOf = (tier: Tier): number => TIERS.indexOf(tier) + 1;

// The TIER an opponent is MET at (brief 14's kit ladder, brief 19's stats). Deliberately NOT a field on `ROSTER`: the same Centurion
// is a Recruit's Centurion early and a Praetorian's later, so the tier belongs to the FIGHT, not to the recipe. Derived, never stored
// — a tier and a rank are the same word (`TIERS` is `TITLES` itself), so this is that one title rather than a second ladder that could
// drift from it. A held recipe answers too: a saved encounter must still resolve.
//
// It lives HERE rather than in roster.ts because roster.ts is a simulation module (eslint.config.js `SIM`, tests/sim-boundary.test.ts)
// and may import only its siblings. A cosmetic ladder does not get to widen the simulation boundary, and a fighter's career rung has
// no business inside a deterministic replay.
export const tierAt = (marks: number): Tier => rankFor(marks).title;
// An opponent as a fight sees him: who he is, and the rung he is met at. The shape the kit floor (loot.ts `WORN_FROM`) and the tier
// stats both read. Nothing consumes it yet, which is deliberate — it lands once so two lanes build on one field.
export type OpponentAt = { id: OpponentId; tier: Tier };
export const opponentAt = (id: OpponentId, marks: number): OpponentAt => ({ id, tier: tierAt(marks) });

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
  Wood: null,   // the Shieldmaiden's shield boards: wood at every grade (her signature splits wood off it); its rim and boss are Steel and grade
};
// `<opponent>.<slot>.<material>`: the material is everything after the second dot, and a per-opponent tunic (Gambeson_veteran) grades as
// its base (Gambeson).
export const materialOf = (drawName: string): string => drawName.split('.').slice(2).join('.');
// A piece cut from a TRELLIS surface (scripts/character/loot_dwarf.py) wears its family's baked maps as `<Family>Iron` (grades as metal)
// or `<Family>Cloth` (a coat or hood: cloth), so a new family needs no row here.
export const classOf = (material: string): keyof Grade | 'cloth' | null | undefined => {
  const key = material.split('_')[0] === 'Gambeson' ? 'Gambeson' : material;
  if (Object.hasOwn(CLASS_OF, key)) return CLASS_OF[key];   // null is a deliberate exemption, not a miss
  return /^[A-Z][a-z]+Iron$/.test(material) ? 'metal' : /^[A-Z][a-z]+Cloth$/.test(material) ? 'cloth' : undefined;
};

export const GRADES: Record<Tier, Grade> = {
  // Rag and scrap: salvaged iron gone to RUST, matte, no shine to catch the sun, on raw tan hide. A Recruit looks like a man who was handed
  // what was left. Strategy (2026-09-24, #705): the two lowest rungs must differ in more than hue at 375 in the pit — so Recruit is light,
  // orange and dead matte, and wears no crest (loot.ts kitWorn).
  Recruit:    { metal: { color: '#8c5a38', metalness: .20, roughness: 1 }, trim: { color: '#8a6a4a', metalness: .20, roughness: .95 }, leather: { color: '#7a5c40', metalness: 0, roughness: .98 } },
  // Leather: clean black oiled hide, blackened iron and BRIGHT brass studs — the first kit that was made rather than found, and the dark
  // rung against Recruit's rust.
  Legionary:  { metal: { color: '#2c2a28', metalness: .60, roughness: .50 }, trim: { color: '#b08440', metalness: .85, roughness: .38 }, leather: { color: '#231812', metalness: 0, roughness: .55 } },
  // Bone: pale ivory plate, almost no metal at all. The one rung that steps sideways instead of up in brightness — it reads as a
  // different KIND of armour, not a better metal, which is what keeps the low ladder from being three shades of brown.
  Gladiator:  { metal: { color: '#cbbd9a', metalness: .05, roughness: .72 }, trim: { color: '#a8946b', metalness: .10, roughness: .68 }, leather: { color: '#b8a07c', metalness: 0, roughness: .80 } },   // whitened buff hide under the bone: a taken body piece reads its rung by its straps (#705)
  // Copper: warm and soft, the first real metal — and deliberately a shade off bronze so Veteran and Champion don't read as one rung.
  Veteran:    { metal: { color: '#9c5f3a', metalness: .80, roughness: .55 }, trim: { color: '#b87a4a', metalness: .80, roughness: .48 }, leather: { color: '#54402f', metalness: 0, roughness: .84 } },
  // Bronze: the hero's own furniture (build-warrior's 'Antique brass'), worn and warm.
  Champion:   { metal: { color: '#8a6a3c', metalness: .85, roughness: .50 }, trim: { color: '#a07a42', metalness: .85, roughness: .45 }, leather: { color: '#57402d', metalness: 0, roughness: .85 } },
  Praetorian: { metal: { color: '#5a5b5e', metalness: .90, roughness: .62 }, trim: { color: '#6d6a63', metalness: .85, roughness: .60 }, leather: { color: '#4b3b30', metalness: 0, roughness: .82 } },
  // Steel: the hero's own palette, so a Master reads as the player's equal rather than a step above or below him.
  Master:     { metal: { color: '#c3c7ca', metalness: .92, roughness: .30 }, trim: { color: '#8a6a3c', metalness: .85, roughness: .50 }, leather: { color: '#3e3a36', metalness: 0, roughness: .80 } },
  Primus:     { metal: { color: '#2b2d31', metalness: .95, roughness: .38 }, trim: { color: '#4a4036', metalness: .90, roughness: .45 }, leather: { color: '#2a2622', metalness: 0, roughness: .78 } },
  // The top two are the only ones allowed to be bright: emerald, then gold with ruby furniture. Emerald and not a second black —
  // Dom, 2026-09-22: blackened at 8 and black vanadium at 9 read flat against each other, and the ninth rung has to announce itself.
  Invictus:   { metal: { color: '#0f5a3c', metalness: .85, roughness: .18 }, trim: { color: '#2f8f63', metalness: .90, roughness: .22 }, leather: { color: '#1b2f26', metalness: 0, roughness: .72 } },
  Origin:     { metal: { color: '#c9a233', metalness: 1, roughness: .22 }, trim: { color: '#4a0d18', metalness: .80, roughness: .35 }, leather: { color: '#3a2e1c', metalness: 0, roughness: .70 } },
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
// `level` and `tier` say the same thing twice by design (the lead's shape) — `levelOf` is the one that derives it, so a record whose
// level and tier disagree is a data error, not a second meaning.

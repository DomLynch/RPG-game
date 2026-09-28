// Weapon shapes per rank band (Strategy/Lead 2026-09-28, weapon-variants brief): three shapes per weapon type, PLAIN at rank levels 1–3,
// CRAFTED 4–7, ORNATE 8–10. A band's file (`public/weapons/shapes/<weapon>-<band>.glb`, one mesh, hand at the origin, length along +Y, the
// brief's envelope: scripts/weapon-fit-check.mjs) replaces the weapon's own draws for the rung the fight is at: the opponent's at the rung he
// is met at, the player's own weapon at the player's own rung (his career rank: shapesFor). The rank tint (rank-tint.ts, characters.ts
// `grade`) still supplies the material on top, unchanged. Presentation only: the sim's blade tables and the node's contact extras stay, so
// reach and contact never move. No band file = the weapon as shipped today.
//
// A weapon ships once its trio passes the fit check (--profile=new) and Dom's stills: the maul first (SHIPPING_SHAPES). The dev flag
// `?shapes=maul-plain,estoc-cane-ornate` names the band files present under /weapons/shapes/ (a local drop), over the table.
import type { WeaponId } from './moves.ts';

export type Band = 'plain' | 'crafted' | 'ornate';
export const BANDS: readonly Band[] = ['plain', 'crafted', 'ornate'];
export const bandOf = (level: number): Band => level >= 8 ? 'ornate' : level >= 4 ? 'crafted' : 'plain';

// The band files that ship, per shape: a weapon id (`maul`), or an opponent's own shape on a weapon's envelope (`estoc-cane`).
export type ShapeTable = Readonly<Partial<Record<string, readonly Band[]>>>;
// The maul ships (Dom 2026-09-28 "implement the maul"): GPT's v2 trio, pinned by sha256 in tests/weapon-shapes.test.ts. The crafted file is a
// placeholder until GPT's v3 replaces it by a file swap and a sha, no code change.
export const SHIPPING_SHAPES: ShapeTable = { maul: ['plain', 'crafted', 'ornate'] };
// An opponent's own shape for a weapon (Dom via Strategy 2026-09-28): the Plague Doctor's estoc is a cane sword (cane-sword-brief.md, the
// estoc's envelope). Absent files fall back to the stock weapon's band, then to today's part, the rank tint over either.
export const SHAPE_OVERRIDES: Readonly<Record<string, Partial<Record<WeaponId, string>>>> = { plaguedoctor: { estoc: 'estoc-cane' } };

const ENTRY = /^([a-z]+(?:-[a-z]+)?)-(plain|crafted|ornate)$/;
export function shapesFlag(search: string): Record<string, Band[]> | undefined {
  const value = new URLSearchParams(search).get('shapes');
  if (!value) return undefined;
  const table: Record<string, Band[]> = {};
  for (const entry of value.split(',')) {
    const match = ENTRY.exec(entry.trim());
    if (match) (table[match[1]] ??= []).push(match[2] as Band);
  }
  return table;
}
// Whether any band file is on at all: with none (an empty table), scene.ts never resolves, loads or reshapes: every weapon is exactly
// its shipped part, untouched.
export const shapesOn = (table: ShapeTable): boolean => Object.values(table).some((bands) => bands?.length);

// The band file for this weapon at this rank level (on this opponent, if he has his own shape), or none (the weapon keeps its own shape).
export const shapeFor = (weapon: WeaponId, level: number, shipping: ShapeTable = SHIPPING_SHAPES, opponent?: string): string | undefined => {
  const band = bandOf(level), own = opponent ? SHAPE_OVERRIDES[opponent]?.[weapon] : undefined;
  const stem = [own, weapon].find((name) => name && shipping[name]?.includes(band));
  return stem ? `/weapons/shapes/${stem}-${band}.glb` : undefined;
};

// Both fighters' band files for a fight (scene.ts reshape): the player's own weapon at the PLAYER's rung (his career rank), the opponent's at the
// rung he is met at (Strategy's brief: "the player's rank for his own weapon"). Undefined = that weapon keeps today's part.
export type ShapeFight = { player?: WeaponId; opponent?: WeaponId; opponentId: string; playerLevel: number; opponentLevel: number };
export const shapesFor = (fight: ShapeFight, shipping: ShapeTable = SHIPPING_SHAPES): { player?: string; opponent?: string } => ({
  player: fight.player && shapeFor(fight.player, fight.playerLevel, shipping),
  opponent: fight.opponent && shapeFor(fight.opponent, fight.opponentLevel, shipping, fight.opponentId),
});

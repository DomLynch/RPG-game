// Weapon shapes per rank band (Strategy/Lead 2026-09-28, weapon-variants brief): three shapes per weapon type, PLAIN at rank levels 1–3,
// CRAFTED 4–7, ORNATE 8–10. A band's file (`public/weapons/shapes/<weapon>-<band>.glb`, one mesh, hand at the origin, length along +Y, the
// brief's envelope: scripts/weapon-fit-check.mjs) replaces the weapon's own draws for the rung the fight is at: the opponent's at the rung he
// is met at, the player's own weapon at the player's (the same rung: main.ts tierAt(careerMarks())). The rank tint (rank-tint.ts, characters.ts
// `grade`) still supplies the material on top, unchanged. Presentation only: the sim's blade tables and the node's contact extras stay, so
// reach and contact never move. No band file = the weapon as shipped today.
//
// Nothing ships yet: SHIPPING_SHAPES stays empty until GPT's files pass the fit check and Dom's stills. The dev flag
// `?shapes=maul-plain,maul-ornate` names the band files present under /weapons/shapes/ (a local drop), over the table.
import type { WeaponId } from './moves.ts';

export type Band = 'plain' | 'crafted' | 'ornate';
export const BANDS: readonly Band[] = ['plain', 'crafted', 'ornate'];
export const bandOf = (level: number): Band => level >= 8 ? 'ornate' : level >= 4 ? 'crafted' : 'plain';

// The band files that ship, per weapon. Empty until a trio passes (the maul first, the proof).
export const SHIPPING_SHAPES: Readonly<Partial<Record<WeaponId, readonly Band[]>>> = {};

const ENTRY = /^([a-z]+)-(plain|crafted|ornate)$/;
export function shapesFlag(search: string): Partial<Record<WeaponId, Band[]>> | undefined {
  const value = new URLSearchParams(search).get('shapes');
  if (!value) return undefined;
  const table: Partial<Record<WeaponId, Band[]>> = {};
  for (const entry of value.split(',')) {
    const match = ENTRY.exec(entry.trim());
    if (match) (table[match[1] as WeaponId] ??= []).push(match[2] as Band);
  }
  return table;
}

// Whether any band file is on at all: with none (the shipping table today), scene.ts never resolves, loads or reshapes: every weapon is
// exactly today's part, untouched.
export const shapesOn = (table: Readonly<Partial<Record<WeaponId, readonly Band[]>>>): boolean => Object.values(table).some((bands) => bands?.length);
// The band file for this weapon at this rank level, or none (the weapon keeps its own shape).
export const shapeFor = (weapon: WeaponId, level: number, shipping: Readonly<Partial<Record<WeaponId, readonly Band[]>>> = SHIPPING_SHAPES): string | undefined => {
  const band = bandOf(level);
  return shipping[weapon]?.includes(band) ? `/weapons/shapes/${weapon}-${band}.glb` : undefined;
};

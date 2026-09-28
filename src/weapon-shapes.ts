// Weapon shapes per rank (Strategy/Lead 2026-09-28, weapon-variants brief): GPT's painted shapes, today three per weapon type (PLAIN at rank
// levels 1–3, CRAFTED 4–7, ORNATE 8–10), wired PER RANK: each weapon has a ten-entry rank → file table (SHIPPING_SHAPES), so a later file for
// one rank (Dom: unique 8, 9 and 10 after launch) is a new file and one table entry, no code change. A file (`public/weapons/shapes/<file>.glb`,
// one mesh, hand at the origin, length along +Y, the brief's envelope: scripts/weapon-fit-check.mjs) replaces the weapon's own draws: the
// opponent's at the rung he is met at, the player's own weapon at the player's own rung (his career rank: shapesFor). Its finish is GPT's
// painted one: no rank tint over it (Strategy 2026-09-28, characters.ts `reshape`). Presentation only: the sim's blade tables and the node's
// contact extras stay, so reach and contact never move. No file for a rank = the weapon as shipped today, the rank tint over it as before.
//
// Every file ships pinned by sha256 in tests/weapon-shapes.test.ts. The dev flag `?shapes=maul-plain,estoc-cane-ornate` names band files
// present under /weapons/shapes/ (a local drop), over the table.
import type { WeaponId } from './moves.ts';

export type Band = 'plain' | 'crafted' | 'ornate';
export const BANDS: readonly Band[] = ['plain', 'crafted', 'ornate'];
export const bandOf = (level: number): Band => level >= 8 ? 'ornate' : level >= 4 ? 'crafted' : 'plain';

// The file per rank level for each shape (index 0 = rank 1): a weapon id (`maul`), or an opponent's own shape on a weapon's envelope
// (`estoc-cane`). Undefined = that rank keeps today's part.
export type RankFiles = readonly (string | undefined)[];
export type ShapeTable = Readonly<Partial<Record<string, RankFiles>>>;
export const RANK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
// A stem's band files laid over the ten ranks (the dev flag; a table row written by band).
export const byBand = (stem: string, bands: readonly Band[]): RankFiles => RANK_LEVELS.map((level) => bands.includes(bandOf(level)) ? `${stem}-${bandOf(level)}` : undefined);
// What ships (Dom 2026-09-28 "implement the maul"; Strategy 22:3x/23:1x the other trios, one PR per weapon): GPT's painted files, one per
// band for now (rank 1–3 plain, 4–7 crafted, 8–10 ornate). The maul's crafted is a placeholder until GPT's v3 (a file swap).
export const SHIPPING_SHAPES: ShapeTable = {
  //          1                   2                   3                   4                     5                     6                     7                     8                    9                    10
  maul:      ['maul-plain',      'maul-plain',      'maul-plain',      'maul-crafted',      'maul-crafted',      'maul-crafted',      'maul-crafted',      'maul-ornate',      'maul-ornate',      'maul-ornate'],
};
// An opponent's own shape for a weapon (Dom via Strategy 2026-09-28): the Plague Doctor's estoc is a cane sword (cane-sword-brief.md, the
// estoc's envelope). An absent rank falls back to the stock weapon's file at that rank, then to today's part.
export const SHAPE_OVERRIDES: Readonly<Record<string, Partial<Record<WeaponId, string>>>> = { plaguedoctor: { estoc: 'estoc-cane' } };

const ENTRY = /^([a-z]+(?:-[a-z]+)?)-(plain|crafted|ornate)$/;
export function shapesFlag(search: string): ShapeTable | undefined {
  const value = new URLSearchParams(search).get('shapes');
  if (!value) return undefined;
  const bands: Record<string, Band[]> = {};
  for (const entry of value.split(',')) {
    const match = ENTRY.exec(entry.trim());
    if (match) (bands[match[1]] ??= []).push(match[2] as Band);
  }
  return Object.fromEntries(Object.entries(bands).map(([stem, list]) => [stem, byBand(stem, list)]));
}
// Whether any shape file is on at all: with none (an empty table), scene.ts never resolves, loads or reshapes: every weapon is exactly
// its shipped part, untouched.
export const shapesOn = (table: ShapeTable): boolean => Object.values(table).some((ranks) => ranks?.some(Boolean));

// The file for this weapon at this rank level (on this opponent, if he has his own shape), or none (the weapon keeps its own shape).
export const shapeFor = (weapon: WeaponId, level: number, shipping: ShapeTable = SHIPPING_SHAPES, opponent?: string): string | undefined => {
  const own = opponent ? SHAPE_OVERRIDES[opponent]?.[weapon] : undefined;
  const file = [own, weapon].map((name) => name ? shipping[name]?.[level - 1] : undefined).find(Boolean);
  return file ? `/weapons/shapes/${file}.glb` : undefined;
};

// Both fighters' shape files for a fight (scene.ts reshape): the player's own weapon at the PLAYER's rung (his career rank), the opponent's at the
// rung he is met at (Strategy's brief: "the player's rank for his own weapon"). Undefined = that weapon keeps today's part.
export type ShapeFight = { player?: WeaponId; opponent?: WeaponId; opponentId: string; playerLevel: number; opponentLevel: number };
export const shapesFor = (fight: ShapeFight, shipping: ShapeTable = SHIPPING_SHAPES): { player?: string; opponent?: string } => ({
  player: fight.player && shapeFor(fight.player, fight.playerLevel, shipping),
  opponent: fight.opponent && shapeFor(fight.opponent, fight.opponentLevel, shipping, fight.opponentId),
});

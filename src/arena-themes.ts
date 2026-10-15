// Arenas 2 and 3 (owner 2026-09-23, via Strategy: "create arena 2 and arena 3 now, and put them on rotation"). One place, three
// looks: the geometry, the play radius, the ring wall and the floor height are Arena 1's (LAYOUT in arena.ts) — the simulation never
// knows which arena it is in. A theme is presentation only: its own floor material and wall masonry (the same generators with other
// parameters), its sky, fog and light, its wall-top cloth, and its crowd's density and dress.
// Pure data, no three.js: the texture worker imports the texture half of it.
import type { OpponentId } from './fight/moves.ts';
import { LADDER } from './ladder.ts';
import { arenaRule } from './arena-rules.ts';
import THEME_DATA from './arena-themes.json' with { type: 'json' };
export { WEATHER_ROWS, weatherRow, FLOOR_ROWS, DUST_TONES, type WeatherRow, type FloorRow, type DustToneRow } from './arena-rows.ts';

type RGB = [number, number, number];
export type SkyLook = { base: RGB; sun: RGB; ground: RGB; sunV?: number };   // sunV: the sun's height on the dome (0.77 = Arena 1's)
// The masonry: course count, blocks per course, how dark the joints print (0.5 = Arena 1's ashlar; near 0 reads as plaster), block hues.
export type WallStyle = { courses: number; blocks: [number, number]; mortar: number; hues: RGB[] };
// floor: 'sand' is Arena 1's gravelled sand; 'flag' paves the pit with the wall generator; clay overlays the sand (textures.ts).
// patch: the world-space mask over the pit (textures.ts patchPixels) — a tone mottle by default, standing water, or old blood.
export type Floor = 'sand' | 'flag' | 'clay';
export type Patch = Floor | 'puddle' | 'blood';
export type TextureLook = { floor: Floor; patch?: Patch; sand: RGB; sandSeed: number; stone: RGB; stoneSeed: number; wall?: WallStyle; sky: SkyLook };
// Weather: what the one Points cloud does (arena.ts). ash drifts (Arena 1), embers rise and glow, rain falls as streaks, dust hangs
// low, drips fall from the dark. Count, sprite size (m) and opacity are the cost and the read.
export type Weather = { kind: string; color: string; count: number; size: number; opacity: number };
export type ArenaTheme = {
  id: ArenaKey; name: string; textures: TextureLook;
  fog: string; fogDensity: number; hemisphere: [string, string, number]; sun: [string, number]; exposure: number;
  // Wall-top cloth: two alternating dyes, its [width, drop] against Arena 1's banner, the tear seed. Crowd: garment dyes (six, like
  // CROWD_DYES), their brightness, and how full the stands are (Arena 1 = 1).
  banners: [string, string]; banner: [number, number]; bannerSeed: number;
  dyes: string[]; crowd: number; fill: number;
  motes: string; plain: string; gateLight: number;
  drape: boolean;   // cloths also hang on the podium wall's face, where the fighting camera sees them (the walkway banners are above its frame)
  // Optional, Arena 1 when absent: the key light's position (scene.ts; flicker sways it like firelight so shadows move), the weather
  // cloud, the floor's roughness (low = wet: it mirrors the sky; puddles go lower still), additive shafts of light from above.
  light?: { sun: [number, number, number]; flicker?: number }; weather?: Weather; wet?: number; shafts?: number;
  flame?: number;   // brazier flame height, x Arena 1's old flame (1 when absent)
  tiers?: number;   // how many stand tiers climb behind the podium wall (5 when absent): fewer lets the far world show over them
  parapet?: boolean;   // false: no outer wall behind the top tier
  colonnade?: boolean;   // false: no columns on the top walkway either (they stood across the far world), so the stands end against the far world   // how many stand tiers climb behind the podium wall (5 when absent): fewer lets the far world show over them
  gate?: boolean;   // false: no gate, posts, arch or portcullis (a wall too low to hold one)
  wallTop?: number;   // podium wall height in metres (2.6 when absent); the gate scales with it
  cliff?: boolean;   // true: no wall, rim or far ground: the sand ends in a sheer drop with a rock face under it, braziers and banners on the floor's last metre (Dom 2026-10-06, Arena 1)
  flatStands?: boolean;   // true: the crowd stands on trodden ground outside the border, no stone steps (Dom 2026-10-03 look test 4)
  standsDrop?: number;   // metres every stand tread (and its crowd) sits lower, so the far world shows over them (Dom 2026-10-03)
  backdropDrop?: number;   // metres the painted far world sits lower
  backdropTurn?: number;   // ring yaw: which part of the painting faces the fight camera (0.3 centres the statue at 40 m)
  backdropScale?: number;   // <1 brings the painted ring in (40 m x scale) at the same angular size
  backdropRepeat?: number;   // copies of the painting round the ring (8): more copies, each narrower
  backdropTall?: number;   // the ring's height factor: <1 shrinks the painting vertically
  spectators?: boolean;   // false: no crowd
  backdrop?: string;   // a painted far world (sky, cliffs, temples) on a ring behind the wall, in place of the ash ridges
};
export type ArenaKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | 'a' | 'b' | 'c' | 'd';

// The themes are rows (arena-themes.json): Arena 1's numbers exactly as arena.ts / scene.ts / textures.ts / crowd.ts had them before the themes (its maps are byte-identical), the ten painted
// arenas (Dom 2026-10-06, his own paintings: the same rule, Arena 1 with only the far world swapped: a name and a backdrop URL each), and the four older generated looks a-d (A The Night Pit,
// B The Rain Yard, C Blood Sand, D The Sunken Cistern; owner 2026-09-24 "2A only a floor and a warm tint on the same walls"). A new painted arena is one entry in `painted`.
export const ARENA_THEMES: Record<ArenaKey, ArenaTheme> = (() => {
  const base = THEME_DATA.arena1 as unknown as ArenaTheme, themes: Record<string, ArenaTheme> = { '1': base };
  for (const p of THEME_DATA.painted) themes[p.id] = { ...base, ...(p as unknown as Partial<ArenaTheme>) };
  for (const l of THEME_DATA.looks) themes[l.id] = l as unknown as ArenaTheme;
  return themes as Record<ArenaKey, ArenaTheme>;
})();
// Owner 2026-09-24 (via Strategy): "get all arenas, they are all good" — all five ride the ladder, two rungs each, in the order
// they were made. The order is PROVISIONAL: Dom chooses the final rung → arena mapping later; that pick edits this one line.
export const ARENA_PICK: Record<1 | 2 | 3 | 4 | 5, ArenaKey> = { 1: '1', 2: '2', 3: '3', 4: 'c', 5: 'd' };
// THE ROTATION SEAM: an opponent → an arena. The ladder band decides (rungs 1–2 Arena 1, 3–4 Arena 2, 5–6 Arena 3, 7–8 C, 9–10 D). Per-fight
// random would be this one line: `return ARENA_THEMES[ARENA_PICK[(1 + Math.floor(Math.random() * 5)) as 1 | 2 | 3 | 4 | 5]]`.
// Next reloads the page (main.ts), so a band change swaps the arena inside the same load that fetches the next rig: never mid-fight,
// never on a rematch, and only one arena is ever resident.
// The painted arenas a career fight can come up in (Lead + Dom 2026-10-06, "all live"): Arena 1 and Dom's ten paintings. The first fight is always
// Arena 1 (no stored arena); after that a shuffle-bag, no arena twice in a row (ladder.ts nextArena). 'a'-'d' are the older generated looks and stay out.
export const ARENA_ROTATION: readonly ArenaKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
export const isRotationArena = (k: unknown): k is ArenaKey => ARENA_ROTATION.includes(k as ArenaKey);
export const arenaBand = (rung: number): 1 | 2 | 3 | 4 | 5 => (rung <= 0 ? 1 : Math.min(Object.keys(ARENA_PICK).length, Math.ceil(rung / arenaRule('rungsPerArena')))) as 1 | 2 | 3 | 4 | 5;   // rungsPerArena is an arena-rules row
export function arenaFor(opponent: OpponentId, override?: string): ArenaTheme {
  if (override && override in ARENA_THEMES) return ARENA_THEMES[override as ArenaKey];
  const rung = LADDER.findIndex(o => o.id === opponent) + 1;   // 0 for a held or unknown id: Arena 1
  return ARENA_THEMES[ARENA_PICK[arenaBand(rung)]];
}

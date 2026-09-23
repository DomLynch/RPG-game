// Arenas 2 and 3 (owner 2026-09-23, via Strategy: "create arena 2 and arena 3 now, and put them on rotation"). One place, three
// looks: the geometry, the play radius, the ring wall and the floor height are Arena 1's (LAYOUT in arena.ts) — the simulation never
// knows which arena it is in. A theme is presentation only: its own floor material and wall masonry (the same generators with other
// parameters), its sky, fog and light, its wall-top cloth, and its crowd's density and dress.
// Pure data, no three.js: the texture worker imports the texture half of it.
import type { OpponentId } from './moves.ts';
import { LADDER } from './ladder.ts';

type RGB = [number, number, number];
export type SkyLook = { base: RGB; sun: RGB; ground: RGB };
// The masonry: course count, blocks per course, how dark the joints print (0.5 = Arena 1's ashlar; near 0 reads as plaster), block hues.
export type WallStyle = { courses: number; blocks: [number, number]; mortar: number; hues: RGB[] };
// floor: 'sand' is Arena 1's gravelled sand; 'flag' paves the pit with the wall generator; clay/frost/moss overlay the sand (textures.ts).
export type Floor = 'sand' | 'flag' | 'clay' | 'frost' | 'moss';
export type TextureLook = { floor: Floor; sand: RGB; sandSeed: number; stone: RGB; stoneSeed: number; wall?: WallStyle; sky: SkyLook };
export type ArenaTheme = {
  id: ArenaKey; name: string; textures: TextureLook;
  fog: string; fogDensity: number; hemisphere: [string, string, number]; sun: [string, number]; exposure: number;
  // Wall-top cloth: two alternating dyes, its [width, drop] against Arena 1's banner, the tear seed. Crowd: garment dyes (six, like
  // CROWD_DYES), their brightness, and how full the stands are (Arena 1 = 1).
  banners: [string, string]; banner: [number, number]; bannerSeed: number;
  dyes: string[]; crowd: number; fill: number;
  motes: string; plain: string; gateLight: number;
  drape: boolean;   // cloths also hang on the podium wall's face, where the fighting camera sees them (the walkway banners are above its frame)
};
export type ArenaKey = '1' | '2a' | '2b' | '3a' | '3b';

const ONE: RGB = [1, 1, 1];
// Arena 1's numbers, exactly as arena.ts / scene.ts / textures.ts / crowd.ts had them before the themes: its maps are byte-identical.
const ARENA_1: ArenaTheme = {
  id: '1', name: 'The Ash Pit', textures: { floor: 'sand', sand: ONE, sandSeed: 7, stone: ONE, stoneSeed: 11, sky: { base: [169, 168, 156], sun: [70, 52, 30], ground: [128, 104, 78] } },
  fog: '#a9a89c', fogDensity: 0.018, hemisphere: ['#c9cfc6', '#4a4238', 1.6], sun: ['#ffe2b8', 4.2], exposure: 1.3,
  banners: ['#472622', '#7d7469'], banner: [1, 1], bannerSeed: 31,
  dyes: ['#453538', '#30353d', '#514033', '#535451', '#3e4837', '#62503a'], crowd: 1, fill: 1,
  motes: '#847b6e', plain: '#4a463f', gateLight: 0.55, drape: false,
};
// Two labelled options per new arena, for the owner to pick from (same frame as Arena 1); the rotation uses ARENA_PICK below.
export const ARENA_THEMES: Record<ArenaKey, ArenaTheme> = {
  '1': ARENA_1,
  // 2A — The Ember Pit: sun-baked red clay cracked into plates, a brick wall, a low orange sun through smoke, a packed crowd in reds
  // and ochres, long crimson hangings.
  '2a': {
    id: '2a', name: 'The Ember Pit', textures: { floor: 'clay', sand: [1.18, 0.99, 0.88], sandSeed: 23, stone: [1.14, 0.9, 0.76], stoneSeed: 29,
      wall: { courses: 14, blocks: [6, 9], mortar: 0.62, hues: [[1.08, 0.94, 0.88], [1, 0.9, 0.84], [1.12, 0.98, 0.9], [0.94, 0.86, 0.82], [1.04, 0.96, 0.9], [0.9, 0.84, 0.8]] },
      sky: { base: [178, 124, 96], sun: [92, 48, 18], ground: [120, 78, 56] } },
    fog: '#957c6c', fogDensity: 0.02, hemisphere: ['#d8bea8', '#4a3026', 1.45], sun: ['#ffc298', 4.0], exposure: 1.25,
    banners: ['#6a1a12', '#9a7038'], banner: [1, 1.2], bannerSeed: 47,
    dyes: ['#5a2420', '#6a3a1e', '#4a2a22', '#7a5a2c', '#3a2a24', '#6a2a1c'], crowd: 1, fill: 1.35,
    motes: '#a8683c', plain: '#4a3328', gateLight: 0.5, drape: true,
  },
  // 2B — The Moss Ruin: a lime-plastered wall gone green, moss in the low ground, a grey rain-light, a thin crowd in drab wool, short
  // tattered cloths. (Replaces Torch Night: at night the opponent went near-black on a phone — Lead/Strategy readability bar.)
  '2b': {
    id: '2b', name: 'The Moss Ruin', textures: { floor: 'moss', sand: [1.04, 1.05, 1.0], sandSeed: 23, stone: [0.92, 0.98, 0.9], stoneSeed: 29,
      wall: { courses: 5, blocks: [2, 3], mortar: 0.12, hues: [[1, 1, 1], [0.94, 1.0, 0.92], [0.9, 0.96, 0.88], [1.02, 1.02, 0.98], [0.96, 0.98, 0.94], [0.88, 0.92, 0.86]] },
      sky: { base: [150, 158, 156], sun: [24, 24, 20], ground: [98, 104, 84] } },
    fog: '#9aa29c', fogDensity: 0.024, hemisphere: ['#c8d2cc', '#44483c', 1.75], sun: ['#e8eadc', 3.4], exposure: 1.3,
    banners: ['#3a4430', '#6e6a58'], banner: [0.9, 0.7], bannerSeed: 59,
    dyes: ['#3e4636', '#4a4a3e', '#36403a', '#545244', '#404838', '#4e4638'], crowd: 0.95, fill: 0.6,
    motes: '#8a9280', plain: '#3e4438', gateLight: 0.3, drape: true,
  },
  // 3A — The Frost Pit: rime on frozen ground, a wall of huge rough-hewn blocks, an overcast white sky with snow in the air, a sparse
  // crowd in furs, long stiff pennants.
  '3a': {
    id: '3a', name: 'The Frost Pit', textures: { floor: 'frost', sand: [0.86, 0.89, 0.97], sandSeed: 37, stone: [0.94, 0.99, 1.08], stoneSeed: 41,
      wall: { courses: 3, blocks: [1, 3], mortar: 0.55, hues: [[1, 1, 1], [0.94, 0.97, 1.04], [0.9, 0.93, 0.98], [1.02, 1.02, 1.04], [0.86, 0.88, 0.92], [0.96, 0.98, 1.02]] },
      sky: { base: [198, 208, 216], sun: [28, 30, 34], ground: [150, 150, 152] } },
    fog: '#c3cbd2', fogDensity: 0.026, hemisphere: ['#e2eaf2', '#5a5e66', 1.7], sun: ['#e9f0ff', 3.3], exposure: 1.2,
    banners: ['#1e2a3c', '#8c8c88'], banner: [0.62, 1.3], bannerSeed: 67,
    dyes: ['#4a4038', '#5a5048', '#3a3834', '#2e3440', '#6a5e50', '#44403c'], crowd: 1.05, fill: 0.7,
    motes: '#f4f6fa', plain: '#6c7078', gateLight: 0.18, drape: true,
  },
  // 3B — The Sun Court: a paved floor of worn limestone flags, dressed sandstone in fine courses, a deep clear sky and a hard white sun,
  // a full crowd in linen, wide sun awnings along the wall.
  '3b': {
    id: '3b', name: 'The Sun Court', textures: { floor: 'flag', sand: [1.06, 1.0, 0.9], sandSeed: 37, stone: [1.18, 0.99, 0.78], stoneSeed: 41,
      wall: { courses: 9, blocks: [3, 5], mortar: 0.35, hues: [[1, 1, 1], [1.03, 1.0, 0.96], [0.98, 0.97, 0.95], [1.04, 1.01, 0.96], [1.0, 0.98, 0.94], [0.96, 0.95, 0.93]] },
      sky: { base: [118, 150, 192], sun: [120, 100, 60], ground: [150, 120, 80] } },
    fog: '#b9c6d2', fogDensity: 0.012, hemisphere: ['#d0e2f6', '#6a5438', 1.7], sun: ['#fff3da', 4.8], exposure: 1.2,
    banners: ['#7c2a18', '#d6c6a0'], banner: [1.6, 0.55], bannerSeed: 71,
    dyes: ['#8a8070', '#7a6a58', '#9a8a70', '#6a3a2a', '#5a5a60', '#8a7a5a'], crowd: 1, fill: 1.3,
    motes: '#c8b080', plain: '#7a6a50', gateLight: 0.3, drape: true,
  },
};
// The owner's pick per arena (one line each): 2A and 3B, Dom's lean via Lead 2026-09-23.
export const ARENA_PICK: Record<1 | 2 | 3, ArenaKey> = { 1: '1', 2: '2a', 3: '3b' };
// THE ROTATION SEAM: an opponent → an arena. The ladder band decides (rungs 1–3 Arena 1, 4–7 Arena 2, 8–10 Arena 3). Per-fight
// random would be this one line: `return ARENA_THEMES[ARENA_PICK[(1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3]]`.
// Next reloads the page (main.ts), so a band change swaps the arena inside the same load that fetches the next rig: never mid-fight,
// never on a rematch, and only one arena is ever resident.
export function arenaFor(opponent: OpponentId, override?: string): ArenaTheme {
  if (override && override in ARENA_THEMES) return ARENA_THEMES[override as ArenaKey];
  const rung = LADDER.findIndex(o => o.id === opponent) + 1;   // 0 for a held or unknown id: Arena 1
  return ARENA_THEMES[ARENA_PICK[rung >= 8 ? 3 : rung >= 4 ? 2 : 1]];
}

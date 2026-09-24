// Arenas 2 and 3 (owner 2026-09-23, via Strategy: "create arena 2 and arena 3 now, and put them on rotation"). One place, three
// looks: the geometry, the play radius, the ring wall and the floor height are Arena 1's (LAYOUT in arena.ts) — the simulation never
// knows which arena it is in. A theme is presentation only: its own floor material and wall masonry (the same generators with other
// parameters), its sky, fog and light, its wall-top cloth, and its crowd's density and dress.
// Pure data, no three.js: the texture worker imports the texture half of it.
import type { OpponentId } from './moves.ts';
import { LADDER } from './ladder.ts';

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
export type Weather = { kind: 'ash' | 'embers' | 'rain' | 'dust' | 'drips'; color: string; count: number; size: number; opacity: number };
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
};
export type ArenaKey = '1' | 'a' | 'b' | 'c' | 'd';

const ONE: RGB = [1, 1, 1];
// Arena 1's numbers, exactly as arena.ts / scene.ts / textures.ts / crowd.ts had them before the themes: its maps are byte-identical.
const ARENA_1: ArenaTheme = {
  id: '1', name: 'The Ash Pit', textures: { floor: 'sand', sand: ONE, sandSeed: 7, stone: ONE, stoneSeed: 11, sky: { base: [169, 168, 156], sun: [70, 52, 30], ground: [128, 104, 78] } },
  fog: '#a9a89c', fogDensity: 0.018, hemisphere: ['#c9cfc6', '#4a4238', 1.6], sun: ['#ffe2b8', 4.2], exposure: 1.3,
  banners: ['#472622', '#7d7469'], banner: [1, 1], bannerSeed: 31,
  dyes: ['#453538', '#30353d', '#514033', '#535451', '#3e4837', '#62503a'], crowd: 1, fill: 1,
  motes: '#847b6e', plain: '#4a463f', gateLight: 0.55, drape: false,
};
// Arenas 2 and 3, round two (owner 2026-09-24 via Lead: 3B rejected, 2A "only a floor and a warm tint on the same walls"). Four
// labelled options, each unlike Arena 1 on at least two of light / floor / weather / setting; the owner picks two for ARENA_PICK.
const BRICK: WallStyle = { courses: 14, blocks: [6, 9], mortar: 0.62, hues: [[1.08, 0.94, 0.88], [1, 0.9, 0.84], [1.12, 0.98, 0.9], [0.94, 0.86, 0.82], [1.04, 0.96, 0.9], [0.9, 0.84, 0.8]] };
export const ARENA_THEMES: Record<ArenaKey, ArenaTheme> = {
  '1': ARENA_1,
  // A — The Night Pit (2A evolved): no sun. A starless night; the braziers are the only warm light, one low firelight that sways
  // and flickers so the fighters' shadows run long and move; embers rise off the coals instead of ash. Red clay, brick wall.
  a: {
    id: 'a', name: 'The Night Pit', textures: { floor: 'clay', sand: [1.18, 0.99, 0.88], sandSeed: 23, stone: [1.14, 0.9, 0.76], stoneSeed: 29, wall: BRICK,
      sky: { base: [26, 24, 34], sun: [38, 20, 8], ground: [40, 26, 20], sunV: 0.56 } },
    fog: '#261c1a', fogDensity: 0.028, hemisphere: ['#9496b8', '#5a3420', 2.4], sun: ['#ffa060', 6.5], exposure: 1.85,
    light: { sun: [-19, 8.5, -15], flicker: 0.16 },
    weather: { kind: 'embers', color: '#ff8a3a', count: 260, size: 0.08, opacity: 0.9 },
    banners: ['#6a1a12', '#9a7038'], banner: [1, 1.2], bannerSeed: 47,
    dyes: ['#5a2420', '#6a3a1e', '#4a2a22', '#7a5a2c', '#3a2a24', '#6a2a1c'], crowd: 0.9, fill: 1.2,
    motes: '#ff8a3a', plain: '#1e1612', gateLight: 0.85, drape: true,
  },
  // B — The Rain Yard: an overcast grey-green afternoon and steady rain. Dark granite flags gone slick, a sheen off the whole pit and
  // standing puddles that mirror the sky; rain streaks through the frame. Slate courses in the wall, a thin crowd in drab wool.
  b: {
    id: 'b', name: 'The Rain Yard', textures: { floor: 'flag', patch: 'puddle', sand: [0.97, 1.07, 1.14], sandSeed: 37, stone: [0.86, 0.94, 1.0], stoneSeed: 41,
      wall: { courses: 9, blocks: [3, 5], mortar: 0.35, hues: [[1, 1, 1], [0.95, 0.98, 1.02], [0.9, 0.94, 0.98], [1.02, 1.02, 1.04], [0.94, 0.96, 0.98], [0.88, 0.9, 0.94]] },
      sky: { base: [118, 126, 130], sun: [14, 14, 12], ground: [70, 76, 78] } },
    fog: '#6e777c', fogDensity: 0.034, hemisphere: ['#aab6be', '#2c3234', 1.55], sun: ['#dfe6ea', 1.6], exposure: 1.3,
    wet: 0.34,
    weather: { kind: 'rain', color: '#d8e2ea', count: 1500, size: 0.5, opacity: 0.8 },
    banners: ['#2a3440', '#5e5a50'], banner: [0.9, 0.8], bannerSeed: 59,
    dyes: ['#3e4636', '#4a4a3e', '#36403a', '#545244', '#404838', '#4e4638'], crowd: 0.9, fill: 0.7,
    motes: '#c8d4dc', plain: '#2e3436', gateLight: 0.15, drape: true,
  },
  // C — Blood Sand at High Noon: the sun straight overhead, so every shadow is short, hard and under the feet; a bleached white-blue
  // sky; pale sand with old blood soaked in brown patches; dust hangs low and bright. Huge rough-hewn blocks in the wall.
  c: {
    id: 'c', name: 'Blood Sand', textures: { floor: 'sand', patch: 'blood', sand: [1.12, 1.04, 0.86], sandSeed: 43, stone: [1.1, 1.04, 0.92], stoneSeed: 47,
      wall: { courses: 3, blocks: [1, 3], mortar: 0.55, hues: [[1, 1, 1], [1.04, 1.01, 0.96], [0.96, 0.95, 0.93], [1.02, 1.0, 0.96], [0.9, 0.88, 0.86], [0.98, 0.97, 0.95]] },
      sky: { base: [206, 212, 214], sun: [60, 56, 44], ground: [176, 150, 112], sunV: 0.98 } },
    fog: '#d6d4cc', fogDensity: 0.014, hemisphere: ['#f2eee4', '#8a6e4c', 1.3], sun: ['#fff8ea', 5.6], exposure: 1.1,
    light: { sun: [-2.5, 30, -3] },
    weather: { kind: 'dust', color: '#e8dcc0', count: 420, size: 0.12, opacity: 0.55 },
    banners: ['#7c2a18', '#d6c6a0'], banner: [1.6, 0.55], bannerSeed: 71,
    dyes: ['#8a8070', '#7a6a58', '#9a8a70', '#6a3a2a', '#5a5a60', '#8a7a5a'], crowd: 1.1, fill: 1.3,
    motes: '#e8dcc0', plain: '#b09a78', gateLight: 0.2, drape: true,
  },
  // D — The Sunken Cistern: underground. A black vault instead of sky, a shallow sheet of water over the flags that mirrors the
  // shafts of daylight falling through the grates overhead, water dripping from the dark. Wet green-black stone, a few watchers.
  d: {
    id: 'd', name: 'The Sunken Cistern', textures: { floor: 'sand', patch: 'puddle', sand: [0.89, 1.03, 0.99], sandSeed: 53, stone: [0.8, 0.94, 0.88], stoneSeed: 59,
      wall: { courses: 7, blocks: [2, 4], mortar: 0.45, hues: [[1, 1, 1], [0.92, 1.0, 0.94], [0.88, 0.96, 0.92], [1.0, 1.02, 0.98], [0.9, 0.94, 0.9], [0.84, 0.9, 0.88]] },
      sky: { base: [22, 30, 30], sun: [10, 12, 12], ground: [24, 30, 28], sunV: 0.95 } },
    fog: '#101818', fogDensity: 0.04, hemisphere: ['#7a9898', '#141c1a', 1.0], sun: ['#e6f2ea', 5.0], exposure: 1.6,
    light: { sun: [-3, 30, 2] }, wet: 0.06, shafts: 5,
    weather: { kind: 'drips', color: '#cfe4e4', count: 160, size: 0.07, opacity: 0.8 },
    banners: ['#1e2a28', '#4a4a40'], banner: [0.7, 0.9], bannerSeed: 67,
    dyes: ['#3a3834', '#2e3440', '#44403c', '#3a4238', '#2a302e', '#4a4640'], crowd: 0.7, fill: 0.35,
    motes: '#cfe4e4', plain: '#101614', gateLight: 0.0, drape: false,
  },
};
// Owner 2026-09-24 (via Strategy): "get all arenas, they are all good" — all five ride the ladder, two rungs each, in the order
// they were made. The order is PROVISIONAL: Dom chooses the final rung → arena mapping later; that pick edits this one line.
export const ARENA_PICK: Record<1 | 2 | 3 | 4 | 5, ArenaKey> = { 1: '1', 2: 'a', 3: 'b', 4: 'c', 5: 'd' };
// THE ROTATION SEAM: an opponent → an arena. The ladder band decides (rungs 1–2 Arena 1, 3–4 A, 5–6 B, 7–8 C, 9–10 D). Per-fight
// random would be this one line: `return ARENA_THEMES[ARENA_PICK[(1 + Math.floor(Math.random() * 5)) as 1 | 2 | 3 | 4 | 5]]`.
// Next reloads the page (main.ts), so a band change swaps the arena inside the same load that fetches the next rig: never mid-fight,
// never on a rematch, and only one arena is ever resident.
export const arenaBand = (rung: number): 1 | 2 | 3 | 4 | 5 => (rung <= 0 ? 1 : Math.min(5, Math.ceil(rung / 2))) as 1 | 2 | 3 | 4 | 5;
export function arenaFor(opponent: OpponentId, override?: string): ArenaTheme {
  if (override && override in ARENA_THEMES) return ARENA_THEMES[override as ArenaKey];
  const rung = LADDER.findIndex(o => o.id === opponent) + 1;   // 0 for a held or unknown id: Arena 1
  return ARENA_THEMES[ARENA_PICK[arenaBand(rung)]];
}

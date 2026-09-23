// Arenas 2 and 3 (owner 2026-09-23, via Strategy: "create arena 2 and arena 3 now, and put them on rotation"). One place, three
// looks: the geometry, the play radius, the ring wall and the floor height are Arena 1's (LAYOUT in arena.ts) — the simulation never
// knows which arena it is in. A theme is only colour and light: the generated sand/stone/sky maps are re-tinted, the scene's fog,
// hemisphere, sun and exposure change, and the dressing (banners, crowd dye, motes, the far plain) follows.
// Pure data, no three.js: the texture worker imports the texture half of it.
import type { OpponentId } from './moves.ts';
import { LADDER } from './ladder.ts';

type RGB = [number, number, number];
export type SkyLook = { base: RGB; sun: RGB; ground: RGB };
// floor: 'sand' is Arena 1's gravelled sand; 'flag' paves the pit with the wall's own ashlar generator (re-seeded, tinted).
export type TextureLook = { floor: 'sand' | 'flag'; sand: RGB; sandSeed: number; stone: RGB; stoneSeed: number; sky: SkyLook };
export type ArenaTheme = {
  id: ArenaKey; name: string; textures: TextureLook;
  fog: string; fogDensity: number; hemisphere: [string, string, number]; sun: [string, number]; exposure: number;
  banners: [string, string]; crowd: number; motes: string; plain: string; gateLight: number;
};
export type ArenaKey = '1' | '2a' | '2b' | '3a' | '3b';

const ONE: RGB = [1, 1, 1];
// Arena 1's numbers, exactly as arena.ts / scene.ts / textures.ts had them before the themes: its maps are byte-identical.
const ARENA_1: ArenaTheme = {
  id: '1', name: 'The Ash Pit', textures: { floor: 'sand', sand: ONE, sandSeed: 7, stone: ONE, stoneSeed: 11, sky: { base: [169, 168, 156], sun: [70, 52, 30], ground: [128, 104, 78] } },
  fog: '#a9a89c', fogDensity: 0.018, hemisphere: ['#c9cfc6', '#4a4238', 1.6], sun: ['#ffe2b8', 4.2], exposure: 1.3,
  banners: ['#472622', '#7d7469'], crowd: 1, motes: '#847b6e', plain: '#4a463f', gateLight: 0.55,
};
// Two labelled options per new arena, for the owner to pick from (same frame as Arena 1); the rotation uses ARENA_PICK below.
export const ARENA_THEMES: Record<ArenaKey, ArenaTheme> = {
  '1': ARENA_1,
  // 2A — Ember Dusk: red clay underfoot, ochre stone, a low orange sun through smoke.
  '2a': {
    id: '2a', name: 'The Ember Pit', textures: { floor: 'sand', sand: [1.07, 0.9, 0.8], sandSeed: 23, stone: [1.1, 0.93, 0.78], stoneSeed: 29, sky: { base: [178, 124, 96], sun: [92, 48, 18], ground: [120, 78, 56] } },
    fog: '#957c6c', fogDensity: 0.02, hemisphere: ['#d8bea8', '#4a3026', 1.45], sun: ['#ffc298', 4.0], exposure: 1.25,
    banners: ['#5c1a12', '#8a6a42'], crowd: 0.92, motes: '#a8683c', plain: '#4a3328', gateLight: 0.5,
  },
  // 2B — Torch Night: black basalt sand, blue-grey stone, a cold moon; the braziers carry the warmth.
  '2b': {
    id: '2b', name: 'The Night Pit', textures: { floor: 'sand', sand: [0.66, 0.66, 0.72], sandSeed: 23, stone: [0.64, 0.67, 0.76], stoneSeed: 29, sky: { base: [58, 68, 94], sun: [44, 54, 76], ground: [62, 54, 46] } },
    fog: '#2e3544', fogDensity: 0.022, hemisphere: ['#8a9ab8', '#2a2420', 1.35], sun: ['#bccaff', 2.9], exposure: 1.4,
    banners: ['#2a3050', '#6a5a48'], crowd: 0.8, motes: '#c08448', plain: '#1e2028', gateLight: 0.35,
  },
  // 3A — Frost: grey-blue frozen ground, cold pale stone, an overcast white sky with snow in the air.
  '3a': {
    id: '3a', name: 'The Frost Pit', textures: { floor: 'sand', sand: [1.02, 1.06, 1.14], sandSeed: 37, stone: [0.94, 0.99, 1.08], stoneSeed: 41, sky: { base: [198, 208, 216], sun: [28, 30, 34], ground: [150, 150, 152] } },
    fog: '#c3cbd2', fogDensity: 0.026, hemisphere: ['#e2eaf2', '#5a5e66', 1.75], sun: ['#e9f0ff', 3.3], exposure: 1.25,
    banners: ['#1e2a3c', '#8c8c88'], crowd: 0.9, motes: '#f4f6fa', plain: '#6c7078', gateLight: 0.18,
  },
  // 3B — Sun Court: a paved floor of worn limestone flags, sandstone walls, a deep clear sky and a hard white sun.
  '3b': {
    id: '3b', name: 'The Sun Court', textures: { floor: 'flag', sand: [0.8, 0.76, 0.68], sandSeed: 37, stone: [1.18, 0.99, 0.78], stoneSeed: 41, sky: { base: [118, 150, 192], sun: [120, 100, 60], ground: [150, 120, 80] } },
    fog: '#b9c6d2', fogDensity: 0.012, hemisphere: ['#d0e2f6', '#6a5438', 1.7], sun: ['#fff3da', 4.8], exposure: 1.2,
    banners: ['#7c2a18', '#d6c6a0'], crowd: 1.05, motes: '#c8b080', plain: '#7a6a50', gateLight: 0.3,
  },
};
// The owner's pick per arena (A until he chooses; one line each).
export const ARENA_PICK: Record<1 | 2 | 3, ArenaKey> = { 1: '1', 2: '2a', 3: '3a' };
// THE ROTATION SEAM: an opponent → an arena. The ladder band decides (rungs 1–3 Arena 1, 4–7 Arena 2, 8–10 Arena 3). Per-fight
// random would be this one line: `return ARENA_THEMES[ARENA_PICK[(1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3]]`.
export function arenaFor(opponent: OpponentId, override?: string): ArenaTheme {
  if (override && override in ARENA_THEMES) return ARENA_THEMES[override as ArenaKey];
  const rung = LADDER.findIndex(o => o.id === opponent) + 1;   // 0 for a held or unknown id: Arena 1
  return ARENA_THEMES[ARENA_PICK[rung >= 8 ? 3 : rung >= 4 ? 2 : 1]];
}

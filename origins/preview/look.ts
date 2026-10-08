// Zone look (Origins, World lane): the environment's sky, fog, light and ground tint per zone, as DATA. A look is a row in PRESETS keyed by a zone's `ambience.preset`
// (origins/world/schema.ts); fog distances come from the zone's `view`; nothing here knows a zone by name. Presentation only: no sim, no save, no camera. 'ash-pit' is
// Arena 1's theme pinned as literals (look.test.ts), so today's Pit is byte-identical; new looks are new rows. Pure (hex strings and numbers) so it is testable without three.js.
import type * as THREE from 'three';

export type Look = {
  fog: string; fogDensity: number;   // FogExp2 colour (also the scene background) and its density at the DEFAULT fogFar
  hemiSky: string; hemiGround: string; hemiIntensity: number;
  sunColor: string; sunIntensity: number; sunPos: [number, number, number];
  exposure: number;
  ground: [number, number, number];   // a multiplier on the ground materials' base colour (1,1,1 = as built)
  stone?: [number, number, number];   // the same for the masonry (absent = 1,1,1): ground darker and masonry lighter is what lets a plaza read at 375
};
// The structural subset of a resolved zone's params this reads (origins/world Params satisfies it).
export type LookParams = { ambience: { preset: string }; view: { fogFar: number } };
export const DEFAULT_FOG_FAR = 107;   // schema.ts view.fogFar's default: the Pit's own distance, where a preset's fogDensity applies unchanged

// The Pit's golden hour, as literals (was read from src/arena-themes.ts ARENA_1: zones import nothing from the Pit; look.test.ts pins these numbers).
const t1 = { fog: '#c9a47a', fogDensity: 0.02, hemisphere: ['#9fb2d4', '#4a3426', 1.25] as [string, string, number], sun: ['#ffb46a', 5.2] as [string, number], exposure: 1.3, light: { sun: [-24, 12, -15] as [number, number, number] } };
export const PRESETS: Record<string, Look> = {
  'ash-pit': { fog: t1.fog, fogDensity: t1.fogDensity, hemiSky: t1.hemisphere[0], hemiGround: t1.hemisphere[1], hemiIntensity: t1.hemisphere[2], sunColor: t1.sun[0], sunIntensity: t1.sun[1], sunPos: t1.light?.sun ?? [-15, 26, -18], exposure: t1.exposure, ground: [1, 1, 1] },
  // The Concord Exchange: a lamp-lit dusk. The sun is low and deep amber, the fog a warmer, darker haze, the shade cooler so the braziers and the forge read as the light.
  'exchange-dusk': { fog: '#8f5f3f', fogDensity: 0.024, hemiSky: '#7d86ad', hemiGround: '#3a2418', hemiIntensity: 0.95, sunColor: '#ff9a52', sunIntensity: 3.4, sunPos: [-24, 7, -15], exposure: 1.25, ground: [0.92, 0.88, 0.84] },
  // The Ash Frontier (the Pit's sun direction, so no block throws a new hard shadow across the walker's foreground): open ground under a high, pale, dusty sky; a long soft horizon (low density), cooler fill, a brighter key.
  'frontier-haze': { fog: '#d6bf9a', fogDensity: 0.012, hemiSky: '#b4c4da', hemiGround: '#6a5238', hemiIntensity: 1.35, sunColor: '#ffd6a0', sunIntensity: 5.6, sunPos: t1.light?.sun ?? [-15, 26, -18], exposure: 1.35, ground: [1.05, 0.98, 0.88] },
};
// ?look=cinder: the Frontier's haze a little thinner and the ground-bounce darker, so the skyline silhouettes (frontier-cinder.ts, 60 to 110 m out) still read against it instead of dissolving at the fog's full strength.
PRESETS['cinder-haze'] = { ...PRESETS['frontier-haze']!, fogDensity: 0.0095, hemiGround: '#52402c' };
// ?look=duel (default OFF): a duel's ground and light at the fight camera (Dom's Zone 1 pass). Fog is out of frame at 3 to 7 m, so it is cinder-haze's; the ground is lifted 15 % and its bounce back to the Frontier's #6a5238, the key 10 % softer, so a foe's feet separate from the dirt and the sun's shadow bands stop sitting under them.
PRESETS['frontier-duel'] = { ...PRESETS['cinder-haze']!, hemiGround: '#6a5238', sunIntensity: PRESETS['cinder-haze']!.sunIntensity * 0.9, ground: PRESETS['cinder-haze']!.ground.map((v) => v * 1.15) as [number, number, number] };
// The Frontier at night (?look=night with ?region=1): a cold dark haze, a faint moon-blue key and the fire as the light; a look test for the camps' flame and glow.
PRESETS['frontier-night'] = { fog: '#141a2a', fogDensity: 0.02, hemiSky: '#2a3558', hemiGround: '#14100e', hemiIntensity: 0.45, sunColor: '#6a7ab0', sunIntensity: 0.6, sunPos: PRESETS['frontier-haze']!.sunPos, exposure: 1.1, ground: [0.8, 0.8, 0.9] };
// Zone 1 (the Pit gate, the passage, the Exchange), for ?look=zone1: the arena's own sky and exposure; a darker, thinner haze with the key light from behind the walker, so the sunlit gate, bank and smithy fronts stand
// out pale against it (they were sand on sand); the paving pulled down and cooler, the masonry lifted and warmer.
PRESETS['zone1'] = { ...PRESETS['ash-pit']!, fog: '#6e5f52', fogDensity: 0.012, sunPos: [-16, 15, 20], sunIntensity: t1.sun[1] * 1.15, ground: [0.5, 0.47, 0.45], stone: [1.35, 1.2, 1] };
export const lookOf = (preset: string): Look => PRESETS[preset] ?? PRESETS['ash-pit']!;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hexLerp = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};
const vec = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => lerp(v, b[i]!, t)) as [number, number, number];
// Linear blend of two looks, t clamped to 0..1 (0 = a exactly, 1 = b exactly).
export function blendLook(a: Look, b: Look, t: number): Look {
  const k = Math.min(1, Math.max(0, t));
  if (k === 0) return a;
  if (k === 1) return b;
  return { fog: hexLerp(a.fog, b.fog, k), fogDensity: lerp(a.fogDensity, b.fogDensity, k), hemiSky: hexLerp(a.hemiSky, b.hemiSky, k), hemiGround: hexLerp(a.hemiGround, b.hemiGround, k), hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, k),
    sunColor: hexLerp(a.sunColor, b.sunColor, k), sunIntensity: lerp(a.sunIntensity, b.sunIntensity, k), sunPos: vec(a.sunPos, b.sunPos, k), exposure: lerp(a.exposure, b.exposure, k), ground: vec(a.ground, b.ground, k), stone: vec(a.stone ?? [1, 1, 1], b.stone ?? [1, 1, 1], k) };
}
// The look at a position along an axis: `stops` are zone centres (axis value, preset) in any order; between two neighbours the look blends (smoothstepped), beyond the ends it holds.
export function lookAlong(at: number, stops: readonly { at: number; preset: string }[]): Look {
  const s = [...stops].sort((p, q) => p.at - q.at);
  if (!s.length) return lookOf('ash-pit');
  if (at <= s[0]!.at) return lookOf(s[0]!.preset);
  for (let i = 1; i < s.length; i++) if (at <= s[i]!.at) { const u = (at - s[i - 1]!.at) / (s[i]!.at - s[i - 1]!.at); return blendLook(lookOf(s[i - 1]!.preset), lookOf(s[i]!.preset), u * u * (3 - 2 * u)); }
  return lookOf(s[s.length - 1]!.preset);
}
// A zone's own look from its resolved params: the preset row with the fog density scaled to the zone's view.fogFar (default = unchanged; a longer view = thinner fog).
export const zoneLook = (p: LookParams): Look => { const l = lookOf(p.ambience.preset); return { ...l, fogDensity: l.fogDensity * (DEFAULT_FOG_FAR / p.view.fogFar) }; };

// Put a look on the scene. `grounds` (optional) are the ground materials to tint: their first-seen base colour is kept in userData so a tint never compounds.
export function applyLook(scene: THREE.Scene, renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, look: Look, grounds: readonly THREE.MeshStandardMaterial[] = [], stones: readonly THREE.MeshStandardMaterial[] = []): Look {
  (scene.background as THREE.Color).set(look.fog);
  const fog = scene.fog as THREE.FogExp2; fog.color.set(look.fog); fog.density = look.fogDensity;
  hemi.color.set(look.hemiSky); hemi.groundColor.set(look.hemiGround); hemi.intensity = look.hemiIntensity;
  sun.color.set(look.sunColor); sun.intensity = look.sunIntensity;
  renderer.toneMappingExposure = look.exposure;
  const tint = (ms: readonly THREE.MeshStandardMaterial[], t: readonly [number, number, number]) => { for (const m of ms) { const base = (m.userData.lookBase ??= m.color.clone()) as THREE.Color; m.color.copy(base); m.color.r *= t[0]; m.color.g *= t[1]; m.color.b *= t[2]; } };   // no allocation: this runs every frame
  tint(grounds, look.ground); tint(stones, look.stone ?? [1, 1, 1]);
  return look;
}

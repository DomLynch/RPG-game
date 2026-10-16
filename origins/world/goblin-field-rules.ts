// The goblin field's look as data (World, 2026-10-15, Dom's zone looks via the look-test route): the near-ground kit (palisade stakes, totems, smoking fires, dead trees, bones), the
// fire's smoke, and the painted horizon dome, one row each through the shared loader (src/core/registry.ts). Nothing here is read by the sim, so it is NOT part of the world digest.
// A palette row is one direction for the dome, smoke and fire light (Zone sandbox, 2026-10-15: field = World's first pass, ash, marsh, dusk); its `haze` names the zone row look (fog, light, ground tint).
// Pure, and page- and server-safe. Every number the look module reads is a row; a missing or non-positive named rule is refused.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './goblin-field-defs.json' with { type: 'json' };
import MANIFEST from './goblin-field-defs.manifest.json' with { type: 'json' };
import { ambienceRow, dressSet, kitIds } from './props-rules.ts';

export type GoblinRule = { readonly id: string; readonly value: number; readonly unit: string };
type Raw = { rules?: readonly unknown[]; palettes?: readonly unknown[]; backdrops?: readonly unknown[]; grounds?: readonly unknown[]; looks?: readonly unknown[]; harmonics?: readonly unknown[]; names?: readonly unknown[] };
export type GoblinPalette = { readonly id: string; readonly haze: string; readonly zenith: string; readonly mid: string; readonly horizon: string; readonly glow: string; readonly ridge: string; readonly ridgeFar: string; readonly smoke: string; readonly puff: string; readonly torch: string; readonly torchPower: number; readonly backdropPortrait: string; readonly backdropLandscape: string; };
/** A ground recipe: the dirt tile's size and seed, its colours, how many blotches, wet patches, speckles, pebbles and cracks, and the bump the low sun picks it out with. Counts and sizes are in tile pixels at texN. */
export type GoblinGround = { readonly id: string; readonly texN: number; readonly tileM: number; readonly seed: number; readonly base: string; readonly light: string; readonly dark: string; readonly wet: string; readonly blotches: number; readonly blotchMin: number; readonly blotchMax: number; readonly wetPatches: number; readonly wetMin: number; readonly wetMax: number; readonly speckles: number; readonly speckleMin: number; readonly speckleMax: number; readonly pebbles: number; readonly pebbleMin: number; readonly pebbleMax: number; readonly cracks: number; readonly crackSteps: number; readonly crackStep: number; readonly noise: number; readonly bump: number; readonly roughness: number };
/** A painted backdrop for the dome (Dom's pictures): the file (under the page base), the crop as fractions of the picture (y1 = its horizon line), how many mirrored copies go round the dome, the dome texture's size while it shows, the head and foot fades as fractions of the crop, and `drop`: how far the picture is lowered below the horizon, as a fraction of its height (its foot then hides behind the ground and more of its top shows). */
/** A mood's fog, light and ground tint (the shape of look.ts Look): what a palette's `haze` names. Here, not in a zone row, so every zone row keeps the same preset names. */
export type GoblinLook = { readonly id: string; readonly fog: string; readonly fogDensity: number; readonly hemiSky: string; readonly hemiGround: string; readonly hemiIntensity: number; readonly sunColor: string; readonly sunIntensity: number; readonly sunPos: readonly [number, number, number]; readonly exposure: number; readonly ground: readonly [number, number, number] };
export type GoblinBackdrop = { readonly id: string; readonly file: string; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly repeat?: number; readonly arc?: number; readonly azimuth?: number; readonly fadeSide?: number; readonly flat?: number; readonly texW: number; readonly texH: number; readonly fadeTop: number; readonly fadeFoot: number; readonly drop: number };   // a RING row has `repeat` (mirrored copies round the whole dome); a SECTOR row has `arc` (degrees of sky the picture spans, at its own native resolution), `azimuth` (the world bearing its middle faces: 0 = +z, 180 = -z, the way the walk runs) and `fadeSide` (the left and right edges fade into the painted sky, a fraction of the width)
const RULES = ['smokeCount', 'smokeRise', 'smokeSpeed', 'smokeSize0', 'smokeSize1', 'smokeOpacity', 'domeRadius', 'domeHalf', 'ridgeAmp', 'ridgeSeed', 'ridgeFarShift', 'smokeColumns', 'texW', 'texH', 'glowX', 'glowR', 'columnW', 'columnAlpha', 'torchY', 'torchRange', 'torchDecay', 'flickerFast', 'flickerSlow', 'flickerDepth', 'smokeBase', 'smokeDrift', 'smokeFadeIn', 'puffCore', 'campView', 'pitHideM', 'sectorInset'] as const;
const HEX = ['zenith', 'mid', 'horizon', 'glow', 'ridge', 'ridgeFar', 'smoke', 'puff', 'torch'] as const;
/** The one loader: every table keyed by id (a duplicate id or a missing or mistyped field is refused), every named row must exist, numbers positive, colours #rrggbb. */
export function loadGoblinField(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'goblin-field-defs.json')));
  const rules = (raw.rules ?? []) as readonly GoblinRule[], palettes = (raw.palettes ?? []) as readonly GoblinPalette[], backdrops = (raw.backdrops ?? []) as readonly GoblinBackdrop[], looks = (raw.looks ?? []) as readonly GoblinLook[], grounds = (raw.grounds ?? []) as readonly GoblinGround[], harmonics = (raw.harmonics ?? []) as readonly { id: string; k: number; a: number }[], names = (raw.names ?? []) as readonly { id: string; text: string }[];
  for (const r of rules) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`goblin-field "${r.id}": value is a number > 0`);
  for (const must of RULES) if (!rules.some((r) => r.id === must)) throw Error(`goblin-field: the look reads the "${must}" rule by name, so it needs a row`);
  for (const p of palettes) { for (const k of HEX) if (!/^#[0-9a-f]{6}$/i.test(p[k])) throw Error(`goblin-field palette "${p.id}" ${k}: hex is #rrggbb`); if (!(Number.isFinite(p.torchPower) && p.torchPower >= 0)) throw Error(`goblin-field palette "${p.id}": torchPower is a number >= 0`); }
  for (const b of backdrops) {
    const frac = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
    if (!(frac(b.x0) && frac(b.x1) && frac(b.y0) && frac(b.y1) && b.x0 < b.x1 && b.y0 < b.y1)) throw Error(`goblin-field backdrop "${b.id}": the crop is fractions of the picture, 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1`);
    if (b.arc === undefined) { if (!(Number.isInteger(b.repeat) && b.repeat! >= 2 && b.repeat! % 2 === 0)) throw Error(`goblin-field backdrop "${b.id}": repeat is an even whole number (mirrored copies meet round the dome)`); }
    else if (!(b.arc > 0 && b.arc <= 180 && Number.isFinite(b.azimuth) && b.azimuth! >= 0 && b.azimuth! < 360 && frac(b.fadeSide ?? NaN) && b.fadeSide! < 0.5)) throw Error(`goblin-field backdrop "${b.id}": a sector has 0 < arc <= 180 degrees, 0 <= azimuth < 360 and fadeSide < 0.5`);
    if (b.flat !== undefined && !(b.flat === 0 || b.flat === 1)) throw Error(`goblin-field backdrop "${b.id}": flat is 0 (curved sector) or 1 (flat matte card)`);
    if (b.arc !== undefined && b.drop < 0.5 && b.fadeFoot > 1 - b.drop) throw Error(`goblin-field backdrop "${b.id}": a sector's foot fade must fit above its horizon row (fadeFoot <= 1 - drop)`);
    if (!(b.texW > 0 && b.texH > 0 && frac(b.fadeTop) && frac(b.fadeFoot) && b.fadeTop + b.fadeFoot < 1 && frac(b.drop) && b.drop < 0.5)) throw Error(`goblin-field backdrop "${b.id}": texW/texH > 0, fadeTop + fadeFoot < 1, 0 <= drop < 0.5`);
    if (!/^[a-z0-9/_.-]+\.(webp|png|jpg)$/.test(b.file) || b.file.startsWith('/')) throw Error(`goblin-field backdrop "${b.id}": file is a picture path under the page base, no leading slash`);
  }
  for (const g of grounds) {
    for (const k of ['base', 'light', 'dark', 'wet'] as const) if (!/^#[0-9a-f]{6}$/i.test(g[k])) throw Error(`goblin-field ground "${g.id}" ${k}: hex is #rrggbb`);
    for (const [k, v] of Object.entries(g)) if (typeof v === 'number' && !(Number.isFinite(v) && v > 0)) throw Error(`goblin-field ground "${g.id}" ${k}: a number > 0`);
    if (!Number.isInteger(g.texN) || g.texN > 2048) throw Error(`goblin-field ground "${g.id}": texN is a whole number up to 2048`);
  }
  for (const l of looks) { for (const k of ['fog', 'hemiSky', 'hemiGround', 'sunColor'] as const) if (!/^#[0-9a-f]{6}$/i.test(l[k])) throw Error(`goblin-field look "${l.id}" ${k}: hex is #rrggbb`); if (l.sunPos.length !== 3 || l.ground.length !== 3) throw Error(`goblin-field look "${l.id}": sunPos and ground are three numbers`); }
  for (const p of palettes) for (const k of ['backdropPortrait', 'backdropLandscape'] as const) if (p[k] && !backdrops.some((b) => b.id === p[k])) throw Error(`goblin-field palette "${p.id}" ${k}: "${p[k]}" names no backdrop row`);
  for (const h of harmonics) if (!(h.k > 0 && Number.isInteger(h.k) && h.a > 0)) throw Error(`goblin-field harmonic "${h.id}": k is a whole number of periods > 0 (the ridge closes at the seam), a > 0`);
  if (!harmonics.length) throw Error('goblin-field: the dome ridge needs at least one harmonic row');
  for (const must of ['zone', 'palette', 'biome']) if (!names.some((n) => n.id === must)) throw Error(`goblin-field: the look needs its "${must}" name row`);
  if (!palettes.some((p) => p.id === names.find((n) => n.id === 'palette')!.text)) throw Error('goblin-field: the "palette" name row names a palette row');
  return { rules, palettes, backdrops, grounds, looks, harmonics, names };
}
const LOADED = loadGoblinField(DEFS);
export const goblinRule = (id: (typeof RULES)[number]): number => LOADED.rules.find((r) => r.id === id)!.value;
/** A palette by id (the ?goblin= flag); an absent or unknown id is the default named by the "palette" name row. */
export const goblinPalette = (id?: string | null): GoblinPalette => LOADED.palettes.find((p) => p.id === id) ?? LOADED.palettes.find((p) => p.id === LOADED.names.find((n) => n.id === 'palette')!.text)!;
export const goblinPalettes = (): readonly GoblinPalette[] => LOADED.palettes;
/** The backdrop row a palette shows on a portrait or a landscape screen, or null (no picture: the painted sky alone). */
export const goblinBackdrop = (p: GoblinPalette, portrait: boolean): GoblinBackdrop | null => { const id = portrait ? p.backdropPortrait : p.backdropLandscape; return id ? LOADED.backdrops.find((b) => b.id === id)! : null; };
/** A zone's fields as loadZone gives them (only what a biome or the zone SET counts). */
export type ZoneLookFields = { readonly fields?: Readonly<Record<string, unknown>>; readonly set?: readonly string[]; readonly world: readonly string[] };
const zoneSet = (z: ZoneLookFields, path: string): unknown => (z.set?.includes(path) ? z.fields?.[path] : undefined);
/** The dome a zone row asks for: `look.sky` set to a palette id (EQEmu zone.sky), else null (no dome: every zone that does not set it is unchanged). */
export const zoneSky = (z: ZoneLookFields): GoblinPalette | null => { const id = zoneSet(z, 'look.sky'); return LOADED.palettes.find((p) => p.id === id) ?? null; };
/** The kit a zone row asks for (`look.props.kit`, an id in props-defs.json) and the world zone it stands in (`look.props.camp`, a world zone of this zone, else its first); null = none. */
export function zonePropKit(z: ZoneLookFields): { kit: string; at: string } | null {
  const kit = zoneSet(z, 'look.props.kit'); if (typeof kit !== 'string' || !kitIds().includes(kit)) return null;
  const at = zoneSet(z, 'look.props.camp'), zone = typeof at === 'string' && at && z.world.includes(at) ? at : z.world[0];
  return zone ? { kit, at: zone } : null;
}
/** The clutter multipliers a zone asks for (`look.dress`, a dress set id); unset = the base clutter as it was. */
export const zoneDress = (z: ZoneLookFields) => dressSet(zoneSet(z, 'look.dress') as string | undefined);
/** The ground a zone asks for (`look.ground.material` naming a ground row; an id with no row, like the biomes' old "ash", leaves the Frontier's own dirt). */
export const zoneGround = (z: ZoneLookFields): GoblinGround | null => LOADED.grounds.find((g) => g.id === zoneSet(z, 'look.ground.material')) ?? null;
/** The ambience row a zone asks for (`sound.ambience`); an id with no row stays silent. */
export const zoneAmbience = (z: ZoneLookFields) => ambienceRow(zoneSet(z, 'sound.ambience') as string | undefined);
/** The creature markers a zone shows: the "!" over a creature that noticed you, the floating name tag, and the creature's growl when it notices you (off unless set: the stop-and-face is the sim's own, the growl is the sound), the ground ring under a creature (on unless set off), the camera lock ('hard' = it swings to the nearest creature and holds; 'soft' = a gentle pull that lets go when you drag or push back), and the info card ('full' = today's three lines for the nearest creature that noticed you; 'target' = one line, name and level, for the creature you are targeting). All as today unless the zone SETS them. */
export const zoneMarkers = (z: ZoneLookFields): { alert: boolean; name: boolean; card: 'full' | 'target'; growl: boolean; ring: boolean; lock: 'hard' | 'soft' } => ({ alert: zoneSet(z, 'look.creatures.alert') !== false, name: zoneSet(z, 'look.creatures.name') !== false, card: zoneSet(z, 'look.creatures.card') === 'target' ? 'target' : 'full', growl: zoneSet(z, 'look.creatures.growl') === true, ring: zoneSet(z, 'look.creatures.ring') !== false, lock: zoneSet(z, 'look.creatures.lock') === 'soft' ? 'soft' : 'hard' });
/** Every mood look by id (look.ts adds them to its presets). */
export const goblinLooks = (): Readonly<Record<string, Omit<GoblinLook, 'id'>>> => Object.fromEntries(LOADED.looks.map(({ id, ...l }) => [id, l]));
/** The Pit's scenery meshes that ignore fog (names in src/arena.ts: sky, painted backdrop ring, abyss bowl and ground, far ground): drawn at any distance, so a zone dome hides them once the walker is pitHideM from the Pit. */
export const goblinPitParts = (): readonly string[] => LOADED.names.filter((n) => n.id.startsWith('pit:')).map((n) => n.text);
export const goblinHarmonics = (): readonly { k: number; a: number }[] => LOADED.harmonics;
/** The biome row `?look=goblin` puts Zone 1 in (a zone row with that biome gets the same look: sky, kit, clutter, ground, ambience, markers). */
export const goblinBiome = (): string => LOADED.names.find((n) => n.id === 'biome')!.text;
export const goblinZone = (): string => LOADED.names.find((n) => n.id === 'zone')!.text;

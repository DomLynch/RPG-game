// The goblin field's look as data (World, 2026-10-15, Dom's zone looks via the look-test route): the near-ground kit (palisade stakes, totems, smoking fires, dead trees, bones), the
// fire's smoke, and the painted horizon dome, one row each through the shared loader (src/core/registry.ts). Nothing here is read by the sim, so it is NOT part of the world digest.
// A palette row is one direction for the dome, smoke and fire light (Zone sandbox, 2026-10-15: field = World's first pass, ash, marsh, dusk); its `haze` names the zone row look (fog, light, ground tint).
// Pure, and page- and server-safe. Every number the look module reads is a row; a missing or non-positive named rule is refused.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './goblin-field-defs.json' with { type: 'json' };
import MANIFEST from './goblin-field-defs.manifest.json' with { type: 'json' };

export type GoblinRule = { readonly id: string; readonly value: number; readonly unit: string };
type Raw = { rules?: readonly unknown[]; tints?: readonly unknown[]; palettes?: readonly unknown[]; backdrops?: readonly unknown[]; harmonics?: readonly unknown[]; names?: readonly unknown[] };
export type GoblinPalette = { readonly id: string; readonly haze: string; readonly zenith: string; readonly mid: string; readonly horizon: string; readonly glow: string; readonly ridge: string; readonly ridgeFar: string; readonly smoke: string; readonly puff: string; readonly torch: string; readonly torchPower: number; readonly backdropPortrait: string; readonly backdropLandscape: string };
/** A painted backdrop for the dome (Dom's pictures): the file (under the page base), the crop as fractions of the picture (y1 = its horizon line), how many mirrored copies go round the dome, the dome texture's size while it shows, and the head and foot fades as fractions of the crop. */
export type GoblinBackdrop = { readonly id: string; readonly file: string; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly repeat: number; readonly texW: number; readonly texH: number; readonly fadeTop: number; readonly fadeFoot: number };
const RULES = ['palisadeSegments', 'palisadeStakes', 'stakeSpacing', 'stakeHMin', 'stakeHMax', 'stakeR', 'railLow', 'railHigh', 'totemCount', 'totemHMin', 'totemHMax', 'bonePiles', 'boneRibs', 'fireCount', 'fireStones', 'fireRing', 'emberR', 'fireLogs', 'treeClumps', 'treesPerClump', 'treeHMin', 'treeHMax', 'clusterRadius', 'clusterDepth', 'clearOfRoad', 'smokeCount', 'smokeRise', 'smokeSpeed', 'smokeSize0', 'smokeSize1', 'smokeOpacity', 'domeRadius', 'domeHalf', 'ridgeAmp', 'ridgeSeed', 'ridgeFarShift', 'smokeColumns', 'texW', 'texH', 'glowX', 'glowR', 'columnW', 'columnAlpha', 'torchY', 'torchRange', 'torchDecay', 'flickerFast', 'flickerSlow', 'flickerDepth', 'smokeBase', 'smokeDrift', 'smokeFadeIn', 'puffCore', 'campView'] as const;
const TINTS = ['wood', 'woodDark', 'bone', 'ochre', 'hide', 'ring', 'ember', 'dead', 'rope'] as const, HEX = ['zenith', 'mid', 'horizon', 'glow', 'ridge', 'ridgeFar', 'smoke', 'puff', 'torch'] as const;
/** The one loader: every table keyed by id (a duplicate id or a missing or mistyped field is refused), every named row must exist, numbers positive, colours #rrggbb. */
export function loadGoblinField(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'goblin-field-defs.json')));
  const rules = (raw.rules ?? []) as readonly GoblinRule[], tints = (raw.tints ?? []) as readonly { id: string; r: number; g: number; b: number }[], palettes = (raw.palettes ?? []) as readonly GoblinPalette[], backdrops = (raw.backdrops ?? []) as readonly GoblinBackdrop[], harmonics = (raw.harmonics ?? []) as readonly { id: string; k: number; a: number }[], names = (raw.names ?? []) as readonly { id: string; text: string }[];
  for (const r of rules) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`goblin-field "${r.id}": value is a number > 0`);
  for (const must of RULES) if (!rules.some((r) => r.id === must)) throw Error(`goblin-field: the look reads the "${must}" rule by name, so it needs a row`);
  for (const must of TINTS) if (!tints.some((t) => t.id === must)) throw Error(`goblin-field: the look reads the "${must}" tint by name, so it needs a row`);
  for (const p of palettes) { for (const k of HEX) if (!/^#[0-9a-f]{6}$/i.test(p[k])) throw Error(`goblin-field palette "${p.id}" ${k}: hex is #rrggbb`); if (!(Number.isFinite(p.torchPower) && p.torchPower >= 0)) throw Error(`goblin-field palette "${p.id}": torchPower is a number >= 0`); }
  for (const b of backdrops) {
    const frac = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
    if (!(frac(b.x0) && frac(b.x1) && frac(b.y0) && frac(b.y1) && b.x0 < b.x1 && b.y0 < b.y1)) throw Error(`goblin-field backdrop "${b.id}": the crop is fractions of the picture, 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1`);
    if (!(Number.isInteger(b.repeat) && b.repeat >= 2 && b.repeat % 2 === 0)) throw Error(`goblin-field backdrop "${b.id}": repeat is an even whole number (mirrored copies meet round the dome)`);
    if (!(b.texW > 0 && b.texH > 0 && frac(b.fadeTop) && frac(b.fadeFoot) && b.fadeTop + b.fadeFoot < 1)) throw Error(`goblin-field backdrop "${b.id}": texW/texH > 0, fadeTop + fadeFoot < 1`);
    if (!/^[a-z0-9/_.-]+\.(webp|png|jpg)$/.test(b.file) || b.file.startsWith('/')) throw Error(`goblin-field backdrop "${b.id}": file is a picture path under the page base, no leading slash`);
  }
  for (const p of palettes) for (const k of ['backdropPortrait', 'backdropLandscape'] as const) if (p[k] && !backdrops.some((b) => b.id === p[k])) throw Error(`goblin-field palette "${p.id}" ${k}: "${p[k]}" names no backdrop row`);
  for (const h of harmonics) if (!(h.k > 0 && Number.isInteger(h.k) && h.a > 0)) throw Error(`goblin-field harmonic "${h.id}": k is a whole number of periods > 0 (the ridge closes at the seam), a > 0`);
  if (!harmonics.length) throw Error('goblin-field: the dome ridge needs at least one harmonic row');
  for (const must of ['zone', 'palette', 'kit']) if (!names.some((n) => n.id === must)) throw Error(`goblin-field: the look needs its "${must}" name row`);
  if (!palettes.some((p) => p.id === names.find((n) => n.id === 'palette')!.text)) throw Error('goblin-field: the "palette" name row names a palette row');
  return { rules, tints, palettes, backdrops, harmonics, names };
}
const LOADED = loadGoblinField(DEFS);
export const goblinRule = (id: (typeof RULES)[number]): number => LOADED.rules.find((r) => r.id === id)!.value;
export const goblinTint = (id: (typeof TINTS)[number]): [number, number, number] => { const t = LOADED.tints.find((x) => x.id === id)!; return [t.r, t.g, t.b]; };
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
/** The world zone a zone row puts the camp kit in: `look.props.kit` set to this kit's name row, in `look.props.camp` (a world zone of this zone) or else its first world zone; null = no camp. */
export function zoneCamp(z: ZoneLookFields): string | null {
  if (zoneSet(z, 'look.props.kit') !== LOADED.names.find((n) => n.id === 'kit')!.text) return null;
  const at = zoneSet(z, 'look.props.camp');
  return typeof at === 'string' && at && z.world.includes(at) ? at : (z.world[0] ?? null);
}
export const goblinHarmonics = (): readonly { k: number; a: number }[] => LOADED.harmonics;
export const goblinZone = (): string => LOADED.names.find((n) => n.id === 'zone')!.text;

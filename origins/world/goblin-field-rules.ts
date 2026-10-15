// The goblin field's look as data (World, 2026-10-15, Dom's zone looks via the look-test route): the near-ground kit (palisade stakes, totems, smoking fires, dead trees, bones), the
// fire's smoke, and the painted horizon dome, one row each through the shared loader (src/core/registry.ts). Nothing here is read by the sim, so it is NOT part of the world digest.
// Pure, and page- and server-safe. Every number the look module reads is a row; a missing or non-positive named rule is refused.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './goblin-field-defs.json' with { type: 'json' };
import MANIFEST from './goblin-field-defs.manifest.json' with { type: 'json' };

export type GoblinRule = { readonly id: string; readonly value: number; readonly unit: string };
type Raw = { rules?: readonly unknown[]; tints?: readonly unknown[]; sky?: readonly unknown[]; names?: readonly unknown[] };
const RULES = ['palisadeSegments', 'palisadeStakes', 'stakeSpacing', 'stakeHMin', 'stakeHMax', 'stakeR', 'railLow', 'railHigh', 'totemCount', 'totemHMin', 'totemHMax', 'bonePiles', 'boneRibs', 'fireCount', 'fireStones', 'fireRing', 'fireLogs', 'treeClumps', 'treesPerClump', 'treeHMin', 'treeHMax', 'clusterRadius', 'clusterDepth', 'clearOfRoad', 'smokeCount', 'smokeRise', 'smokeSpeed', 'smokeSize0', 'smokeSize1', 'smokeOpacity', 'domeRadius', 'domeHalf', 'ridgeAmp', 'ridgeSeed', 'ridgeFarShift', 'smokeColumns', 'texW', 'texH'] as const;
const TINTS = ['wood', 'woodDark', 'bone', 'ochre', 'hide', 'ring', 'ember', 'dead', 'rope'] as const, SKY = ['zenith', 'mid', 'horizon', 'glow', 'ridge', 'ridgeFar', 'smoke'] as const;
/** The one loader: every table keyed by id (a duplicate id or a missing or mistyped field is refused), every named row must exist, numbers positive, colours #rrggbb. */
export function loadGoblinField(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'goblin-field-defs.json')));
  const rules = (raw.rules ?? []) as readonly GoblinRule[], tints = (raw.tints ?? []) as readonly { id: string; r: number; g: number; b: number }[], sky = (raw.sky ?? []) as readonly { id: string; hex: string }[], names = (raw.names ?? []) as readonly { id: string; text: string }[];
  for (const r of rules) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`goblin-field "${r.id}": value is a number > 0`);
  for (const must of RULES) if (!rules.some((r) => r.id === must)) throw Error(`goblin-field: the look reads the "${must}" rule by name, so it needs a row`);
  for (const must of TINTS) if (!tints.some((t) => t.id === must)) throw Error(`goblin-field: the look reads the "${must}" tint by name, so it needs a row`);
  for (const must of SKY) { const s = sky.find((x) => x.id === must); if (!s) throw Error(`goblin-field: the dome reads the "${must}" sky colour by name, so it needs a row`); if (!/^#[0-9a-f]{6}$/i.test(s.hex)) throw Error(`goblin-field "${must}": hex is #rrggbb`); }
  if (!names.some((n) => n.id === 'zone')) throw Error('goblin-field: the look needs its "zone" name row');
  return { rules, tints, sky, names };
}
const LOADED = loadGoblinField(DEFS);
export const goblinRule = (id: (typeof RULES)[number]): number => LOADED.rules.find((r) => r.id === id)!.value;
export const goblinTint = (id: (typeof TINTS)[number]): [number, number, number] => { const t = LOADED.tints.find((x) => x.id === id)!; return [t.r, t.g, t.b]; };
export const goblinSky = (id: (typeof SKY)[number]): string => LOADED.sky.find((x) => x.id === id)!.hex;
export const goblinZone = (): string => LOADED.names.find((n) => n.id === 'zone')!.text;

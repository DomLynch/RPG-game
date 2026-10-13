// The origins world's layout and terrain numbers as data (World, Dom's data-layer rule 2026-10-13): the terrain noise (octaves, gain, lacunarity, warp), how far a flattened pad blends into the
// hills, the town's road clearance and the building kit's wall module. One `rules` row each (id, value, unit) through the shared loader (src/core/registry.ts); every default equals the
// literal it replaced (tests/layout-rules.test.ts pins them). None of these is read by the sim, so this table is NOT part of the world digest and a retune needs no WORLD_SIM_VERSION bump. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './layout-rules-defs.json' with { type: 'json' };
import MANIFEST from './layout-rules-defs.manifest.json' with { type: 'json' };

export type LayoutRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['terrainOctaves', 'terrainGain', 'terrainLacunarity', 'terrainWarp', 'padBlend', 'roadHalf', 'buildingModule'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every rule the world reads by name must exist, with a positive value. */
export function loadLayoutRules(raw: { rules?: readonly unknown[] }): readonly LayoutRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'layout-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly LayoutRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`layout-rules "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`layout-rules: the world reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const LAYOUT_RULES: readonly LayoutRule[] = loadLayoutRules(DEFS);
export const layoutRule = (id: (typeof NAMED)[number]): number => LAYOUT_RULES.find((r) => r.id === id)!.value;

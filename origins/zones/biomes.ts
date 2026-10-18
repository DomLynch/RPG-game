// Shared zone presets (A1): a zone names a `biome` and overrides fields by reference; changing a row here changes every zone in that biome. A row is a partial spec in the same nested shape a zone file uses
// (resolve.ts flattens both through the one field registry, schema.ts). Rows hold only fields that mean something: the ids below are the ones the world data already uses (origins/region1/world.ts
// params: weather 'dust', sound 'wind', ground 'ash'). More biomes (pine-forest, marsh) are added when a zone needs them, not before. The Zone 1/2 look rows (zone1 / frontier-* duplicates) fold into this
// preset in the migration slice (A2).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './biomes.json' with { type: 'json' };
import MANIFEST from './biomes.manifest.json' with { type: 'json' };
export type Spec = { [key: string]: unknown };
export const DEFAULT_BIOME = 'ash-wastes';
loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'biomes.json')]);
export const BIOMES: Readonly<Record<string, Spec>> = DEFS.biomes;   // the rows live in biomes.json (a biome is one entry; Dom's data-layer rule 2026-10-13, was biomes-data.ts)

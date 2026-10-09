// Shared zone presets (A1): a zone names a `biome` and overrides fields by reference; changing a row here changes every zone in that biome. A row is a partial spec in the same nested shape a zone file uses
// (resolve.ts flattens both through the one field registry, schema.ts). Rows hold only fields that mean something: the ids below are the ones the world data already uses (origins/region1/world.ts
// params: weather 'dust', sound 'wind', ground 'ash'). More biomes (pine-forest, marsh) are added when a zone needs them, not before. The Zone 1/2 look rows (zone1 / frontier-* duplicates) fold into this
// preset in the migration slice (A2).
export type Spec = { [key: string]: unknown };
export const DEFAULT_BIOME = 'ash-wastes';
export const BIOMES: Readonly<Record<string, Spec>> = {
  'ash-wastes': { look: { weather: { preset: 'dust' }, ground: { material: 'ash' } }, sound: { ambience: 'wind', footsteps: 'ash' } },
};

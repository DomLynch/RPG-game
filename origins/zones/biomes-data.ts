// The biome presets as pure literal data (one typed const, nothing that runs), so a biome edit ships as a data-only PR. The meaning of a row, and the DEFAULT_BIOME, are in biomes.ts.
import type { Spec } from './biomes.ts';

const biomes: Record<string, Spec> = {
  'ash-wastes': { look: { weather: { preset: 'dust' }, ground: { material: 'ash' } }, sound: { ambience: 'wind', footsteps: 'ash' } },
};
export default biomes;

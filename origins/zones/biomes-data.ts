// The biome presets as pure literal data (one typed const, nothing that runs), so a biome edit ships as a data-only PR. The meaning of a row, and the DEFAULT_BIOME, are in biomes.ts.
import type { Spec } from './biomes.ts';

const biomes: Record<string, Spec> = {
  'ash-wastes': { look: { weather: { preset: 'dust' }, ground: { material: 'ash' } }, sound: { ambience: 'wind', footsteps: 'ash' } },
  // Zone 4 (donor, mood only: OpenMW's Bitter Coast region, a green-grey swamp under low light; no values taken): a cold green fog close in, a low pale sun, dim sky and damp dark ground, the ground tinted green.
  'drowned-marsh': { look: { fog: { colour: '#3f5a4c', density: 0.03 }, sun: { colour: '#b9d6c4', intensity: 3.4, pos: [-18, 8, -20] }, ambient: { sky: '#7f9c94', ground: '#27382e', intensity: 1.05 }, exposure: 1.15, ground: { tint: [0.55, 0.64, 0.5] }, weather: { preset: 'dust' } }, sound: { ambience: 'wind', footsteps: 'dirt' } },
};
export default biomes;

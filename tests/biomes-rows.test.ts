import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { BIOMES, DEFAULT_BIOME } from '../origins/zones/biomes.ts';
import biomesData from '../origins/zones/biomes.json' with { type: 'json' };
import biomesPackages from '../origins/zones/biomes.packages.json' with { type: 'json' };

// The biome presets were a TypeScript literal (biomes-data.ts); they are rows in biomes.json now (Dom's data-layer rule 2026-10-13). Pinned, byte for byte (JSON text, so key order counts), to the literal they replaced.
test('the biome rows equal the literal they replaced', () => {
  const was = {
    'ash-wastes': { look: { weather: { preset: 'dust' }, ground: { material: 'ash' } }, sound: { ambience: 'wind', footsteps: 'ash' } },
    'drowned-marsh': { look: { fog: { colour: '#3f5a4c', density: 0.03 }, sun: { colour: '#b9d6c4', intensity: 3.4, pos: [-18, 8, -20] }, ambient: { sky: '#7f9c94', ground: '#27382e', intensity: 1.05 }, exposure: 1.15, ground: { tint: [0.55, 0.64, 0.5] }, weather: { preset: 'dust' } }, sound: { ambience: 'wind', footsteps: 'dirt' } },
  };
  assert.equal(JSON.stringify(biomesData.biomes), JSON.stringify(was));   // the shared presets (biomes.json); a package's own presets ride in biomes.packages.json
  assert.deepEqual(Object.keys(BIOMES), [...Object.keys(was), ...Object.keys(biomesPackages.biomes)], 'BIOMES = the shared presets then the packages\' (goblin-fortress from zone 90)');
  assert.equal(DEFAULT_BIOME, 'ash-wastes');
});

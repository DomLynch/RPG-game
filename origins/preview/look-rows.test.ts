// The two looks that used to be literals in look.ts are `lookPreset` rows (look-rows.json): every field equals the literal it replaced, and the manifest accepts the rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import ROWS from './look-rows.json' with { type: 'json' };
import MANIFEST from './look-rows.manifest.json' with { type: 'json' };
import { PRESETS } from './look.ts';

test('ash-pit and exchange-dusk equal the literals they replaced', () => {
  assert.deepEqual(PRESETS['ash-pit'], { fog: '#c9a47a', fogDensity: 0.02, hemiSky: '#9fb2d4', hemiGround: '#4a3426', hemiIntensity: 1.25, sunColor: '#ffb46a', sunIntensity: 5.2, sunPos: [-24, 12, -15], exposure: 1.3, ground: [1, 1, 1] });
  assert.deepEqual(PRESETS['exchange-dusk'], { fog: '#8f5f3f', fogDensity: 0.024, hemiSky: '#7d86ad', hemiGround: '#3a2418', hemiIntensity: 0.95, sunColor: '#ff9a52', sunIntensity: 3.4, sunPos: [-24, 7, -15], exposure: 1.25, ground: [0.92, 0.88, 0.84] });
  assert.deepEqual(Object.keys(PRESETS).slice(0, 2), ['ash-pit', 'exchange-dusk'], 'the two row looks stay first, as before');
});

test('the registry loader accepts the rows and refuses a row with no fog', () => {
  const t = (rows: unknown[]) => tableFromFile(MANIFEST.tables[0] as unknown as Manifest, { lookPreset: rows } as never, 'look-rows.json');
  loadRegistry([t(ROWS.lookPreset)]);
  assert.throws(() => loadRegistry([t([{ ...ROWS.lookPreset[0]!, fog: undefined }])]));
});

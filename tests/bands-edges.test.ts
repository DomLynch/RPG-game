// Positioning bands, the FIXED-cm edges mode (BULK-CS, ruling B; Dom's sandbox numbers): inner under 135 cm, mid up to 180 cm, outer beyond, for every weapon; an off-band blow lands x0.4 (offBandMultCm). The span-FRACTIONS mode is pinned in
// tests/bands.test.ts (edgesMode 0). Both stay behind `Duel.bands` (default off: no flag, no change).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, OFF_BAND, bandAt, bandFactor, bestRange } from '../src/fight/bands.ts';
import BAND_DEFS from '../src/fight/band-defs.json' with { type: 'json' };

test('the shipped rows are the fixed-cm mode with Dom\'s numbers', () => {
  const rule = (id: string) => (BAND_DEFS.rules as { id: string; value: number }[]).find((r) => r.id === id)!.value;
  assert.deepEqual([rule('edgesMode'), rule('innerEdgeCm'), rule('midEdgeCm'), rule('offBandMultCm')], [1, 135, 180, 0.4]);
  assert.deepEqual([...BANDS], ['inner', 'mid', 'outer']);
  assert.ok(OFF_BAND > 0 && OFF_BAND <= 1, 'the fractions mode multiplier stays what it was');
});

test('the same metres for every weapon: inner < 1.35, mid < 1.8, outer beyond', () => {
  for (const w of ['knife', 'longsword', 'trident'] as const) {
    assert.equal(bandAt(w, 1.0), 'inner'); assert.equal(bandAt(w, 1.34), 'inner');
    assert.equal(bandAt(w, 1.35), 'mid'); assert.equal(bandAt(w, 1.79), 'mid');
    assert.equal(bandAt(w, 1.8), 'outer'); assert.equal(bandAt(w, 3), 'outer');
  }
});

test('a blow off the weapon\'s best band lands at x0.4, in band x1; a weapon with no band row is never scaled', () => {
  assert.equal(bandFactor('knife', 1.0), 1); assert.equal(bandFactor('knife', 2.0), 0.4);
  assert.equal(bandFactor('longsword', 1.5), 1); assert.equal(bandFactor('longsword', 1.0), 0.4);
  assert.equal(bandFactor('trident', 2.5), 1); assert.equal(bandFactor('trident', 1.5), 0.4);
  assert.equal(bandFactor('kick' as never, 3), 1);
});

test('the best range of each band reads the fixed edges (the AI\'s holdBand steps to it)', () => {
  assert.deepEqual(bestRange('longsword'), [1.35, 1.8]);
  assert.equal(bestRange('knife')![1], 1.35);
  assert.equal(bestRange('trident')![0], 1.8);
});

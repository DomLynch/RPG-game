// sandbox-mech: reach bands. A landed blow outside its weapon's best distance band deals bandOff per-mille of its damage; bandOff 0 / no rows = trunk (untouched). No marker, no refusal: a band only scales a blow that already lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value?: number }[]; bands: { id: string; upTo: number }[]; bandBest: { weapon: string; band: string }[] };
const off = d.rules.find((r) => r.id === 'bandOff')!;
const shipped = [off.value, d.bands.length, d.bandBest.length];
off.value = 600;
d.bands.push({ id: 'inner', upTo: 130 }, { id: 'mid', upTo: 190 }, { id: 'outer', upTo: 100000 });
d.bandBest.push({ weapon: 'knife', band: 'inner' }, { weapon: 'longsword', band: 'mid' }, { weapon: 'trident', band: 'outer' });
const { bandOf, bandPerMille } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships bands off', () => assert.deepEqual(shipped, [0, 0, 0]));
test('distance falls in inner, mid, outer', () => {
  assert.deepEqual([1.0, 1.29, 1.3, 1.89, 1.9, 2.4].map(bandOf), ['inner', 'inner', 'mid', 'mid', 'outer', 'outer']);
});
test('in its band a weapon deals all, outside it 600 per mille', () => {
  assert.equal(bandPerMille('knife', 1.0), 1000); assert.equal(bandPerMille('knife', 1.5), 600);
  assert.equal(bandPerMille('longsword', 1.6), 1000); assert.equal(bandPerMille('longsword', 1.0), 600);
  assert.equal(bandPerMille('trident', 2.2), 1000); assert.equal(bandPerMille('trident', 1.5), 600);
});
test('a weapon with no band row is untouched', () => assert.equal(bandPerMille('fists', 1.0), 1000));

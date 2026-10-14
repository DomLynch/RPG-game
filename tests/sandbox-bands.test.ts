// sandbox-mech: reach bands. A landed blow outside its weapon's best distance band deals bandOff per-mille of its damage; bandOff 0 / no rows = trunk (untouched). No marker, no refusal: a band only scales a blow that already lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { rules: { id: string; value?: number }[]; bands: { id: string; upTo: number }[]; bandBest: { weapon: string; band: string }[] };
const off = d.rules.find((r) => r.id === 'bandOff')!;
const shipped = [off.value, d.bands.length, d.bandBest.length];
off.value = 600;
d.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
d.bandBest.push({ weapon: 'knife', band: 'inner' }, { weapon: 'longsword', band: 'mid' }, { weapon: 'trident', band: 'outer' });
const { bandOf, bandPerMille, bandStop } = await import('../src/fight/sandbox-rules.ts');

test('trunk ships bands off', () => assert.deepEqual(shipped, [0, 0, 0]));
test('distance falls in inner, mid, outer', () => {
  assert.deepEqual([1.0, 1.34, 1.35, 1.79, 1.8, 2.4].map(bandOf), ['inner', 'inner', 'mid', 'mid', 'outer', 'outer']);
});
test('in its band a weapon deals all, outside it 600 per mille', () => {
  assert.equal(bandPerMille('knife', 1.0), 1000); assert.equal(bandPerMille('knife', 1.5), 600);
  assert.equal(bandPerMille('longsword', 1.6), 1000); assert.equal(bandPerMille('longsword', 1.0), 600);
  assert.equal(bandPerMille('trident', 2.2), 1000); assert.equal(bandPerMille('trident', 1.5), 600);
});
test('a weapon with no band row is untouched', () => assert.equal(bandPerMille('fists', 1.0), 1000));
test('the AI approach stops inside the weapon\'s band and can still start the planned move', () => {
  assert.equal(bandStop('longsword', 1.15, 1.65), 1.4, 'a sword with close 1.15 steps out to the mid band (1.35 + .05), still inside light reach - .1');
  assert.equal(bandStop('knife', 1, 1.2), 1, 'a knife already in the inner band keeps its own close');
  assert.equal(bandStop('trident', 1.4, 1.75), 1.4, 'the outer band is out of a trident light\'s reach: trunk close');
  assert.equal(bandStop('fists', 1.1, 1.2), 1.1, 'no band row: trunk close');
});
test('an off-band hit lands as a glance: no impact frames, no camera knock', async () => {
  const { impactTier, IMPACT } = await import('../src/fight/hit-impact.ts');
  assert.equal(impactTier({ tick: 1, type: 'Hit', actor: 0, target: 1, move: 'light_right', glance: true } as never), 'glance');
  assert.equal(impactTier({ tick: 1, type: 'Hit', actor: 0, target: 1, move: 'light_right' } as never), 'half');
  assert.deepEqual(IMPACT.glance, { frames: 0, knock: 0, push: 0 });
});

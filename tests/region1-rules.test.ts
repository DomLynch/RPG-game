// Region 1's spec numbers and its two world layers are data (origins/region1/region1-rules.json, region1-world.json): every value equals the literal it replaced.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOUNTY_DAILY_CAP, BOUNTY_METAL, MIN_TOWNS_FOR_WAR, TIERS, TOWN_SAFE_CLEARANCE_M, maxOf, span, tierOf } from '../origins/region1/load.ts';
import { REGION1_WORLD, EXCHANGE_REGION, FRONTIER_REGION } from '../origins/region1/world.ts';

test('the region1 rules equal the literals they replaced', () => {
  assert.deepEqual([BOUNTY_METAL, BOUNTY_DAILY_CAP, MIN_TOWNS_FOR_WAR, TOWN_SAFE_CLEARANCE_M], [{ min: 30, max: 50 }, { min: 1, max: 3 }, 3, 30]);
  assert.deepEqual(TIERS.map((t) => [t.tier, t.from, t.services, t.title]), [['ruin', 0, 0, null], ['hamlet', 50, 1, 'reeve'], ['village', 200, 2, 'reeve'], ['town', 450, 3, 'mayor'], ['city', 750, 4, 'lord']]);
  assert.equal(tierOf(449).tier, 'village');
  assert.equal(tierOf(450).tier, 'town');
});
test('the content bounds are rows of region1-rules.json, one per field, equal to the literals the loader and the encounter overlay check each carried', () => {
  assert.deepEqual([span('flee-at.percent'), span('flee-at.catchSeconds'), span('hazard.stillSeconds')], [[1, 99], [1, 120], [1, 30]]);   // the twist bounds encounters.ts used to repeat
  assert.deepEqual([span('town.startProsperity'), span('rift-site.weight'), span('rift-boss.levelOver'), span('rift-boss.weight')], [[50, 1000], [1, 100], [0, 10], [1, 100]]);
  assert.deepEqual(['perDayMin', 'perDayMax', 'minGapSeconds', 'warnSeconds', 'openSeconds', 'siteCooldownSeconds', 'townClearanceMetres', 'lootRollsPerWeek'].map((k) => span(`rift-scheduler.${k}`)),
    [[0, 24], [1, 24], [0, 86400], [60, 604800], [60, 604800], [60, 604800], [0, 1000], [1, 50]]);
  assert.deepEqual(['town.name', 'town.ruler.successors', 'town.services', 'town.resources', 'bounty.name'].map(maxOf), [60, 8, 4, 8, 60]);
  assert.throws(() => span('no.such'), /not a row/);          // an unknown key fails loud, never a silent default
  assert.throws(() => span('town.name'), /needs min and max/);   // a length bound is not a span
});
test('the two world layers still build the region: the quarter is not safe, the Frontier is 11 to 15', () => {
  const ex = REGION1_WORLD.regions[EXCHANGE_REGION]!, fr = REGION1_WORLD.regions[FRONTIER_REGION]!;
  assert.equal((ex.zones['exchange-quarter'] as { rules: { safe: boolean } }).rules.safe, false);
  assert.deepEqual([(fr.params as { difficulty: { levelMin: number; levelMax: number } }).difficulty.levelMin, (fr.params as { difficulty: { levelMax: number } }).difficulty.levelMax], [11, 15]);
});

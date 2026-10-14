// Region 1's spec numbers and its two world layers are data (origins/region1/region1-rules.json, region1-world.json): every value equals the literal it replaced.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOUNTY_DAILY_CAP, BOUNTY_METAL, MIN_TOWNS_FOR_WAR, TIERS, TOWN_SAFE_CLEARANCE_M, tierOf } from '../origins/region1/load.ts';
import { REGION1_WORLD, EXCHANGE_REGION, FRONTIER_REGION } from '../origins/region1/world.ts';

test('the region1 rules equal the literals they replaced', () => {
  assert.deepEqual([BOUNTY_METAL, BOUNTY_DAILY_CAP, MIN_TOWNS_FOR_WAR, TOWN_SAFE_CLEARANCE_M], [{ min: 30, max: 50 }, { min: 1, max: 3 }, 3, 30]);
  assert.deepEqual(TIERS.map((t) => [t.tier, t.from, t.services, t.title]), [['ruin', 0, 0, null], ['hamlet', 50, 1, 'reeve'], ['village', 200, 2, 'reeve'], ['town', 450, 3, 'mayor'], ['city', 750, 4, 'lord']]);
  assert.equal(tierOf(449).tier, 'village');
  assert.equal(tierOf(450).tier, 'town');
});
test('the two world layers still build the region: the quarter is not safe, the Frontier is 11 to 15', () => {
  const ex = REGION1_WORLD.regions[EXCHANGE_REGION]!, fr = REGION1_WORLD.regions[FRONTIER_REGION]!;
  assert.equal((ex.zones['exchange-quarter'] as { rules: { safe: boolean } }).rules.safe, false);
  assert.deepEqual([(fr.params as { difficulty: { levelMin: number; levelMax: number } }).difficulty.levelMin, (fr.params as { difficulty: { levelMax: number } }).difficulty.levelMax], [11, 15]);
});

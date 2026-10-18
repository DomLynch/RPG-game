import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MAX_LEVEL, OLD_MAX_LEVEL, DIAL_TRAIL, RANK_STEPS } from '../src/core/career-ladder.ts';
import { FREE_RESPREAD_LEVEL, RANK_LEVELS } from '../src/core/build-model.ts';
import { falloffPermille, partySharePermille, LEVEL_CURVE, TYPE_WEIGHTS, MAX_PARTY, MIN_CONTRIBUTION_PERMILLE, HEAT_UNIT_S, FREE_REPEATS, RESTED_PER_DAY_CP, RESTED_CAP_CP } from '../src/core/career-model.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import careerRules from '../src/core/career-rules.json' with { type: 'json' };
import careerManifest from '../src/core/career-rules.manifest.json' with { type: 'json' };
import practiceRules from '../origins/server/practice-rules.json' with { type: 'json' };
import practiceManifest from '../origins/server/practice-rules.manifest.json' with { type: 'json' };

test('career pacing rows: the exports keep the numbers they had in code', () => {
  assert.deepEqual([MAX_PARTY, MIN_CONTRIBUTION_PERMILLE, HEAT_UNIT_S, FREE_REPEATS, RESTED_PER_DAY_CP, RESTED_CAP_CP], [4, 100, 360, 3, 1500, 3000]);
  assert.deepEqual(practiceRules.practiceRule, [{ id: 'practice', practiceUnit: 10, xpPerPoint: 100 }]);
});

test('the falloff rows and the party step rebuild the if-chain and the 200 they replaced, for every level gap', () => {
  const old = (d: number): number => (d >= 3 ? 1250 : d >= 1 ? 1100 : d === 0 ? 1000 : d >= -2 ? 900 : d >= -4 ? 500 : d >= -RANK_STEPS ? 200 : 0);
  for (let d = -30; d <= 30; d++) assert.equal(falloffPermille(d), old(d), `d=${d}`);
  assert.equal(Math.min(...careerRules.falloff.map((r) => r.minDiff)), -RANK_STEPS);   // the grey line is one title below
  assert.equal(careerRules.careerRule[0]!.partyStep, 200);
  assert.deepEqual([2, 3, 4].map(partySharePermille), [800, 566, 450]);
});

test('career and practice rule files load through the registry, one row each', () => {
  for (const [raw, man, name] of [[careerRules, careerManifest, 'career-rules.json'], [practiceRules, practiceManifest, 'practice-rules.json']] as const) {
    const reg = loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, name)));
    assert.ok(reg);
    assert.equal(Object.values(raw)[0]!.length, 1);
  }
});

test('type weight rows rebuild the trunk TYPE_WEIGHTS table byte for byte', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(TYPE_WEIGHTS)).digest('hex'), '5161299244e3fa308b67c1a790671e07b3dbcae86d636cf4845431f4abca1e59');
});

test('the level curve row rebuilds the LEVEL_CURVE literal it replaced, field for field', () => {
  assert.deepEqual(LEVEL_CURVE, {
    maxLevel: 100, boss: 'world-boss', killBase: 1000, killStep: 100, early: { levels: 5, kills: 2500 }, ramp: 200, rank: 2000, rankLevels: 10,
    opening: [1, 1, 1, 1, 1, 6, 6, 6, 6, 6],
  });
});

test('the level curve boss is a live typeWeight row (a ref the registry checks)', () => {
  assert.ok(loadRegistry(careerManifest.tables.map((t) => tableFromFile(t as unknown as Manifest, careerRules, 'career-rules.json'))));
  const bad = { ...careerRules, levelCurve: [{ ...careerRules.levelCurve[0]!, boss: 'no-such-type' }] };
  assert.throws(() => loadRegistry(careerManifest.tables.map((t) => tableFromFile(t as unknown as Manifest, bad, 'career-rules.json'))));
});

test('the ladder and respec rows hold today\'s literals and equal the exports Backend will point at them (one fact, one place)', () => {
  assert.deepEqual(careerRules.ladderRule, [{ id: 'ladder', maxLevel: 50, oldMaxLevel: 46, dialTrail: 5 }]);
  assert.deepEqual(careerRules.respecRule, [{ id: 'respec', freeRespreadLevel: 10 }]);
  const ladder = careerRules.ladderRule[0]!, respec = careerRules.respecRule[0]!;
  assert.deepEqual([ladder.maxLevel, ladder.oldMaxLevel, ladder.dialTrail], [MAX_LEVEL, OLD_MAX_LEVEL, DIAL_TRAIL]);
  assert.equal(respec.freeRespreadLevel, FREE_RESPREAD_LEVEL);
  assert.equal(careerRules.levelCurve[0]!.rankLevels, RANK_LEVELS);
  assert.ok(loadRegistry(careerManifest.tables.map((t) => tableFromFile(t as unknown as Manifest, careerRules, 'career-rules.json'))));
});

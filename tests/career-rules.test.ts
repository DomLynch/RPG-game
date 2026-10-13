import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LEVEL_CURVE, TYPE_WEIGHTS, MAX_PARTY, MIN_CONTRIBUTION_PERMILLE, HEAT_UNIT_S, FREE_REPEATS, RESTED_PER_DAY_CP, RESTED_CAP_CP } from '../src/core/career-model.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import careerRules from '../src/core/career-rules.json' with { type: 'json' };
import careerManifest from '../src/core/career-rules.manifest.json' with { type: 'json' };
import practiceRules from '../origins/server/practice-rules.json' with { type: 'json' };
import practiceManifest from '../origins/server/practice-rules.manifest.json' with { type: 'json' };

test('career pacing rows: the exports keep the numbers they had in code', () => {
  assert.deepEqual([MAX_PARTY, MIN_CONTRIBUTION_PERMILLE, HEAT_UNIT_S, FREE_REPEATS, RESTED_PER_DAY_CP, RESTED_CAP_CP], [4, 100, 360, 3, 1500, 3000]);
  assert.deepEqual(practiceRules.practiceRule, [{ id: 'practice', practiceUnit: 10, xpPerPoint: 100 }]);
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

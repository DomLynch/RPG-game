// The stage's numbers are rows (origins/world/stage-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGE_RULES, loadStageRules, stageRule } from '../origins/world/stage-rules.ts';
import { CROWD, SKIRMISHER_HANDOVER, LEADER_HOLD, SWEEP } from '../origins/crowd/crowd.ts';
import { KERB_INSET, STONE_RADIUS } from '../origins/preview/exchange-plan.ts';
import { CINDER } from '../origins/preview/frontier-cinder.ts';
import { EDGE_FADE, PAD_MARGIN, LANDMARK_PAD } from '../origins/preview/frontier-relief.ts';
import { LEVEL_NEAR_M, LEVEL_FAR_M } from '../origins/preview/mobs.ts';
import DEFS from '../origins/world/stage-rules-defs.json' with { type: 'json' };

test('every stage rule equals the literal it replaced', () => {
  assert.deepEqual(CROWD, { breath: 45, starts: 3, hold: 360, minPassGap: 120, ring: { min: 4, max: 6 }, ringReturn: 0.02, maxEnemies: 8 });
  assert.deepEqual([SKIRMISHER_HANDOVER, LEADER_HOLD, SWEEP], [{ starts: 2, hold: 240 }, 240, { reach: 2.5, delay: 60 }]);
  assert.deepEqual([KERB_INSET, STONE_RADIUS, EDGE_FADE, PAD_MARGIN, LANDMARK_PAD, LEVEL_NEAR_M, LEVEL_FAR_M], [4, 2.6, 6, 2.5, 7, 30, 150]);
  assert.deepEqual(CINDER, { beyond: 120, skylineGap: [3, 15], skylineStep: [6, 12] });
  assert.deepEqual(['mobsSeed', 'cinderSlab', 'cinderDrift', 'cinderRingA', 'cinderRingB', 'cinderLip', 'cinderCore', 'dressSlab', 'landmarkR', 'spawnNear', 'spawnFar', 'namedLevelLift'].map((id) => stageRule(id as never)), [0x6d6f6273, 0.03, 0.065, 0.105, 0.11, 0.112, 0.118, 0.04, 3.5, 25, 35, 2]);
  assert.equal(STAGE_RULES.length, 37);
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadStageRules({ rules: rows.filter((r) => r.id !== 'crowdHold') }), /"crowdHold" rule by name/);
  assert.throws(() => loadStageRules({ rules: rows.map((r) => (r.id === 'edgeFade' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadStageRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadStageRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 37);
});

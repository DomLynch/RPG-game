// The stage's numbers as data (World, Dom's data-layer day 2026-10-14): the crowd's token rules, the mob stream seed and level/spawn rings, the Exchange kerb and stone, the Ash Frontier's
// ground decals, skyline and relief margins, the landmark footprint and the number of mob looks, one row each (id, value, unit) through the shared loader (src/core/registry.ts). Every default
// equals the literal it replaced (tests/stage-rules.test.ts pins them). None is read by the sim, so this table is NOT part of the world digest. Pure, and page- and server-safe (the renderer-free core door, like concord.ts).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './stage-rules-defs.json' with { type: 'json' };
import MANIFEST from './stage-rules-defs.manifest.json' with { type: 'json' };

export type StageRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['crowdBreath', 'crowdStarts', 'crowdHold', 'crowdMinPassGap', 'crowdRingMin', 'crowdRingMax', 'crowdRingReturn', 'crowdMaxEnemies', 'skirmisherStarts', 'skirmisherHold', 'leaderHold', 'sweepReach', 'sweepDelay', 'mobsSeed', 'kerbInset', 'stoneRadius', 'cinderSlab', 'cinderDrift', 'cinderRingA', 'cinderRingB', 'cinderLip', 'cinderCore', 'cinderBeyond', 'skylineGapMin', 'skylineGapMax', 'skylineStepMin', 'skylineStepMax', 'dressSlab', 'landmarkR', 'edgeFade', 'padMargin', 'landmarkPad', 'levelNear', 'levelFar', 'spawnNear', 'spawnFar'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every rule the stage reads by name must exist, with a positive value. */
export function loadStageRules(raw: { rules?: readonly unknown[] }): readonly StageRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'stage-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly StageRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`stage-rules "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`stage-rules: the stage reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const STAGE_RULES: readonly StageRule[] = loadStageRules(DEFS);
export const stageRule = (id: (typeof NAMED)[number]): number => STAGE_RULES.find((r) => r.id === id)!.value;

// The grouped shapes the code reads (the same objects the literals were), built from rows.
const r = stageRule;
export const crowdRules = () => ({ breath: r('crowdBreath'), starts: r('crowdStarts'), hold: r('crowdHold'), minPassGap: r('crowdMinPassGap'), ring: { min: r('crowdRingMin'), max: r('crowdRingMax') }, ringReturn: r('crowdRingReturn'), maxEnemies: r('crowdMaxEnemies') });
export const skirmisherHandover = () => ({ starts: r('skirmisherStarts'), hold: r('skirmisherHold') });
export const sweepRules = () => ({ reach: r('sweepReach'), delay: r('sweepDelay') });
export const cinderRules = () => ({ beyond: r('cinderBeyond'), skylineGap: [r('skylineGapMin'), r('skylineGapMax')] as const, skylineStep: [r('skylineStepMin'), r('skylineStepMax')] as const });

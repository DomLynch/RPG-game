// The coach's stance brains, per-foe lapse and per-stance lapse scale as rows (coach-defs.json; Dom 2026-10-13: every game number lives in a data row; Lead's as-data split 2026-10-17: Web takes src/coach.ts).
// Each value is byte-identical to the literal it replaced in coach.ts, so no coached fight changes. coach.ts is outside SIM_FILES (it reads a Duel and returns an Intent), so no RECORD_VERSION. Pure.
import { loadRegistry, tableFromFile, type Manifest } from './core/registry.ts';
import DEFS from './coach-defs.json' with { type: 'json' };
import MANIFEST from './coach-defs.manifest.json' with { type: 'json' };
import type { AiProfile } from './fight/moves.ts';
import type { PickedStance } from './fight/stance.ts';

const STANCE_T = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'coach-defs.json');
const FOE_T = tableFromFile(MANIFEST.tables[1] as unknown as Manifest, DEFS, 'coach-defs.json');
loadRegistry([STANCE_T, FOE_T]);
// The row id is `coach-<stance>` (the stance name itself is kept out of the id list the as-data branch rule reads) and the stance is a field.
const stances = STANCE_T.rows as unknown as { stance: PickedStance; lapseScale: number; brain: Partial<AiProfile> }[];
export const COACH_BRAINS = Object.fromEntries(stances.map((r) => [r.stance, r.brain])) as Readonly<Record<PickedStance, Partial<AiProfile>>>;
export const FOE_LAPSE_SCALE = Object.fromEntries(stances.map((r) => [r.stance, r.lapseScale])) as Readonly<Record<PickedStance, number>>;
export const FOE_LAPSE = Object.fromEntries((FOE_T.rows as unknown as { id: string; lapse: number }[]).map((r) => [r.id, r.lapse])) as Readonly<Record<string, number>>;

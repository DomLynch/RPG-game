// characters-dials.ts's named numbers as ROWS (Dom, "centralized game engine, no hard coding"; the debt entries in scripts/as-data/allow.json). One row per dial in characters-dials-defs.json, manifest-loaded through
// the shared registry; this file only hands characters-dials.ts the values it always held, bit for bit. Presentation only: not a sim file, not in the record digest.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './characters-dials-defs.json' with { type: 'json' };
import MANIFEST from './characters-dials-defs.manifest.json' with { type: 'json' };

const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'characters-dials-defs.json');
loadRegistry([TABLE]);
const ROWS = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));
const dial = (id: string): number => {
  const v = ROWS.get(id);
  if (v === undefined) throw Error(`characters-dials-defs: no dial ${id}`);
  return v;
};
export const DEFLECT_FROM = dial('DEFLECT_FROM');
export const STEP_MAX = dial('STEP_MAX');   // the longest mixer step a frame may take (s)
export const WALK_RATE_FLOOR = dial('WALK_RATE_FLOOR');   // the slowest armed-walk and strafe time scale
export const RUN_RATE_FLOOR = dial('RUN_RATE_FLOOR');   // the slowest armed-run time scale
export const CLIP_END = dial('CLIP_END');   // a driven clip's last time, just short of its wrap
export const RADIUS_MIN = dial('RADIUS_MIN'), RADIUS_MAX = dial('RADIUS_MAX');   // the bounds of a carried part's contact radius (m)
export const ARM_REACH_MIN = dial('ARM_REACH_MIN');   // the shortest shoulder-to-goal gap the two-bone arm solve takes (m)

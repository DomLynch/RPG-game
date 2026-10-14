// special-timing.ts's named numbers as ROWS (Dom, "centralized game engine, no hard coding"; the debt entries in scripts/as-data/allow.json). One row per dial in special-timing-defs.json, manifest-loaded through
// the shared registry; this file only hands special-timing.ts the values it always held, bit for bit. Presentation only: not a sim file, not in the record digest.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './special-timing-defs.json' with { type: 'json' };
import MANIFEST from './special-timing-defs.manifest.json' with { type: 'json' };

const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'special-timing-defs.json');
loadRegistry([TABLE]);
const ROWS = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));
const dial = (id: string): number => {
  const v = ROWS.get(id);
  if (v === undefined) throw Error(`special-timing-defs: no dial ${id}`);
  return v;
};
export const DROP_TICKS = dial('DROP_TICKS'), RIPPLE = dial('RIPPLE'), CAST_MARGIN = dial('CAST_MARGIN'), CUTS = dial('CUTS'), CUT_GAP = dial('CUT_GAP'), DISSOLVE_TICKS = dial('DISSOLVE_TICKS'), BOSS_TAIL = dial('BOSS_TAIL');

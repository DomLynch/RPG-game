// special-class-timing.ts's named numbers as ROWS (Dom, "centralized game engine, no hard coding"; the debt entries in scripts/as-data/allow.json). One row per dial in special-class-timing-defs.json, manifest-loaded through
// the shared registry; this file only hands special-class-timing.ts the values it always held, bit for bit. Presentation only: not a sim file, not in the record digest.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './special-class-timing-defs.json' with { type: 'json' };
import MANIFEST from './special-class-timing-defs.manifest.json' with { type: 'json' };

const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'special-class-timing-defs.json');
loadRegistry([TABLE]);
const ROWS = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));
const dial = (id: string): number => {
  const v = ROWS.get(id);
  if (v === undefined) throw Error(`special-class-timing-defs: no dial ${id}`);
  return v;
};
export const BACK_TICKS = dial('BACK_TICKS'), LATERAL = dial('LATERAL'), STEP_WINDOW = dial('STEP_WINDOW'), DRAG_FROM = dial('DRAG_FROM');

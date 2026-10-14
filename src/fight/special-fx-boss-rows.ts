// special-fx-boss.ts's named numbers as ROWS (Dom, "centralized game engine, no hard coding"; the debt entries in scripts/as-data/allow.json). One row per dial in special-fx-boss-defs.json, manifest-loaded through
// the shared registry; this file only hands special-fx-boss.ts the values it always held, bit for bit. Presentation only: not a sim file, not in the record digest.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './special-fx-boss-defs.json' with { type: 'json' };
import MANIFEST from './special-fx-boss-defs.manifest.json' with { type: 'json' };

const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'special-fx-boss-defs.json');
loadRegistry([TABLE]);
const ROWS = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));
const dial = (id: string): number => {
  const v = ROWS.get(id);
  if (v === undefined) throw Error(`special-fx-boss-defs: no dial ${id}`);
  return v;
};
export const PIT_MIST = dial('PIT_MIST'), PIT_STAIN = dial('PIT_STAIN'), PIT_BREATH = dial('PIT_BREATH'), MIST = dial('MIST'), GHOST = dial('GHOST'), FLIES = dial('FLIES'), WISP = dial('WISP'), RING = dial('RING'), VEILS = dial('VEILS'), DROPS = dial('DROPS');

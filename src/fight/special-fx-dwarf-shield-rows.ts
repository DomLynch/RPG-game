// special-fx-dwarf-shield.ts's named numbers as ROWS (Dom, "centralized game engine, no hard coding"; the debt entries in scripts/as-data/allow.json). One row per dial in special-fx-dwarf-shield-defs.json, manifest-loaded through
// the shared registry; this file only hands special-fx-dwarf-shield.ts the values it always held, bit for bit. Presentation only: not a sim file, not in the record digest.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './special-fx-dwarf-shield-defs.json' with { type: 'json' };
import MANIFEST from './special-fx-dwarf-shield-defs.manifest.json' with { type: 'json' };

const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'special-fx-dwarf-shield-defs.json');
loadRegistry([TABLE]);
const ROWS = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));
const dial = (id: string): number => {
  const v = ROWS.get(id);
  if (v === undefined) throw Error(`special-fx-dwarf-shield-defs: no dial ${id}`);
  return v;
};
export const DUST = dial('DUST'), GRIT = dial('GRIT'), STRIDE = dial('STRIDE'), NIGHT_CAP = dial('NIGHT_CAP');

// skill-impact's tables as ROWS (Dom, "centralized game engine, no hard coding"; the debt entries in scripts/as-data/allow.json). The numbers live in skill-impact-defs.json, manifest-loaded through the shared
// registry; this file only rebuilds, key for key and in the same order, the objects the sim files always held. A sim file: it imports only the shared row loader.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './skill-impact-defs.json' with { type: 'json' };
import MANIFEST from './skill-impact-defs.manifest.json' with { type: 'json' };

// IMPACT as the code held it before it became rows (comments are the owners' rulings):
// | { flash: 0.12, flashSize: 0.9, sparks: 10, life: 0.4, reach: 0.28 }
const IMPACT_T = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'skill-impact-defs.json');
loadRegistry([IMPACT_T]);
export const IMPACT_ROWS = Object.fromEntries((IMPACT_T.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value])) as unknown as { readonly flash: number; readonly flashSize: number; readonly sparks: number; readonly life: number; readonly reach: number };

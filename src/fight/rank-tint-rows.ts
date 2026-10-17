// rank-tint.ts's clamp bounds as a ROW (Dom, "always prioritise the data layer, no hard coding"; as-data check (e), scripts/as-data/clamp-baseline.json): the luma floor a grade or a map is divided by, the least a
// metalness map may be scaled down to and the most a roughness map may be scaled up to. One row in rank-tint-rules.json, manifest-loaded through the shared registry. Presentation only.
import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import RULES from './rank-tint-rules.json' with { type: 'json' };
import MANIFEST from './rank-tint-rules.manifest.json' with { type: 'json' };

const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, RULES, 'rank-tint-rules.json');
loadRegistry([TABLE]);
const ROW = TABLE.rows[0] as unknown as { lumaFloor: number; metalRatioFloor: number; roughRatioCap: number };
export const LUMA_FLOOR = ROW.lumaFloor, METAL_RATIO_FLOOR = ROW.metalRatioFloor, ROUGH_RATIO_CAP = ROW.roughRatioCap;

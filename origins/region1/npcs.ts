// Region 1's working townspeople as NPC rows (origins/npcs/row.ts), held as data in npcs-defs.json (Dom's data-layer rule 2026-10-13; tests/region1-npcs-rows.test.ts pins every row to the literal it replaced).
// The Concord Exchange: the banker (never closes: Dom, a 4 am phone player is never blocked), the provisioner (the Exchange shop, origins/region1/shops.ts), the innkeeper, the recorder; the Exchange Quarter's service NPCs
// at their town counters (TOWNS services in content.ts). Landmarks World has not placed yet are reported by the validator as `unplaced`, not
// refused. PROPOSED (Backend): the new characters' names and the hours other than the shop rule; Content/Strategy may retune.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import type { NpcRow } from '../npcs/row.ts';
import DEFS from './npcs-defs.json' with { type: 'json' };
import MANIFEST from './npcs-defs.manifest.json' with { type: 'json' };

loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DEFS, 'npcs-defs.json')]);
export const REGION1_NPCS: readonly NpcRow[] = DEFS.npcs as unknown as readonly NpcRow[];

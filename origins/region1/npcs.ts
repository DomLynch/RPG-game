// Region 1's working townspeople as NPC rows (origins/npcs/row.ts). The Concord Exchange: the banker (never closes: Dom, a 4 am phone player is
// never blocked), the provisioner (the Exchange shop, origins/region1/shops.ts), the innkeeper, the recorder; the Exchange Quarter's service NPCs
// at their town counters (TOWNS services in content.ts). Landmarks World has not placed yet are reported by the validator as `unplaced`, not
// refused. PROPOSED (Backend): the new characters' names and the hours other than the shop rule; Content/Strategy may retune.
import { SHOP_HOURS, type NpcRow } from '../npcs/row.ts';

export const REGION1_NPCS: readonly NpcRow[] = [
  { npc: 'character:banker-exchange', roles: ['banker'], zone: 'exchange', at: 'bank', hours: 'always' },
  { npc: 'character:provisioner-exchange', roles: ['vendor'], zone: 'exchange', at: 'forge', hours: SHOP_HOURS, shop: 'service:exchange-provisioner' },   // at the forge (grave iron is forge stock) until World builds a stall
  { npc: 'character:innkeeper-exchange', roles: ['innkeeper'], zone: 'exchange', at: 'inn', hours: 'always' },
  { npc: 'character:recorder-marrow', roles: ['recorder'], zone: 'exchange', at: 'contract-board', hours: SHOP_HOURS },
  { npc: 'character:smith-quarter', roles: ['smith'], zone: 'exchange-quarter', at: 'quarter-forge', hours: SHOP_HOURS },
  { npc: 'character:healer-quarter', roles: ['healer'], zone: 'exchange-quarter', at: 'quarter-healer', hours: SHOP_HOURS },
  { npc: 'character:fence-quarter', roles: ['fence'], zone: 'exchange-quarter', at: 'quarter-fence', hours: [20, 4] },   // the fence works the night
];

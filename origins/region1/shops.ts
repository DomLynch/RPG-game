// Region 1's NPC shops (Town plan A2; Dom 12:5x 2026-10-08: everything live, so the buy route ships with a list, not a 501). One shop for now, at the
// Concord Exchange: grave iron, the smith's upgrade material, so bronze from Frontier kills has somewhere to go. Common gear too (minted at the
// Region's loot tier). The list is ROWS (shops.json, loaded by the shared registry loader). PROPOSED numbers (Backend; Content/Strategy may retune): a scavenger kill pays 3-12 bronze and drops
// grave iron at ~20 %, so 6 bronze each makes buying worth about one kill per piece; 20 on the shelf, one back every 2 minutes, per account.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import type { ShopList } from '../shops/shop.ts';
import DATA from './shops.json' with { type: 'json' };
import MANIFEST from './shops.manifest.json' with { type: 'json' };

loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, DATA, 'shops.json')]);

export const EXCHANGE_PROVISIONER = 'service:exchange-provisioner';
export const REGION1_SHOPS: ReadonlyMap<string, ShopList> = new Map(DATA.shops.map((s) => [s.id, { id: s.list, revision: s.revision, currency: s.currency as 'bronze', zone: s.zone, rows: s.rows }]));
// How close the buyer stands to the shop's counter: each shop row's rangeCm (shops.json), keyed by the shop's service id. shop-buy.ts reads it here instead of holding the number.
export const SHOP_RANGE_CM_BY_SHOP: ReadonlyMap<string, number> = new Map(DATA.shops.map((s) => [s.id, s.rangeCm]));

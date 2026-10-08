// Region 1's NPC shops (Town plan A2; Dom 12:5x 2026-10-08: everything live, so the buy route ships with a list, not a 501). One shop for now, at the
// Concord Exchange: grave iron, the smith's upgrade material, so bronze from Frontier kills has somewhere to go. Gear is not sold yet (a shop-minted gear
// piece needs its tier set at mint: the next step). PROPOSED numbers (Backend; Content/Strategy may retune): a scavenger kill pays 3-12 bronze and drops
// grave iron at ~20 %, so 6 bronze each makes buying worth about one kill per piece; 20 on the shelf, one back every 2 minutes, per account.
import type { ShopList } from '../shops/shop.ts';

export const EXCHANGE_PROVISIONER = 'service:exchange-provisioner';
export const REGION1_SHOPS: ReadonlyMap<string, ShopList> = new Map([
  [EXCHANGE_PROVISIONER, { id: 'shoplist:exchange-provisioner', revision: 1, currency: 'bronze', rows: [
    { item: 'item:grave-iron', price: 6, max: 20, restockSeconds: 120 },
  ] }],
]);

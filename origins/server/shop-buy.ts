// POST /origins/shop_buy {character, op, shop, item, quantity, revision}: buy from an NPC shop for bronze (Town plan A2). The server prices it: it reads the
// shelf (the account's newest buy of this item, migration 202610080012), the bronze balance (202610080004) and the career level itself, and runs the shop
// list's own re-check (origins/shops/shop.ts checkBuy). Nothing in the body is a price, a cost, a stock count or a level; the only numbers are the quantity
// and the list revision the page was shown (a different one is a 409: read the list again).
// The event's kind is 'metal' (a buy is a bronze spend; origins_events allows no 'shop' kind) and its payload names the shop.
// Valuables are ONE transaction (Dom 2026-10-08 08:37): the `shop:<character>:<op>` event (carrying the receipt and the shelf after the buy), the bronze spend
// (versioned: a stale balance aborts the batch) and the minted items commit in ONE origins_apply batch. The op id is the one-time token: an identical retry is
// answered from the stored receipt (replayed: true), a different request under the same op id is a 409, and a racing retry (O0001) answers from what committed.
// Gear (power 'slot-weight') is minted at REGION1_LOOT_TIER, the tier a Region 1 drop carries. Beta: the shelf is per account (a global shelf needs its own table and a lock). Open hours are World's schedule; until it exists `open` says every shop is open.
import { createHash } from 'node:crypto';
import { parseItemInstance, type ItemInstance } from '../contracts/items.ts';
import { REGION1_LOOT_TIER } from '../encounters/encounters.ts';
import { receive } from '../inventory/inventory.ts';
import { levelOfCredit } from '../progression/model.ts';
import { checkBuy } from '../shops/shop.ts';
import { DbError } from './db.ts';
import { mintOp } from './mob-rewards.ts';
import { Refused } from './errors.ts';
import { BadRequest, Conflict, type Handler } from './handlers.ts';
import { openHoldingsWith, type Content } from './holdings.ts';
import * as store from './store.ts';

export type Shops = NonNullable<Content['shops']>;   // service id (service:<kebab>) -> its list
export type ShopReceipt = { shop: string; item: string; quantity: number; cost: number; revision: number; received: string[] };
const OP = /^[a-z0-9][a-z0-9:._-]{7,119}$/;

export function shopBuyHandler(content: Content, shops: Shops, open: (shop: string, now: number) => boolean = () => true): Handler {
  return async ({ db, account }, body) => {
    if (!shops.size) throw new Refused(501, 'there is no shop in this content', 'not-implemented');
    const { character, op, shop, item, quantity, revision } = body;
    if (typeof op !== 'string' || !OP.test(op)) throw new BadRequest('op: an operation id (8..120 of a-z 0-9 : . _ -)');
    if (typeof character !== 'string' || character.length > 80) throw new BadRequest('character: a character id');
    if (typeof shop !== 'string' || typeof item !== 'string') throw new BadRequest('shop, item: ids');
    const list = shops.get(shop);
    if (!list) throw new BadRequest(`shop: ${shop} is not a shop`);
    const eventId = `shop:${character}:${op}`;
    const same = (r: ShopReceipt) => r.shop === shop && r.item === item && r.quantity === quantity;
    const replay = (stored: store.Json | null) => {
      const r = (stored?.payload as { receipt?: ShopReceipt } | undefined)?.receipt;
      if (!r) return null;
      if (!same(r)) throw new Conflict(`op ${op} already stands for a different buy`);
      return { ...r, replayed: true };
    };
    const prior = replay(await store.event(db, account, eventId));
    if (prior) return prior;

    const [{ inventory, snap }, metal, shelf] = await Promise.all([
      openHoldingsWith(db, account, character, content), store.metalOf(db, account), store.shopStock(db, account, shop, item),
    ]);
    if (metal === 'absent' || shelf === 'absent') throw new Refused(503, 'the shop ledger is not installed (migrations 202610080004 and 202610080012)');
    const level = snap.career ? levelOfCredit(Number(snap.career.total_credit)) : 1;
    const checked = checkBuy(list, { item, quantity: quantity as number, revision: revision as number },
      { level, bronze: metal ? metal.bronze : 0, open: open(shop, shelf.now), stock: shelf.stock, now: shelf.now });
    if (!checked.ok) {
      if (checked.reason === 'stale-list') throw new Conflict(`the shop's list changed (revision ${list.revision}): read it again`);
      if (checked.reason === 'unknown-item' || checked.reason === 'bad-quantity') throw new BadRequest(`${checked.reason}: ${item} x ${String(quantity)}`);
      throw new Refused(422, `the shop refused: ${checked.reason}`, checked.reason);   // closed, level, stock, funds
    }

    // The bought items, minted with `shop` provenance and placed by the inventory's own receive (capacity, stacking, one of each). Stackable: one line of
    // `quantity`; single-copy: `quantity` must be 1 (receive refuses a second copy).
    const at = new Date(shelf.now).toISOString(), key = createHash('sha256').update(`${account}|${eventId}`).digest('hex').slice(0, 32);
    const def = content.lookup(item as never);
    const lines = def?.stack === 1 ? Array.from({ length: quantity as number }, () => 1) : [quantity as number];
    let inv = inventory;
    const minted: ItemInstance[] = [];
    for (const [n, q] of lines.entries()) {
      const parsed = parseItemInstance({
        kind: 'item-instance', schemaVersion: 1, id: `inst:shop-${key.slice(0, 16)}-${n}`, item, version: 0, quantity: q, tier: def?.power === 'slot-weight' ? REGION1_LOOT_TIER : null,   // shop gear carries the Region's loot tier, as a drop does
        location: { kind: 'trade-escrow', container: 'container:shop-mint', from: character }, boundTo: null,
        provenance: { kind: 'shop', mintKey: `shop:${key}:${n}`, at, boughtBy: character, shop }, history: [],
      }, `items[${n}]`);
      if (!parsed.ok) throw new BadRequest(parsed.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
      const next = receive(inv, parsed.value, content.lookup);
      if (!next.ok) throw new Refused(422, `the pack cannot take it: ${next.issues[0]!.message}`, 'pack');
      inv = next.value;
      minted.push(inv.items.find((i) => i.id === parsed.value.id)!);
    }

    const receipt: ShopReceipt = { shop, item, quantity: quantity as number, cost: checked.cost, revision: list.revision, received: minted.map((i) => i.id) };
    const batch: store.Json[] = [
      { op: 'event', event_id: eventId, kind: 'metal', account, character, payload: { shop, item, quantity, cost: checked.cost, revision: list.revision, stock: checked.stockAfter, receipt } },
      { op: 'metal', account, delta_bronze: -checked.cost, reason: 'spend', event_id: eventId, expected_version: metal!.version },
      ...minted.map((inst) => mintOp(inst, def?.stack === 1)),
    ];
    try { await store.commit(db, account, batch); }
    catch (e) {
      if (e instanceof DbError && e.code === 'O0001') { const r = replay(await store.event(db, account, eventId)); if (r) return r; }   // a racing retry committed first
      if (e instanceof DbError && e.code === 'O0002') throw new DbError('O0002', 'stale: the balance or the pack changed since it was read; open again and retry');
      throw e;
    }
    return { ...receipt, replayed: false };
  };
}


import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EXCHANGE_PROVISIONER, REGION1_SHOPS } from './shops.ts';
import { BUNDLE } from './content.ts';
import { validateShopList } from '../shops/shop.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DATA from './shops.json' with { type: 'json' };
import MANIFEST from './shops.manifest.json' with { type: 'json' };

// Pin of the Region 1 shop lists as shops.json builds them (sha256 of JSON.stringify of the REGION1_SHOPS entries). History: the first pin, 4ae46a4b06d9fa44e8bffb253ea988ffe20fc53fa98af4ceb14c4aee3ef59a18,
// was taken from trunk a379108ed (after Backend's #2586 added zone and class), where the list was built in shops.ts: the move to shops.json changed no value. It was then re-pinned on purpose
// because each list now also carries its counter range (rangeCm 500, read by shop-buy.ts as list.rangeCm): the only difference from that first pin is that one added field.
const SHOP_LISTS_SHA = '1e3654191cd64b427f03f118f12eda6343a9002da2ef01d653dc4383740f4347';

test('the shop lists read back from shops.json are exactly the pinned ones (the code-built list plus rangeCm)', () => {
  assert.equal(createHash('sha256').update(JSON.stringify([...REGION1_SHOPS])).digest('hex'), SHOP_LISTS_SHA);
});

test('every shop list validates and every item it sells is a bundle record', () => {
  const ids = new Set((BUNDLE as unknown as readonly { id: string }[]).map((r) => r.id));
  for (const list of REGION1_SHOPS.values()) assert.deepEqual(validateShopList(list, (id) => ids.has(id)), []);
});

test('a shop row with a missing or mistyped field fails the loader', () => {
  const load = (shops: unknown[]) => () => loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, { shops }, 'shops.json')]);
  const row = DATA.shops[0]!;
  assert.doesNotThrow(load([row]));
  assert.throws(load([{ ...row, rows: [{ item: 'item:x', max: 1, restockSeconds: 60 }] }]), /rows\[\]\.price|price/);
  assert.throws(load([{ ...row, revision: 'one' }]), /revision/);
});

test('the shop counter range is the shop row\'s rangeCm (500, the number shop-buy.ts held in code); a row without one fails the loader', () => {
  assert.equal(REGION1_SHOPS.get(EXCHANGE_PROVISIONER)!.rangeCm, 500);   // the list shop-buy.ts holds carries it
  const noRange: Record<string, unknown> = { ...DATA.shops[0]! };
  delete noRange.rangeCm;
  assert.throws(() => loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, { shops: [noRange] }, 'shops.json')]), /rangeCm/);
});

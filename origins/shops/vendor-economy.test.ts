// Vendor economy rows: they load with the shared loader, make sense together, and the pure resolver obeys them.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { VENDOR_CLASSES, ZONE_TAXES, buyPrice, loadVendorEconomy, recoveredTaken, restockedStock, sellPrice, stockPricePct, vendorClass, zoneTax } from './vendor-economy.ts';
import DATA from './vendor-economy.json' with { type: 'json' };

test('vendor economy: rows are sane', () => {
  assert.deepEqual(VENDOR_CLASSES.map((c) => c.id).sort(), ['cosmetic', 'gear', 'material']);
  for (const c of VENDOR_CLASSES) {
    assert.ok(c.priceFloor >= 50 && c.priceFloor <= c.priceCeil, `${c.id} floor <= ceil`);
    assert.ok(c.priceFloor + c.stockSlope >= c.priceFloor && c.stockSlope >= 0);
    assert.ok(c.sellPct > 0 && c.sellPct < c.priceFloor, `${c.id}: the vendor buys back for less than it sells`);
    assert.ok(c.salesFloor >= 1 && c.salesFloor <= 100 && c.salesSlope >= 0);
    assert.ok(c.restockSeconds >= 10 && c.salesRecoverySeconds >= 10 && c.stockCap >= 1);
  }
  assert.ok(ZONE_TAXES.length >= 4 && ZONE_TAXES.every((z) => z.buyTaxPct >= 0 && z.buyTaxPct < 100 && z.sellTaxPct >= 0 && z.sellTaxPct < 100));
  assert.equal(zoneTax('zone1')!.buyTaxPct, 0);
});

test('vendor economy: a missing field is refused at load', () => {
  const bad = structuredClone(DATA) as { classes: Record<string, unknown>[] }; delete bad.classes[0]!.restockSeconds;
  assert.throws(() => loadVendorEconomy(bad));
});

test('vendor economy: price rises as the shelf empties, between floor and ceil', () => {
  const g = vendorClass('gear')!;
  assert.equal(stockPricePct(g, 5), g.priceFloor);
  assert.equal(stockPricePct(g, 0), g.priceFloor + g.stockSlope);
  let last = 0;
  for (let s = g.stockCap; s >= 0; s--) { const p = stockPricePct(g, s); assert.ok(p >= last); last = p; }
  const m = vendorClass('material')!;
  assert.equal(stockPricePct(m, -3), m.priceFloor + m.stockSlope, 'an oversold count is an empty shelf');
  assert.ok(stockPricePct(m, 0) <= m.priceCeil);
});

test('vendor economy: buy price rounds up, tax adds, and never falls under 1 bronze', () => {
  const g = vendorClass('gear')!, none = zoneTax('zone1')!, high = zoneTax('zone4')!;
  assert.equal(buyPrice(g, 100, 5, none), 100);
  assert.equal(buyPrice(g, 100, 0, none), 140);
  assert.equal(buyPrice(g, 100, 5, high), 115);
  assert.equal(buyPrice(g, 1, 5, none), 1);
  assert.equal(buyPrice(g, 7, 5, zoneTax('zone2')!), 8, 'ceil(7 x 1.05)');
});

test('vendor economy: the vendor pays less than it sells, the price sags with sales and floors, the sell tax comes off', () => {
  const g = vendorClass('gear')!, none = zoneTax('zone1')!;
  assert.equal(sellPrice(g, 100, 0, none), 40);
  assert.ok(sellPrice(g, 100, 3, none) < sellPrice(g, 100, 0, none));
  assert.equal(sellPrice(g, 100, 1000, none), Math.floor((100 * g.sellPct * g.salesFloor) / 10_000));
  assert.ok(sellPrice(g, 100, 0, zoneTax('zone4')!) < sellPrice(g, 100, 0, none));
  assert.equal(sellPrice(g, 1, 99, none), 1);
  for (const c of VENDOR_CLASSES) for (const z of ZONE_TAXES) assert.ok(sellPrice(c, 100, 0, z) < buyPrice(c, 100, c.stockCap, z), `${c.id}/${z.id}: no buy-sell loop`);
});

test('vendor economy: restock is lazy, one unit per interval, capped; sales recover the same way', () => {
  const c = vendorClass('cosmetic')!;
  assert.equal(restockedStock(c, 0, c.restockSeconds - 1), 0);
  assert.equal(restockedStock(c, 0, c.restockSeconds * 3 + 5), 3);
  assert.equal(restockedStock(c, 2, c.restockSeconds * 99), c.stockCap);
  assert.equal(restockedStock(c, 25, 9999, 20), 25, 'a stock above the cap is left as is');
  assert.equal(restockedStock(c, 4, -50), 4);
  assert.equal(recoveredTaken(c, 5, c.salesRecoverySeconds * 2), 3);
  assert.equal(recoveredTaken(c, 1, 99999), 0);
});

test('vendor economy: every class is a live item category and every zone-tax row a real zone', () => {
  const categories = Object.keys((JSON.parse(readFileSync(new URL('../../src/core/contracts/definitions.json', import.meta.url), 'utf8')) as { categories: Record<string, unknown> }).categories);
  for (const c of VENDOR_CLASSES) assert.ok(categories.includes(c.id), `${c.id} is not an item category (${categories.join(', ')})`);
  for (const z of ZONE_TAXES) assert.ok(existsSync(new URL(`../zone-rows/${z.id}.row.json`, import.meta.url)), `${z.id} has no zone row`);
  for (let n = 1; n <= 4; n++) assert.ok(zoneTax(`zone${n}`), `zone${n} has no tax row`);
});

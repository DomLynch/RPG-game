// Vendor elasticity, lazy restock and zone tax as data rows (top-30 item 15). Nothing is wired: shop.ts keeps pricing from its own list; Backend reads these rows later. Pure: no clock, no storage.
// A `vendorClass` row (keyed by item category) holds the class's price curve against stock (stockSlope, priceFloor, priceCeil), the vendor's buy-back price and how it sags with sales (sellPct, salesSlope, salesFloor,
// salesRecoverySeconds), and the class's restock (restockSeconds, stockCap). A `zoneTax` row (keyed by zone id) is the percentage the zone adds to a buy and takes off a sell. Percentages are whole numbers.
// Donor: ModernUO BaseVendor (a one-hour RestockDelay checked lazily when a player opens the vendor) and AzerothCore's npc_vendor (maxcount + incrtime per item) are the restock; both keep prices fixed, so the stock curve,
// the sales sag and the zone tax are ours. shop.ts already carries the same lazy restock (2004Scape), so `restockedStock` here is the class default for a row that gives none.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DATA from './vendor-economy.json' with { type: 'json' };
import MANIFEST from './vendor-economy.manifest.json' with { type: 'json' };

export type VendorClass = { id: string; stockSlope: number; priceFloor: number; priceCeil: number; sellPct: number; salesSlope: number; salesFloor: number; salesRecoverySeconds: number; restockSeconds: number; stockCap: number };
export type ZoneTax = { id: string; buyTaxPct: number; sellTaxPct: number };

// The registry checks types and refs; these are the relations between a row's own numbers (a typo row must not load).
export function checkVendorRelations(data: { classes: VendorClass[]; zoneTax: ZoneTax[] }): void {
  const bad: string[] = [];
  for (const c of data.classes) {
    if (!(c.sellPct < c.priceFloor)) bad.push(`${c.id}: sellPct ${c.sellPct} must be below priceFloor ${c.priceFloor} (no arbitrage)`);
    if (!(c.priceFloor <= c.priceCeil)) bad.push(`${c.id}: priceFloor ${c.priceFloor} must not pass priceCeil ${c.priceCeil}`);
    if (!(c.restockSeconds > 0) || !(c.salesRecoverySeconds > 0)) bad.push(`${c.id}: restockSeconds and salesRecoverySeconds must be above 0`);
    if (!(c.stockCap >= 1) || !(c.stockSlope >= 0) || !(c.salesSlope >= 0)) bad.push(`${c.id}: stockCap >= 1 and the slopes >= 0`);
    if (!(c.salesFloor >= 1 && c.salesFloor <= 100)) bad.push(`${c.id}: salesFloor must be 1..100`);
  }
  for (const z of data.zoneTax) if (!(z.buyTaxPct >= 0 && z.buyTaxPct < 100 && z.sellTaxPct >= 0 && z.sellTaxPct < 100)) bad.push(`${z.id}: tax percents must be 0..99`);
  if (bad.length) throw new Error(`vendor-economy relations: ${bad.join('; ')}`);
}
export const loadVendorEconomy = (data: unknown = DATA) => {
  const reg = loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, data, 'vendor-economy.json')));
  checkVendorRelations(data as { classes: VendorClass[]; zoneTax: ZoneTax[] });
  return reg;
};
loadVendorEconomy();
export const VENDOR_CLASSES: readonly VendorClass[] = DATA.classes;
export const ZONE_TAXES: readonly ZoneTax[] = DATA.zoneTax;
export const vendorClass = (id: string): VendorClass | null => VENDOR_CLASSES.find((c) => c.id === id) ?? null;
export const zoneTax = (id: string): ZoneTax | null => ZONE_TAXES.find((z) => z.id === id) ?? null;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// The vendor's price multiplier (percent of list) at `stock` of `cap`: a full shelf sells at the floor, an empty one at floor + stockSlope, never past priceCeil.
export function stockPricePct(c: VendorClass, stock: number, cap: number = c.stockCap): number {
  const gap = cap > 0 ? clamp(1 - stock / cap, 0, 1) : 0;
  return clamp(c.priceFloor + c.stockSlope * gap, c.priceFloor, c.priceCeil);
}
// What the player pays for one unit, in whole bronze: list price x the stock curve x the zone's buy tax, rounded up so a vendor never sells below its curve, at least 1.
export const buyPrice = (c: VendorClass, listPrice: number, stock: number, tax: ZoneTax, cap: number = c.stockCap): number =>
  Math.max(1, Math.ceil((listPrice * stockPricePct(c, stock, cap) * (100 + tax.buyTaxPct)) / 10_000));
// What the vendor pays for one unit: list x sellPct, sagging salesSlope percent of itself per unit already taken (down to salesFloor percent), less the zone's sell tax, rounded down, at least 1.
export function sellPrice(c: VendorClass, listPrice: number, taken: number, tax: ZoneTax, cap: number = c.stockCap): number {
  const sag = clamp(100 - (cap > 0 ? (taken / cap) * c.salesSlope : 0), c.salesFloor, 100);
  return Math.max(1, Math.floor((listPrice * c.sellPct * sag * (100 - tax.sellTaxPct)) / 1_000_000));
}
// Lazy restock: one unit per restockSeconds of elapsed time since the last write, up to the cap; nothing ticks. The same for the units a vendor took from players ("taken" recovers one per salesRecoverySeconds).
export const restockedStock = (c: VendorClass, stock: number, elapsedSeconds: number, cap: number = c.stockCap): number => stock >= cap ? stock : Math.min(cap, stock + Math.floor(Math.max(0, elapsedSeconds) / c.restockSeconds));
export const recoveredTaken = (c: VendorClass, taken: number, elapsedSeconds: number): number => Math.max(0, taken - Math.floor(Math.max(0, elapsedSeconds) / c.salesRecoverySeconds));

// The town generator's definitions, as rows (origins/region1/towns.json `definitions`, shape in towns.manifest.json): what a LOT KIND is (which ring, how many, how big, which pieces it
// carries) and what a TRADE is (a shop trade or a service, its chimney, its kit sign). Strings keyed by id: no union of kinds or trades, no code compares a name (Dom 2026-10-12). A new kind or trade
// is a row. The manifest beside the rows (origins/region1/towns.manifest.json, tables lotKind and trade) is checked by the shared registry loader (src/core/registry.ts): the data gate and the runtime load.
import towns from '../region1/towns.json' with { type: 'json' };

type Num2 = readonly [number, number];
type Num3 = readonly [number, number, number];
export type Kit = { sign?: string; counter?: string; arch?: string };   // kit piece names (public/world/town/buildings.json) this kind or trade picks instead of the kit's weighted default
export type LotKindRow = {
  order: number; ring: number;
  civic?: { w: Num2; d: Num2 }; count?: Num2; gap?: Num2; size?: { w: Num3; d: Num3 };   // size: [base, random span, wealth span]; count and gap: [base, wealth span]; civic: [base, wealth span]
  walls?: boolean; sign?: boolean; chimney?: boolean; counter?: boolean; stand?: number; open?: boolean; trades?: boolean; gate?: { offset: number; w: number; d: number }; arch?: boolean; kit?: Kit;
};
export type TradeRow = { shop?: boolean; order?: number; chimney?: boolean; kit?: Kit };
export type TownDefs = { lotKinds: Readonly<Record<string, LotKindRow>>; trades: Readonly<Record<string, TradeRow>> };
export const TOWN_DEFS: TownDefs = towns.definitions as unknown as TownDefs;

/** The shop trades (rows flagged `shop`), in `order`: the list a ring of shops cycles through. */
export const shopTrades = (defs: TownDefs): string[] => Object.entries(defs.trades).filter(([, t]) => t.shop).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0)).map(([id]) => id);

// The town generator's definitions, as rows (origins/region1/towns.json `definitions`, shape in towns.manifest.json): what a LOT KIND is (which ring, how many, how big, which pieces it
// carries) and what a TRADE is (a shop trade or a service, its chimney, its kit sign). Strings keyed by id: no union of kinds or trades, no code compares a name (Dom 2026-10-12). A new kind or trade
// is a row. The manifest (required fields, types, unique orders) is checked by defsProblems here and in tests/town-defs.test.ts; Backend's shared registry loader replaces that check when it lands.
import towns from '../region1/towns.json' with { type: 'json' };
import manifest from '../region1/towns.manifest.json' with { type: 'json' };

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

type Manifest = Record<string, { required: string[]; types: Record<string, string>; unique: string[] }>;
const kindOf = (v: unknown) => (Array.isArray(v) ? 'array' : typeof v);
/** The manifest check: every row has its required fields, a known field has its declared type, and `unique` fields differ between rows. Unknown fields pass (open shape). */
export function defsProblems(defs: Record<string, Record<string, Record<string, unknown>>>, m: Manifest = manifest as unknown as Manifest): string[] {
  const bad: string[] = [];
  for (const [table, spec] of Object.entries(m)) {
    const rows = defs[table] ?? {};
    for (const [id, row] of Object.entries(rows)) {
      for (const f of spec.required) if (row[f] === undefined) bad.push(`${table}.${id}: missing ${f}`);
      for (const [f, v] of Object.entries(row)) if (spec.types[f] && kindOf(v) !== spec.types[f]) bad.push(`${table}.${id}.${f}: expected ${spec.types[f]}, got ${kindOf(v)}`);
    }
    for (const f of spec.unique) { const seen = new Map<unknown, string>(); for (const [id, row] of Object.entries(rows)) if (row[f] !== undefined) { if (seen.has(row[f])) bad.push(`${table}: ${f} ${String(row[f])} is on both ${seen.get(row[f])} and ${id}`); seen.set(row[f], id); } }
  }
  return bad;
}

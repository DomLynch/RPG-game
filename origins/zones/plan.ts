// Zone PLAN rows (World, Lead's ruling 2026-10-22: a zone's geometry is data, so a new zone, a town included, is rows and nothing else): plan-rows.json holds, for any zone that carries one, every placed piece (a box, cylinder, cone, sphere or
// pediment on a layer), awning, figure, brazier and mark at the baseline numbers it was measured at, and for each number how it FOLLOWS the zone's anchors. An anchor row names its `source` (a world-data landmark, passage, the zone's width or a
// rule value) and its baseline; planFor(zone, resolve) moves each number by weight x (the source now - its baseline), so a landmark moved in the world data still carries its pieces. The Concord Exchange is the first zone to carry a plan
// (tests/zone-plan.test.ts pins it to the frozen code that built it); zone 701 gets walls the same way: its rows, a resolver for its sources. Pure: no three.js.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/neutral.ts';   // the neutral door (the page and the box's node services both load this file)
import DEFS from './plan-rows.json' with { type: 'json' };
import MANIFEST from './plan-rows.manifest.json' with { type: 'json' };

export type Tint = [number, number, number];
export type Shape =
  | ['box', number, number, number] // width, height, depth
  | ['cylinder', number, number, number, number] // radius top, radius bottom, height, radial segments
  | ['cone', number, number, number] // radius, height, radial segments
  | ['sphere', number, number, number] // radius, width segments, height segments
  | ['pediment', number, number, number]; // base width, height, depth: a triangle extruded and centred on its depth
export type Layer = 'stone' | 'paving' | 'iron' | 'soot' | 'coal' | 'plain';   // 'paving' = the plaza deck and its joint slabs: stone to the eye, its own mesh so a look can grade ground and masonry apart
// One placed piece: world position, a turn about y, a tint darkened toward `foot` (exchange.ts piece()). `skin` = a building-skins model id this piece stands as (its glb draws it; the shape stays as the fallback and the footprint); `cover` = a model id whose glb stands in for this piece too (the model draws once, from the piece that carries `skin`; a covered piece is only greybox, hidden with the rest of that model's greybox once the file lands: the plinth and capital of a column the model already has); `scale` = that model's size on the ground (default 1).
export type Piece = { layer: Layer; shape: Shape; x: number; y: number; z: number; tint: Tint; rotY: number; foot: number; skin?: string; cover?: string; scale?: number };
export type Figure = { x: number; z: number; color: string };
export type Plan = {
  pieces: Piece[];
  awnings: (Figure & { y: number })[];
  people: Figure[];
  frieze?: { x: number; y: number; z: number; text: string };   // a zone's `frieze` mark row; none = no inscription
  braziers: { x: number; z: number }[];
  hearth?: { x: number; y: number; z: number };   // a zone's `hearth` mark row; none = no forge light
};

type Follow = Readonly<Record<string, Readonly<Record<string, number>>>>;   // field -> {anchor local name: weight}
type Row = { readonly id: string; readonly zone: string; readonly follow?: Follow };
export type AnchorRow = { readonly id: string; readonly zone: string; readonly source: string; readonly base: number };
export type PieceRow = Row & { readonly layer: Layer; readonly shape: Shape; readonly x: number; readonly y: number; readonly z: number; readonly tint: Tint; readonly rotY: number; readonly foot: number; readonly skin?: string; readonly cover?: string; readonly scale?: number };
export type AwningRow = Row & { readonly x: number; readonly y: number; readonly z: number; readonly color: string };
export type PersonRow = Row & { readonly x: number; readonly z: number; readonly color: string };
export type BrazierRow = Row & { readonly x: number; readonly z: number };
export type MarkRow = Row & { readonly x: number; readonly y: number; readonly z: number; readonly text?: string };
export type PlanRows = { readonly anchors: readonly AnchorRow[]; readonly pieces: readonly PieceRow[]; readonly awnings: readonly AwningRow[]; readonly people: readonly PersonRow[]; readonly braziers: readonly BrazierRow[]; readonly marks: readonly MarkRow[] };

const TABLES = ['anchors', 'pieces', 'awnings', 'people', 'braziers', 'marks'] as const;
const local = (r: { id: string; zone: string }): string => r.id.slice(r.zone.length + 1);   // a row's id is `<zone>/<local id>`
/** The one loader: every table keyed by id (a duplicate, a missing or mistyped field is refused), every id starts with its zone, and every `follow` names an anchor row of the same zone. */
export function loadPlanRows(raw: Partial<Record<(typeof TABLES)[number], readonly unknown[]>>): PlanRows {
  loadRegistry(TABLES.map((t, i) => tableFromFile(MANIFEST.tables[i] as unknown as Manifest, { [t]: raw[t] }, 'plan-rows.json')));
  const rows = raw as unknown as PlanRows;
  for (const t of TABLES) for (const r of rows[t] as readonly Row[]) if (!r.id.startsWith(`${r.zone}/`)) throw Error(`plan-rows ${t} "${r.id}": the id starts with its zone "${r.zone}/"`);
  for (const t of TABLES.slice(1)) for (const r of rows[t] as readonly Row[]) for (const f of Object.values(r.follow ?? {})) for (const n of Object.keys(f)) if (!rows.anchors.some((q) => q.zone === r.zone && local(q) === n)) throw Error(`plan-rows ${t} "${r.id}": follows "${n}", which is no anchor row of zone "${r.zone}"`);
  return rows;
}
export const PLAN_ROWS = loadPlanRows(DEFS);
/** The zones that carry a plan. */
export const planZones = (rows: PlanRows = PLAN_ROWS): readonly string[] => [...new Set(rows.anchors.map((r) => r.zone))];
/** The sources an anchor row of `zone` names (what a resolver must answer for it). */
export const planSources = (zone: string, rows: PlanRows = PLAN_ROWS): readonly string[] => rows.anchors.filter((r) => r.zone === zone).map((r) => r.source);

/** The plan `zone`'s rows describe, where `resolve(source)` is each anchor source's value now: every number at its baseline plus weight x (source now - source at baseline). A zone with no rows has no plan (null). */
export function planFor(zone: string, resolve: (source: string) => number, rows: PlanRows = PLAN_ROWS): Plan | null {
  const anchors = rows.anchors.filter((r) => r.zone === zone); if (!anchors.length) return null;
  const delta: Record<string, number> = {}; for (const r of anchors) delta[local(r)] = resolve(r.source) - r.base;
  const of = <T extends Row>(t: readonly T[]) => t.filter((r) => r.zone === zone);
  const at = (v: number, r: Row, field: string): number => { let s = v; for (const [n, w] of Object.entries(r.follow?.[field] ?? {})) s += w * delta[n]!; return s; };
  const pieces: Piece[] = of(rows.pieces).map((r) => ({ layer: r.layer, shape: [r.shape[0], ...r.shape.slice(1).map((n, i) => at(n as number, r, `s${i + 1}`))] as Shape, x: at(r.x, r, 'x'), y: at(r.y, r, 'y'), z: at(r.z, r, 'z'), tint: [...r.tint] as Tint, rotY: at(r.rotY, r, 'rotY'), foot: at(r.foot, r, 'foot'), ...(r.skin ? { skin: r.skin } : {}), ...(r.cover ? { cover: r.cover } : {}), ...(r.scale !== undefined ? { scale: r.scale } : {}) }));
  const mark = (name: string) => of(rows.marks).find((m) => local(m) === name);   // the marks are optional: a zone that has no frieze or no hearth row simply has none
  const frieze = mark('frieze'), hearth = mark('hearth');
  return {
    pieces,
    awnings: of(rows.awnings).map((r) => ({ x: at(r.x, r, 'x'), y: at(r.y, r, 'y'), z: at(r.z, r, 'z'), color: r.color })),
    braziers: of(rows.braziers).map((r) => ({ x: at(r.x, r, 'x'), z: at(r.z, r, 'z') })),
    people: of(rows.people).map((r) => ({ x: at(r.x, r, 'x'), z: at(r.z, r, 'z'), color: r.color })),
    ...(frieze ? { frieze: { x: at(frieze.x, frieze, 'x'), y: at(frieze.y, frieze, 'y'), z: at(frieze.z, frieze, 'z'), text: frieze.text ?? '' } } : {}),
    ...(hearth ? { hearth: { x: at(hearth.x, hearth, 'x'), y: at(hearth.y, hearth, 'y'), z: at(hearth.z, hearth, 'z') } } : {}),
  };
}

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
  | ['pediment', number, number, number] // base width, height, depth: a triangle extruded and centred on its depth
  | ['ring', number, number, number, number] // inner radius, outer radius, height, radial segments: a flat-topped annulus (a terrace of a bowl)
  | ['wedge', number, number, number]; // length (local x), rise, width (local z): a ramp rising along +x from the piece's base, its bounding box centred on (x, y, z)
export type Layer = 'stone' | 'paving' | 'iron' | 'soot' | 'coal' | 'plain';   // 'paving' = the plaza deck and its joint slabs: stone to the eye, its own mesh so a look can grade ground and masonry apart
// One placed piece: world position, a turn about y, a tint darkened toward `foot` (exchange.ts piece()). `walk` = the hero may stand on its top (walkHeight); `edge` = the name of the ring or floor this piece bounds (a mark of the same zone), read by ringEdges. `skin` = a building-skins model id this piece stands as (its glb draws it; the shape stays as the fallback and the footprint); `cover` = a model id whose glb stands in for this piece too (the model draws once, from the piece that carries `skin`; a covered piece is only greybox, hidden with the rest of that model's greybox once the file lands: the plinth and capital of a column the model already has); `scale` = that model's size on the ground (default 1); `skinOff` = [dx, dy, dz, rotY]: where the model stands relative to the carrier piece (its x, its base, its z) and its own turn, for a group whose carrier is not at the group's centre or whose front is not +z.
export type Piece = { layer: Layer; shape: Shape; x: number; y: number; z: number; tint: Tint; rotY: number; foot: number; walk?: boolean; edge?: string; skin?: string; cover?: string; scale?: number; skinOff?: readonly [number, number, number, number] };
export type Figure = { x: number; z: number; color: string; y?: number };   // y: the ground he stands on (a layout with levels); absent = 0
export type Plan = {
  pieces: Piece[];
  layers?: Record<string, { material: string; tile?: number; stain?: Stain }>;   // a layer a zone draws in its own material (the Pit's sand); none = the stone default

  awnings: (Figure & { y: number })[];
  people: Figure[];
  frieze?: { x: number; y: number; z: number; text: string };   // a zone's `frieze` mark row; none = no inscription
  braziers: { x: number; z: number }[];
  hearth?: { x: number; y: number; z: number };   // a zone's `hearth` mark row; none = no forge light
  marks?: Record<string, { x: number; y: number; z: number; facing?: number; text?: string }>;   // every mark row by its local id (`start`: where a layout opens the hero), frieze and hearth included
};

type Follow = Readonly<Record<string, Readonly<Record<string, number>>>>;   // field -> {anchor local name: weight}
type Row = { readonly id: string; readonly zone: string; readonly follow?: Follow };
export type AnchorRow = { readonly id: string; readonly zone: string; readonly source: string; readonly base: number };
export type PieceRow = Row & { readonly layer: Layer; readonly shape: Shape; readonly x: number; readonly y: number; readonly z: number; readonly tint: Tint; readonly rotY: number; readonly foot: number; readonly walk?: boolean; readonly edge?: string; readonly skin?: string; readonly cover?: string; readonly scale?: number; readonly skinOff?: readonly [number, number, number, number] };
export type AwningRow = Row & { readonly x: number; readonly y: number; readonly z: number; readonly color: string };
export type PersonRow = Row & { readonly x: number; readonly z: number; readonly color: string; readonly y?: number };
export type BrazierRow = Row & { readonly x: number; readonly z: number };
export type MarkRow = Row & { readonly x: number; readonly y: number; readonly z: number; readonly text?: string; readonly facing?: number };
export type Stain = { span: number; top: number; bottom: number; gain: number };   // the Pit's own blood-stain mask (the sand's world-space patch) drawn on this layer: it repeats every `span` m, its edges grow by `gain` (a bigger gain = broader, denser blotches), and it fades in from height `top` (none) to `bottom` (full), so the stains are densest on the lowest ground
export type LayerRow = Row & { readonly layer: Layer; readonly material: string; readonly tile?: number; readonly stain?: Stain };   // a layer of the zone drawn in this material ('sand' = the Pit's own sand, `tile` m per repeat) instead of the stone default
export type PlanRows = { readonly anchors: readonly AnchorRow[]; readonly pieces: readonly PieceRow[]; readonly awnings: readonly AwningRow[]; readonly people: readonly PersonRow[]; readonly braziers: readonly BrazierRow[]; readonly marks: readonly MarkRow[]; readonly layers: readonly LayerRow[] };

const TABLES = ['anchors', 'pieces', 'awnings', 'people', 'braziers', 'marks', 'layers'] as const;
const local = (r: { id: string; zone: string }): string => r.id.slice(r.zone.length + 1);   // a row's id is `<zone>/<local id>`
/** The one loader: every table keyed by id (a duplicate, a missing or mistyped field is refused), every id starts with its zone, and every `follow` names an anchor row of the same zone. */
export function loadPlanRows(given: Partial<Record<(typeof TABLES)[number], readonly unknown[]>>): PlanRows {
  const raw = { ...given, layers: given.layers ?? [] };   // a plan with no layer rows (a zone that draws the stone default) may leave the table out
  loadRegistry(TABLES.map((t, i) => tableFromFile(MANIFEST.tables[i] as unknown as Manifest, { [t]: raw[t] }, 'plan-rows.json')));
  const rows = raw as unknown as PlanRows;
  for (const t of TABLES) for (const r of rows[t] as readonly Row[]) if (!r.id.startsWith(`${r.zone}/`)) throw Error(`plan-rows ${t} "${r.id}": the id starts with its zone "${r.zone}/"`);
  for (const t of TABLES.slice(1)) for (const r of rows[t] as readonly Row[]) for (const f of Object.values(r.follow ?? {})) for (const n of Object.keys(f)) if (!rows.anchors.some((q) => q.zone === r.zone && local(q) === n)) throw Error(`plan-rows ${t} "${r.id}": follows "${n}", which is no anchor row of zone "${r.zone}"`);
  return rows;
}
export const PLAN_ROWS = loadPlanRows(DEFS);
/** The zones that carry a plan. */
export const planZones = (rows: PlanRows = PLAN_ROWS): readonly string[] => [...new Set([...rows.anchors, ...rows.pieces].map((r) => r.zone))];
/** The sources an anchor row of `zone` names (what a resolver must answer for it). */
export const planSources = (zone: string, rows: PlanRows = PLAN_ROWS): readonly string[] => rows.anchors.filter((r) => r.zone === zone).map((r) => r.source);

/** The plan `zone`'s rows describe, where `resolve(source)` is each anchor source's value now: every number at its baseline plus weight x (source now - source at baseline). A zone with no rows has no plan (null). */
export function planFor(zone: string, resolve: (source: string) => number, rows: PlanRows = PLAN_ROWS): Plan | null {
  const anchors = rows.anchors.filter((r) => r.zone === zone); if (!anchors.length && !rows.pieces.some((r) => r.zone === zone)) return null;   // a zone with no anchors at all (a free-standing layout) still has a plan if it has pieces
  const delta: Record<string, number> = {}; for (const r of anchors) delta[local(r)] = resolve(r.source) - r.base;
  const of = <T extends Row>(t: readonly T[]) => t.filter((r) => r.zone === zone);
  const at = (v: number, r: Row, field: string): number => { let s = v; for (const [n, w] of Object.entries(r.follow?.[field] ?? {})) s += w * delta[n]!; return s; };
  const pieces: Piece[] = of(rows.pieces).map((r) => ({ layer: r.layer, shape: [r.shape[0], ...r.shape.slice(1).map((n, i) => at(n as number, r, `s${i + 1}`))] as Shape, x: at(r.x, r, 'x'), y: at(r.y, r, 'y'), z: at(r.z, r, 'z'), tint: [...r.tint] as Tint, rotY: at(r.rotY, r, 'rotY'), foot: at(r.foot, r, 'foot'), ...(r.walk ? { walk: true } : {}), ...(r.edge ? { edge: r.edge } : {}), ...(r.skin ? { skin: r.skin } : {}), ...(r.cover ? { cover: r.cover } : {}), ...(r.skinOff ? { skinOff: r.skinOff } : {}), ...(r.scale !== undefined ? { scale: r.scale } : {}) }));
  const mark = (name: string) => of(rows.marks).find((m) => local(m) === name);   // the marks are optional: a zone that has no frieze or no hearth row simply has none
  const frieze = mark('frieze'), hearth = mark('hearth');
  return {
    pieces,
    ...(of(rows.layers).length ? { layers: Object.fromEntries(of(rows.layers).map((r) => [r.layer, { material: r.material, ...(r.tile !== undefined ? { tile: r.tile } : {}), ...(r.stain ? { stain: r.stain } : {}) }])) } : {}),   // a zone with no layer rows has no `layers` key (the Exchange's plan equals the frozen code plan)
    awnings: of(rows.awnings).map((r) => ({ x: at(r.x, r, 'x'), y: at(r.y, r, 'y'), z: at(r.z, r, 'z'), color: r.color })),
    braziers: of(rows.braziers).map((r) => ({ x: at(r.x, r, 'x'), z: at(r.z, r, 'z') })),
    people: of(rows.people).map((r) => ({ x: at(r.x, r, 'x'), z: at(r.z, r, 'z'), color: r.color, ...(r.y !== undefined ? { y: at(r.y, r, 'y') } : {}) })),
    ...(frieze ? { frieze: { x: at(frieze.x, frieze, 'x'), y: at(frieze.y, frieze, 'y'), z: at(frieze.z, frieze, 'z'), text: frieze.text ?? '' } } : {}),
    ...(hearth ? { hearth: { x: at(hearth.x, hearth, 'x'), y: at(hearth.y, hearth, 'y'), z: at(hearth.z, hearth, 'z') } } : {}),
    ...(of(rows.marks).some((m) => local(m) !== 'frieze' && local(m) !== 'hearth') ? { marks: Object.fromEntries(of(rows.marks).filter((m) => local(m) !== 'frieze' && local(m) !== 'hearth').map((m) => [local(m), { x: at(m.x, m, 'x'), y: at(m.y, m, 'y'), z: at(m.z, m, 'z'), ...(m.facing !== undefined ? { facing: m.facing } : {}), ...(m.text !== undefined ? { text: m.text } : {}) }])) } : {}),   // the other marks, by local id (the Exchange has none, so its plan is unchanged)
  };
}

/** A ring's edges in metres from the zone plan's centre, read from the piece row that names it in `edge` (a ring piece: its inner and outer radius; a cylinder piece, the floor: 0 to its radius); null when the zone has no such piece. The bowl's roster (Combat) reads its leash and roam as shares of this width, so the edges live once, in the layout rows. Pure. */
export function ringEdges(zone: string, edge: string, rows: PlanRows = PLAN_ROWS): { readonly inner: number; readonly outer: number } | null {
  const p = rows.pieces.find((r) => r.zone === zone && r.edge === edge);
  if (!p) return null;
  if (p.shape[0] === 'ring') return { inner: p.shape[1], outer: p.shape[2] };
  if (p.shape[0] === 'cylinder') return { inner: 0, outer: Math.max(p.shape[1], p.shape[2]) };
  return null;
}

/** The height of the highest walkable piece (`walk: true`) under (x, z), or null where there is none: a box, a cylinder, a ring and a wedge ramp are read by their own footprint and top, turned by the piece's `rotY`. Pure. */
export function walkHeight(pieces: readonly Piece[], x: number, z: number): number | null {
  let best: number | null = null;
  for (const p of pieces) {
    if (!p.walk) continue;
    const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rotY), s = Math.sin(p.rotY), lx = dx * c - dz * s, lz = dx * s + dz * c;   // into the piece's frame (three's rotation.y: x' = x cos + z sin, z' = -x sin + z cos; the inverse is this)
    let top: number | null = null;
    switch (p.shape[0]) {
      case 'box': { const [, width, height, depth] = p.shape; if (Math.abs(lx) <= width / 2 && Math.abs(lz) <= depth / 2) top = p.y + height / 2; break; }
      case 'cylinder': { const [, radiusTop, radiusBottom, height] = p.shape; if (Math.hypot(lx, lz) <= Math.max(radiusTop, radiusBottom)) top = p.y + height / 2; break; }
      case 'ring': { const [, inner, outer, height] = p.shape, r = Math.hypot(lx, lz); if (r >= inner && r <= outer) top = p.y + height / 2; break; }
      case 'wedge': { const [, length, h, depth] = p.shape; if (Math.abs(lx) <= length / 2 && Math.abs(lz) <= depth / 2) top = p.y - h / 2 + (h * (lx + length / 2)) / length; break; }
      default: break;
    }
    if (top !== null && (best === null || top > best)) best = top;
  }
  return best;
}

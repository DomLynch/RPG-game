// Which Concord zone a presence position is in (X1/X2, Lead's ruling 2026-10-07): the zone is computed server-side from x, z in the ONE Concord frame
// (origins/world/concord.ts: concordMounts + resolveZone), never taken from a client. Presence coordinates are centimetres in the 300 m town square; the
// Concord frame is metres with the Pit yard's centre at the origin, so world (0, 0) is presence (CENTRE_CM, CENTRE_CM).
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { resolveZone } from '../world/resolve.ts';
import { toMetres, toWorld } from '../world/derive.ts';
import { frontierPlan, type ZonePlan } from '../preview/frontier-plan.ts';
import { loadZone, zoneIds } from '../zones/loader.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import TOWN from './town-zones.json' with { type: 'json' };
import TOWN_MANIFEST from './town-zones.manifest.json' with { type: 'json' };
import { presenceRule } from './presence-rules.ts';
import { CENTRE_CM, CM_PER_M, FRAME_CM, LEGACY_CENTRE_CM } from './frame.ts';

// The frame (docs/specs/origins/frontier-presence.md §2): u16 centimetres, world (0,0) at CENTRE_CM, so the town square (+-150 m) AND the Ash Frontier (x -334..25 m, z -205..150 m) fit.
// v1 clients and the saved-location columns speak the old frame (centre 15000, town square only): LEGACY_SHIFT_CM converts. East of +255 m, or wider than 655 m, needs a v3 frame.
export { CENTRE_CM, FRAME_CM, LEGACY_CENTRE_CM };   // defined in ./frame.ts, the one copy the page bundle shares
export const LEGACY_SHIFT_CM = CENTRE_CM - LEGACY_CENTRE_CM;
export const TOWN_CM = presenceRule('townSideCm');   // the town square's side
type Pt = { x: number; z: number };

const mounts = concordMounts();
if (!mounts.ok) throw new Error('presence: the Concord frame does not resolve');
// ---- the zone table: ROWS, so a new zone or a 1.2x zone is a data edit (Strategy) -------------------------------------------------------------
// speed: a multiplier on the walking cap while standing in the zone. quiet: nobody outside the zone sees or is seen from inside it. Launch values (Lead 2026-10-13): 1.0 everywhere, quiet = the Pit only.
export type ZoneRow = { id: string; corners: Pt[]; speed: number; quiet: boolean; trade: boolean };
export type PortalRow = { zone: string; landmark: string; to: string };   // a link the plan does not walk (the night boat): the only legal pose jump, once the wire has its portal frame
// trade: bank, smith and trade work in the zone (one shared bank across every trade zone). rejoin: a landmark of the zone a rejoin is moved just outside of; required with trade.
export type ZoneField = { speed?: number; quiet?: boolean; trade?: boolean; rejoin?: string };
export type ZoneFieldRow = ZoneField & { id: string };
/** The per-zone presence fields by world-zone name: the town's rows (town-zones.json: the Pit is quiet) plus every zone package's `presence` block (zone row, keyed by its world zones). A name given twice is refused. */
export function zoneFields(town: readonly ZoneFieldRow[], packages: readonly { presence?: Readonly<Record<string, ZoneField>> }[]): ReadonlyMap<string, ZoneField> {
  const out = new Map<string, ZoneField>();
  const put = (name: string, f: ZoneField): void => { if (out.has(name)) throw new Error(`presence: zone "${name}" has its fields given twice`); out.set(name, { speed: f.speed, quiet: f.quiet, trade: f.trade, rejoin: f.rejoin }); };
  for (const t of town) put(t.id, t);
  for (const p of packages) for (const [name, f] of Object.entries(p.presence ?? {})) put(name, f);
  return out;
}
loadRegistry([tableFromFile(TOWN_MANIFEST.tables[0] as unknown as Manifest, TOWN, 'town-zones.json')]);
const FIELDS = zoneFields(TOWN.zones, zoneIds().map(id => loadZone(id)));

const corners = (width: number, depth: number, mount: Parameters<typeof toWorld>[1]): Pt[] =>
  ([[-width / 2, 0], [width / 2, 0], [width / 2, depth], [-width / 2, depth]] as const).map(([x, d]) => toWorld({ x, d }, mount));
const row = (id: string, c: Pt[]): ZoneRow => ({ id, corners: c, speed: FIELDS.get(id)?.speed ?? 1, quiet: FIELDS.get(id)?.quiet ?? false, trade: FIELDS.get(id)?.trade === true });

// Town zones first (a point on a shared edge belongs to the first), then every Frontier zone of every zone package.
// A town row's `mount` names its frame in concordMounts() (town-zones.json: pit-yard sits on the Pit's, exchange on the Exchange's), so no zone name is compared here.
const mountNamed = (id: string): Parameters<typeof toWorld>[1] => { const name = TOWN.zones.find((z) => z.id === id)?.mount; const m = name === undefined ? undefined : (mounts.value as Record<string, Parameters<typeof toWorld>[1]>)[name]; if (!m) throw new Error(`presence: town zone ${id} names no Concord mount`); return m; };
const rows: ZoneRow[] = TOWN.zones.map(({ id }) => {
  const params = resolveZone(CONCORD, CONCORD_REGION, id);
  if (!params.ok) throw new Error(`presence: zone ${id} does not resolve`);
  const t = toMetres(params.value);
  return row(id, corners(t.width, t.depth, mountNamed(id)));
});
const plans = zoneIds().map(id => frontierPlan(true, id));
const frontier = new Map<string, ZonePlan>();
for (const f of plans) for (const q of f.zones) if (q.region !== CONCORD_REGION && !frontier.has(q.zone)) frontier.set(q.zone, q);
for (const q of frontier.values()) rows.push(row(q.zone, corners(q.width, q.depth, q.mount)));
export const ZONE_ROWS: readonly ZoneRow[] = rows;
export const PORTALS: readonly PortalRow[] = [...frontier.values()].flatMap(q => q.links.filter(l => l.kind === 'portal').map(l => ({ zone: q.zone, landmark: l.here, to: l.to })));
// The west road: the Exchange's passage to the first Frontier zone, walkable though it belongs to no zone row.
const roadCorners: Pt[] = (() => {
  const r = plans[0]!.road, ux = Math.sin(r.facing), uz = Math.cos(r.facing), len = Math.hypot(r.to.x - r.from.x, r.to.z - r.from.z), h = r.width / 2;
  const behind = presenceRule('roadBehindM'), past = presenceRule('roadPastM');   // how far the walkable road runs behind its start and past its end (metres)
  const a = { x: r.from.x - ux * behind, z: r.from.z - uz * behind }, e = { x: r.from.x + ux * (len + past), z: r.from.z + uz * (len + past) };
  return [{ x: a.x - uz * h, z: a.z + ux * h }, { x: e.x - uz * h, z: e.z + ux * h }, { x: e.x + uz * h, z: e.z - ux * h }, { x: a.x + uz * h, z: a.z - ux * h }];
})();

const EPS = 1e-6;
const inside = (corners: readonly Pt[], p: Pt): boolean => {   // a convex quad, edges inclusive
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!, b = corners[(i + 1) % corners.length]!;
    const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (Math.abs(cross) <= EPS) continue;
    if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false;
  }
  return true;
};

export const worldMetres = (xCm: number, zCm: number): Pt => ({ x: (xCm - CENTRE_CM) / CM_PER_M, z: (zCm - CENTRE_CM) / CM_PER_M });
export const zoneRowAt = (xCm: number, zCm: number): ZoneRow | null => {
  const p = worldMetres(xCm, zCm);
  return rows.find(z => inside(z.corners, p)) ?? null;
};
// A zone id ('pit-yard', 'exchange', a Frontier zone), or null when the position is in none (the open ground of the town square, or the west road).
export const zoneAt = (xCm: number, zCm: number): string | null => zoneRowAt(xCm, zCm)?.id ?? null;
export const inTownSquare = (xCm: number, zCm: number): boolean => xCm >= CENTRE_CM - TOWN_CM / 2 && xCm <= CENTRE_CM + TOWN_CM / 2 && zCm >= CENTRE_CM - TOWN_CM / 2 && zCm <= CENTRE_CM + TOWN_CM / 2;
// Where a player may stand: the town square, a Frontier zone, or the west road. Anything else is refused by the clamp.
export const walkable = (xCm: number, zCm: number): boolean => inTownSquare(xCm, zCm) || zoneRowAt(xCm, zCm) !== null || inside(roadCorners, worldMetres(xCm, zCm));
// The saved-location frame and v1 clients: centimetres inside the town square, centre 15000. Null for a position outside the square.
export const toLegacy = (p: Pt): Pt | null => (inTownSquare(p.x, p.z) ? { x: p.x - LEGACY_SHIFT_CM, z: p.z - LEGACY_SHIFT_CM } : null);
export const fromLegacy = (p: Pt): Pt => ({ x: p.x + LEGACY_SHIFT_CM, z: p.z + LEGACY_SHIFT_CM });

// Where every fresh join starts (Lead, 2026-10-07): the Pit yard's centre, a constant the server chooses, never the client's first pose.
export const SPAWN: Pt = { x: CENTRE_CM, z: CENTRE_CM };

// A landmark's position in presence centimetres, from the zone data (the same frame as zoneAt): a town zone's (Concord data) or any zone package's (its placed plan, already world metres).
export function landmarkCm(zone: string, name: string): Pt {
  if (TOWN.zones.some((z) => z.id === zone)) {
    const params = resolveZone(CONCORD, CONCORD_REGION, zone);
    const l = params.ok ? toMetres(params.value).landmarks[name] : undefined;
    if (!l) throw new Error(`presence: no landmark ${zone}/${name}`);
    const w = toWorld({ x: l.x, d: l.d }, mountNamed(zone));
    return { x: Math.round(CENTRE_CM + w.x * CM_PER_M), z: Math.round(CENTRE_CM + w.z * CM_PER_M) };
  }
  const at = frontier.get(zone)?.landmarks[name];
  if (!at) throw new Error(`presence: no landmark ${zone}/${name}`);
  return { x: Math.round(CENTRE_CM + at.x * CM_PER_M), z: Math.round(CENTRE_CM + at.z * CM_PER_M) };
}

// A trade area IS the whole of a zone flagged `trade` (Expansion's rule for launch gate X1, adopted: bank, smith and trade are zone-wide, so a smaller box would let a rejoin land "at the Exchange"
// without walking in). The Exchange's flag is in town-zones.json, a zone package's in its presence block. The edge between the Pit yard and the Exchange belongs to the Pit yard (zoneAt), so it is outside.
// One bank is shared by every trade zone (Lead 2026-10-22; UO: a bank box at any banker, WoW: the bank in any capital).
export const TRADE_ZONES: ReadonlySet<string> = new Set(rows.filter((r) => r.trade).map((r) => r.id));
export const inTradeArea = (x: number, z: number): boolean => zoneRowAt(x, z)?.trade === true;

// Where a rejoin goes when its remembered or saved spot is in a trade area (Strategy's rule f; Lead's ruling 2026-10-07): just outside the zone's rejoin landmark (the Exchange: its outer gate, on the Pit side),
// `rejoinPastGateCm` further along +z, so a rejoin is never "at the Exchange" at all and the player must walk in fresh (the stricter of the two edges Expansion offered).
// A trade zone must name a rejoin landmark whose point is itself outside every trade area, or presence refuses to start (fail closed).
const REJOINS = new Map<string, Pt>();
for (const id of TRADE_ZONES) {
  const landmark = FIELDS.get(id)?.rejoin;
  if (landmark === undefined) throw new Error(`presence: trade zone ${id} names no rejoin landmark`);
  const g = landmarkCm(id, landmark), p = { x: g.x, z: g.z + presenceRule('rejoinPastGateCm') };
  if (inTradeArea(p.x, p.z)) throw new Error(`presence: the rejoin point of trade zone ${id} (landmark ${landmark}) is itself in a trade area`);
  REJOINS.set(id, p);
}
/** A trade zone's rejoin point in presence centimetres; undefined for a zone that is no trade area. */
export const rejoinOf = (zone: string): Pt | undefined => REJOINS.get(zone);
export const REJOIN_EDGE: Pt = [...REJOINS.values()][0] ?? SPAWN;   // the first trade zone's (town rows come first: the Exchange's): the default for a spot whose zone is unknown
export const clearOfTradeAreas = (x: number, z: number): Pt => { const id = zoneAt(x, z); return (id !== null ? REJOINS.get(id) : undefined) ?? { x, z }; };

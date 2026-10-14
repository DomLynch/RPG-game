// Which Concord zone a presence position is in (X1/X2, Lead's ruling 2026-10-07): the zone is computed server-side from x, z in the ONE Concord frame
// (origins/world/concord.ts: concordMounts + resolveZone), never taken from a client. Presence coordinates are centimetres in the 300 m town square; the
// Concord frame is metres with the Pit yard's centre at the origin, so world (0, 0) is presence (CENTRE_CM, CENTRE_CM).
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { resolveZone } from '../world/resolve.ts';
import { toMetres, toWorld } from '../world/derive.ts';
import { frontierPlan, type ZonePlan } from '../preview/frontier-plan.ts';
import { zoneIds } from '../zones/loader.ts';

// The frame (docs/specs/origins/frontier-presence.md §2): u16 centimetres, world (0,0) at CENTRE_CM, so the town square (+-150 m) AND the Ash Frontier (x -334..25 m, z -205..150 m) fit.
// v1 clients and the saved-location columns speak the old frame (centre 15000, town square only): LEGACY_SHIFT_CM converts. East of +255 m, or wider than 655 m, needs a v3 frame.
export const CENTRE_CM = 40000;
export const FRAME_CM = 65535;
export const LEGACY_CENTRE_CM = 15000;
export const LEGACY_SHIFT_CM = CENTRE_CM - LEGACY_CENTRE_CM;
export const TOWN_CM = 30000;   // the town square's side
type Pt = { x: number; z: number };

const mounts = concordMounts();
if (!mounts.ok) throw new Error('presence: the Concord frame does not resolve');
// ---- the zone table: ROWS, so a new zone or a 1.2x zone is a data edit (Strategy) -------------------------------------------------------------
// speed: a multiplier on the walking cap while standing in the zone. quiet: nobody outside the zone sees or is seen from inside it. Launch values (Lead 2026-10-13): 1.0 everywhere, quiet = the Pit only.
export type ZoneRow = { id: string; corners: Pt[]; speed: number; quiet: boolean };
export type PortalRow = { zone: string; landmark: string; to: string };   // a link the plan does not walk (the night boat): the only legal pose jump, once the wire has its portal frame
export const ZONE_FIELDS: Record<string, { speed?: number; quiet?: boolean }> = { 'pit-yard': { quiet: true } };

const corners = (width: number, depth: number, mount: Parameters<typeof toWorld>[1]): Pt[] =>
  ([[-width / 2, 0], [width / 2, 0], [width / 2, depth], [-width / 2, depth]] as const).map(([x, d]) => toWorld({ x, d }, mount));
const row = (id: string, c: Pt[]): ZoneRow => ({ id, corners: c, speed: 1, quiet: false, ...ZONE_FIELDS[id] });

// Town zones first (a point on a shared edge belongs to the first), then every Frontier zone of every zone package.
const rows: ZoneRow[] = (['pit-yard', 'exchange'] as const).map(id => {
  const params = resolveZone(CONCORD, CONCORD_REGION, id);
  if (!params.ok) throw new Error(`presence: zone ${id} does not resolve`);
  const t = toMetres(params.value);
  return row(id, corners(t.width, t.depth, id === 'pit-yard' ? mounts.value.pit : mounts.value.exchange));
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
  const a = { x: r.from.x - ux * 2.5, z: r.from.z - uz * 2.5 }, e = { x: r.from.x + ux * (len + 0.5), z: r.from.z + uz * (len + 0.5) };
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

export const worldMetres = (xCm: number, zCm: number): Pt => ({ x: (xCm - CENTRE_CM) / 100, z: (zCm - CENTRE_CM) / 100 });
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

// A landmark's position in presence centimetres, from the zone data (the same frame as zoneAt).
const mountOf = (zone: 'pit-yard' | 'exchange') => (zone === 'pit-yard' ? mounts.value.pit : mounts.value.exchange);
export function landmarkCm(zone: 'pit-yard' | 'exchange', name: string): Pt {
  const params = resolveZone(CONCORD, CONCORD_REGION, zone);
  const l = params.ok ? toMetres(params.value).landmarks[name] : undefined;
  if (!l) throw new Error(`presence: no landmark ${zone}/${name}`);
  const w = toWorld({ x: l.x, d: l.d }, mountOf(zone));
  return { x: Math.round(CENTRE_CM + w.x * 100), z: Math.round(CENTRE_CM + w.z * 100) };
}

// The trade area IS the whole `exchange` zone (Expansion's rule for launch gate X1, adopted: bank, smith and trade are Exchange-wide, so a smaller box would let a rejoin land
// "at the Exchange" without walking in). The edge between the Pit yard and the Exchange belongs to the Pit yard (zoneAt), so it is outside.
export const inTradeArea = (x: number, z: number): boolean => zoneAt(x, z) === 'exchange';

// Where a rejoin goes when its remembered or saved spot is in a trade area (Strategy's rule f; Lead's ruling 2026-10-07): just outside the Exchange's outer gate on the Pit side, 50 cm
// into the Pit yard, so a rejoin is never "at the Exchange" at all and the player must walk in fresh (the stricter of the two edges Expansion offered).
const OUTER_GATE = landmarkCm('exchange', 'outer-gate');
export const REJOIN_EDGE: Pt = { x: OUTER_GATE.x, z: OUTER_GATE.z + 50 };
export const clearOfTradeAreas = (x: number, z: number): Pt => (inTradeArea(x, z) ? REJOIN_EDGE : { x, z });

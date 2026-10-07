// Which Concord zone a presence position is in (X1/X2, Lead's ruling 2026-10-07): the zone is computed server-side from x, z in the ONE Concord frame
// (origins/world/concord.ts: concordMounts + resolveZone), never taken from a client. Presence coordinates are centimetres in the 300 m town square; the
// Concord frame is metres with the Pit yard's centre at the origin, so world (0, 0) is presence (CENTRE_CM, CENTRE_CM).
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { resolveZone } from '../world/resolve.ts';
import { toMetres, toWorld } from '../world/derive.ts';

export const CENTRE_CM = 15000;
type Pt = { x: number; z: number };

const mounts = concordMounts();
if (!mounts.ok) throw new Error('presence: the Concord frame does not resolve');
// A zone's rectangle as its four corners in the world frame (metres), entry edge first. Zones in id order: a point on a shared edge belongs to the first.
const zones: { id: string; corners: Pt[] }[] = (['pit-yard', 'exchange'] as const).map(id => {
  const params = resolveZone(CONCORD, CONCORD_REGION, id);
  if (!params.ok) throw new Error(`presence: zone ${id} does not resolve`);
  const t = toMetres(params.value), mount = id === 'pit-yard' ? mounts.value.pit : mounts.value.exchange;
  return { id, corners: ([[-t.width / 2, 0], [t.width / 2, 0], [t.width / 2, t.depth], [-t.width / 2, t.depth]] as const).map(([x, d]) => toWorld({ x, d }, mount)) };
});

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
// 'pit-yard', 'exchange', or null when the position is in neither (the open ground of the town square around them).
export const zoneAt = (xCm: number, zCm: number): string | null => {
  const p = worldMetres(xCm, zCm);
  return zones.find(z => inside(z.corners, p))?.id ?? null;
};

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

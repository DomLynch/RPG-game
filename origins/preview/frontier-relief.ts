// Zone 1 quality, step 1 in the preview (?region=1): the hills laid over the Frontier's flat plan. Pure: no three.js, no DOM (frontier.ts builds the mesh).
// The plan stays exactly where it was: every building, prop, road, camp and landmark keeps its place and stays on FLAT ground, because each gets a flat pad
// (origins/world/relief.ts blends the hills back to height 0 round it). The hills are only the open ground between. The same function gives the mesh its heights and
// the hero, the creatures and the camera their feet, so nothing floats or sinks. Each zone has its own params (terrain.relief / hillScale / seed) and its edge fades to 0.
import { reliefAt, type Pad } from '../world/relief.ts';
import type { Piece } from './exchange-plan.ts';
import { footprintOf, type Dress } from './frontier-dress.ts';
import { FRONTIER, inZone, toZone, type Build, type Frontier, type Solid, type ZonePlan } from './frontier-plan.ts';

export const EDGE_FADE = 6;      // m: the ground eases to 0 over this distance from a zone's edge
export const PAD_MARGIN = 2.5;   // m: flat ground beyond a prop's own footprint
export const LANDMARK_PAD = 7;   // m: flat ground round a landmark (a camp, a gate, a shrine, a jetty)
export type ReliefZone = { zone: ZonePlan; pads: Pad[] };

// A piece's flat pads: a thin or short piece one disc; a long one (a road, a wall) a row of discs along its length, so a road flattens a strip, not a circle the size of its diagonal.
// A piece whose top is below the ground (the old plane and its skirt) holds nothing up and gets none.
export function padsOf(p: Piece): Pad[] {
  const sh = p.shape;
  if (sh[0] === 'box') {
    const [, w, h, d] = sh;
    if (p.y + h / 2 <= 0.05) return [];
    const long = Math.max(w, d), short = Math.min(w, d), r = Math.max(short / 2, 0.5) + PAD_MARGIN, alongX = w >= d;
    const n = Math.max(1, Math.ceil(long / r)), ux = alongX ? Math.cos(p.rotY) : Math.sin(p.rotY), uz = alongX ? -Math.sin(p.rotY) : Math.cos(p.rotY), out: Pad[] = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (long - short); out.push({ x: p.x + ux * t, z: p.z + uz * t, r }); }
    return out;
  }
  const s = footprintOf(p);
  return [{ x: s.x, z: s.z, r: s.r + PAD_MARGIN }];
}

const nearZone = (z: ZonePlan, x: number, wz: number, r: number) => inZone(z, x, wz, -(r + EDGE_FADE));

export function reliefZones(f: Frontier, b: Build, d?: Dress, extra: readonly Piece[] = []): ReliefZone[] {
  return f.zones.filter((z) => z.region === FRONTIER && z.relief.relief > 0).map((zone) => {
    const pads: Pad[] = [], add = (x: number, z: number, r: number) => { if (nearZone(zone, x, z, r)) pads.push({ x, z, r }); };
    for (const a of Object.values(zone.landmarks)) add(a.x, a.z, LANDMARK_PAD);
    for (const p of [...b.pieces, ...(d?.ground ?? []), ...(d?.pieces ?? []), ...extra]) for (const pad of padsOf(p)) add(pad.x, pad.z, pad.r);
    for (const s of [...b.solids, ...(d?.solids ?? [])] as Solid[]) add(s.x, s.z, s.r + PAD_MARGIN);
    for (const person of b.people) add(person.x, person.z, 1.5 + PAD_MARGIN);
    return { zone, pads };
  });
}

const smooth = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c); };
export function zoneHeight(rz: ReliefZone, x: number, z: number): number {
  const p = toZone(rz.zone, x, z), edge = Math.min(rz.zone.width / 2 - Math.abs(p.x), p.d, rz.zone.depth - p.d);
  return smooth(edge / EDGE_FADE) * reliefAt(x, z, rz.zone.relief, rz.pads);
}
// The ground under a world point: 0 outside every relieved zone.
export function groundAt(zs: readonly ReliefZone[], x: number, z: number): number {
  for (const rz of zs) if (inZone(rz.zone, x, z)) return zoneHeight(rz, x, z);
  return 0;
}

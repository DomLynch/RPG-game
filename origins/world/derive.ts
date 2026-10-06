// Origins O2: from resolved parameters to metres. Every place length goes through scale × zoneSize × the relative layout, so changing
// the scale or a zone's size moves every landmark and passage with it and keeps the plan.
//
// Zone frame (metres): origin at the centre of the zone's ENTRY edge; `d` runs inward (v), `x` runs to the right (u − 0.5). A facing of 0
// looks inward and +90° looks left. A mount puts the frame in the world: `heading` is the world heading of "inward", measured as the
// game measures a walker's heading (direction (sin h, cos h) in x, z).
import { fail, ok, type Result } from '../contracts/core.ts';
import type { Params } from './schema.ts';

export type Point = { x: number; d: number };
export type Placed = Point & { facing: number }; // facing in radians
export type Mount = { x: number; z: number; heading: number };

const RAD = Math.PI / 180;
const at = (p: Params, l: { u: number; v: number; facing: number }): Placed => {
  const s = p.scale.metresPerUnit;
  return { x: (l.u - 0.5) * p.zoneSize.width * s, d: l.v * p.zoneSize.depth * s, facing: l.facing * RAD };
};

export function place(p: Params, landmark: string): Result<Placed> {
  if (!Object.hasOwn(p.layout, landmark)) return fail('unknown-id', 'landmark', `no landmark "${landmark}"`);
  return ok(at(p, p.layout[landmark]!));
}

// The whole zone in metres: size and area, every landmark, every passage's two ends, and the counts its densities give.
export function toMetres(p: Params) {
  const s = p.scale.metresPerUnit, width = p.zoneSize.width * s, depth = p.zoneSize.depth * s, area = width * depth;
  const landmarks = Object.fromEntries(Object.entries(p.layout).map(([k, l]) => [k, at(p, l)]));
  const passages = Object.fromEntries(Object.entries(p.passages).map(([k, x]) => {
    const from = landmarks[x.from]!, length = x.length * s;
    return [k, { width: x.width * s, length, from: { x: from.x, d: from.d }, to: { x: from.x - Math.sin(from.facing) * length, d: from.d + Math.cos(from.facing) * length } }];
  }));
  const count = (per100: number) => Math.round((per100 * area) / 100);
  return { width, depth, area, landmarks, passages, counts: { npcs: count(p.density.npcs), props: count(p.density.props), creatures: count(p.density.creatures) } };
}

export function toWorld(pt: Point, m: Mount): { x: number; z: number } {
  const sin = Math.sin(m.heading), cos = Math.cos(m.heading);
  return { x: m.x - pt.x * cos + pt.d * sin, z: m.z + pt.x * sin + pt.d * cos };
}

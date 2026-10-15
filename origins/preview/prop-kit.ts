// A prop kit placed in a zone (zone sandbox, from the goblin camp of World's #2797): every prop, count, clearance and layout is a row (origins/world/props-defs.json), so a zone asks for a kit by id and a new
// camp is rows, not code. Pure data out (Piece[] + the fires' places for the smoke), no three.js, on the stone layer (embers on the coal layer), so the draw calls do not move. Adds NO walk blocker (dressing you walk
// past). Reads the base dressing so nothing lands on a road, a landmark, a building or a base prop. Deterministic per (zone, kit, recipe): each recipe has its OWN random stream (World of Claudecraft's camp
// `offStream`), so adding or changing one recipe never moves another's props. Donors: Ultima Online statics / EQEmu objects (one table of props), World of Claudecraft camp scatter (seeded recipes), Veloren scatter.
import { propKitRow, propRow, propTint, recipesOf, type Part, type Prop, type Recipe } from '../world/props-rules.ts';
import { toWorld } from '../world/derive.ts';
import type { Piece, Shape } from './exchange-plan.ts';
import { footprintOf, rng, type Dress } from './frontier-dress.ts';
import { inZone, onRoad, type Build, type Frontier, type Solid } from './frontier-plan.ts';

export type KitResult = { dress: Dress; fires: { x: number; z: number }[]; centre: { x: number; z: number } | null };
const shapeOf = (q: Part, s: number): Shape => { const n = q.size, k = q.shape; return k === 'box' ? ['box', n[0]! * s, n[1]! * s, n[2]! * s] : k === 'cylinder' ? ['cylinder', n[0]! * s, n[1]! * s, n[2]! * s, n[3]!] : k === 'cone' ? ['cone', n[0]! * s, n[1]! * s, n[2]!] : ['sphere', n[0]! * s, n[1]!, n[2]!]; };

/** One prop at (x, z) facing yaw, scaled by s: its parts turned into pieces (a part with `ring` repeats n times round the prop's axis). */
export function propPieces(p: Prop, x: number, z: number, yaw: number, s: number): Piece[] {
  const out: Piece[] = [], c = Math.cos(yaw), si = Math.sin(yaw);   // the prop's local x runs along (cos yaw, -sin yaw), local z along (sin yaw, cos yaw): the same turn a piece's rotY gives
  for (const q of p.parts) {
    const at = (lx: number, ly: number, lz: number, extra: number): Piece => ({ layer: q.layer ?? 'stone', shape: shapeOf(q, s), x: x + (lx * c + lz * si) * s, y: ly * s, z: z + (lz * c - lx * si) * s, tint: propTint(q.tint), rotY: yaw + q.yaw + extra, foot: 0 });
    if (q.ring) for (let i = 0; i < q.ring.n; i++) { const a = (i / q.ring.n) * Math.PI * 2; out.push(at(q.at[0] + Math.sin(a) * q.ring.radius, q.at[1], q.at[2] + Math.cos(a) * q.ring.radius, a)); }
    else out.push(at(q.at[0], q.at[1], q.at[2], 0));
  }
  return out;
}

export function propKit(f: Frontier, b: Build, base: Dress, zoneName: string, kitId: string, recipes: readonly Recipe[] = recipesOf(kitId)): KitResult {   // recipes: the kit's own list unless a test passes a subset
  const ground: Piece[] = [], pieces: Piece[] = [], solids: Solid[] = [], fires: { x: number; z: number }[] = [], none = { dress: { ground, pieces, solids }, fires, centre: null };
  const kit = propKitRow(kitId), z0 = f.zones.find((q) => q.zone === zoneName);
  if (!kit || !z0) return none;
  const z = z0, world = (x: number, d: number) => toWorld({ x, d }, z.mount), centre = world(0, z.depth * kit.centreDepth);
  const placed: Solid[] = [], baseFoot = base.pieces.map(footprintOf), marks = [...Object.values(z.landmarks), f.giver.at], strips = base.strips ?? [];
  const free = (x: number, zz: number, r: number) => inZone(z, x, zz, r + kit.edge) && !onRoad(f, x, zz) && !strips.some((s) => Math.hypot(s.x - x, s.z - zz) < r + kit.clearRoad)
    && !marks.some((k) => Math.hypot(k.x - x, k.z - zz) < r + kit.clearLandmark) && ![...b.solids, ...base.solids, ...placed, ...baseFoot].some((s) => Math.hypot(s.x - x, s.z - zz) < s.r + r + kit.clearProp);

  for (const rc of recipes) {
    const R = rng(`kit:${kitId}:${z.zone}:${rc.id}`), between = (lo: number, hi: number) => lo + (hi - lo) * R();   // this recipe's own stream
    if (rc.chance !== undefined && R() >= rc.chance) continue;   // a rare place: some zones have it, most do not (seeded by the zone)
    const total = rc.props.reduce((n, w) => n + w.weight, 0), pick = (): Prop => { let t = R() * total; for (const w of rc.props) { t -= w.weight; if (t <= 0) return propRow(w.prop); } return propRow(rc.props[rc.props.length - 1]!.prop); };
    const put = (p: Prop, x: number, zz: number) => {
      const s = between(p.scaleMin, p.scaleMax), yaw = between(0, 6.28);
      pieces.push(...propPieces(p, x, zz, yaw, s)); placed.push({ x, z: zz, r: p.r * s });
      if (p.emits === 'fire') fires.push({ x, z: zz });
    };
    const spot = (r: number, near: number) => { for (let i = 0; i < kit.tries; i++) { const a = between(0, Math.PI * 2), d = between(r, Math.max(r, kit.radius * near)), x = centre.x + Math.sin(a) * d, zz = centre.z + Math.cos(a) * d; if (free(x, zz, r)) return { x, z: zz }; } return null; };
    if (rc.kind === 'scatter') {
      for (let k = 0; k < rc.count; k++) {
        const p = pick(), o = k === 0 && rc.first === 'centre' && free(centre.x, centre.z, p.r) ? centre : spot(p.r, rc.near ?? 1); if (o) put(p, o.x, o.z);
      }
    } else if (rc.kind === 'ring') {
      const a0 = between(0, Math.PI * 2);
      for (let k = 0; k < rc.count; k++) { const p = pick(), a = a0 + (k / rc.count) * Math.PI * 2, x = centre.x + Math.sin(a) * rc.ringRadius!, zz = centre.z + Math.cos(a) * rc.ringRadius!; if (free(x, zz, p.r)) put(p, x, zz); }
    } else {
      for (let k = 0; k < rc.count; k++) {
        const o = spot(rc.spread!, rc.near ?? 1); if (!o) continue;
        for (let i = 0; i < rc.per!; i++) { const p = pick(), x = o.x + between(-rc.spread!, rc.spread!), zz = o.z + between(-rc.spread!, rc.spread!); if (free(x, zz, p.r)) put(p, x, zz); }
      }
    }
  }
  return { dress: { ground, pieces, solids }, fires, centre };
}

/** The base dressing and the kit as one Dress (frontier.ts meshes its ground then its pieces; the kit adds no solid). */
export const withPropKit = (kit: KitResult, base: Dress): Dress => ({ ground: [...base.ground, ...kit.dress.ground], pieces: [...base.pieces, ...kit.dress.pieces], solids: [...base.solids, ...kit.dress.solids], ...(base.strips ? { strips: base.strips } : {}) });
export type { Recipe };

// A building skin turned into pieces (zone sandbox, 2026-10-16): the skin's parts (origins/world/building-skins.json, numbers as fractions of the building) scaled to one block's width, height and depth and
// stood where the block stands. The block's own footprint, solid and door are unchanged by it. Pure: no three.js, no DOM.
import { propTint } from '../world/props-rules.ts';
import type { SkinPart } from '../world/building-skins-rules.ts';
import type { Piece, Shape } from './exchange-plan.ts';

const shapeOf = (q: SkinPart, w: number, h: number, d: number): Shape => {
  const n = q.size, m = Math.min(w, d);
  return q.shape === 'box' ? ['box', n[0]! * w, n[1]! * h, n[2]! * d] : q.shape === 'cylinder' ? ['cylinder', n[0]! * m, n[1]! * m, n[2]! * h, n[3]!] : q.shape === 'cone' ? ['cone', n[0]! * m, n[1]! * h, n[2]!] : ['sphere', n[0]! * m, n[1]!, n[2]!];
};

/** The skin's parts for a block of w x h x d centred at (cx, cz) facing `facing` (the front is local +z, as in frontier-plan.ts block()). */
export function skinPieces(parts: readonly SkinPart[], cx: number, cz: number, facing: number, w: number, h: number, d: number): Piece[] {
  const c = Math.cos(facing), s = Math.sin(facing);   // the same turn a piece's rotY gives (prop-kit.ts propPieces)
  return parts.map((q) => {
    const lx = q.at[0] * w, lz = q.at[2] * d;
    return { layer: q.layer ?? 'plain', shape: shapeOf(q, w, h, d), x: cx + lx * c + lz * s, y: q.at[1] * h, z: cz + lz * c - lx * s, tint: propTint(q.tint), rotY: facing + q.yaw, foot: 0 };
  });
}

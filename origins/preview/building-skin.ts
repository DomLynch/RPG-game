// A building skin turned into pieces (zone sandbox, 2026-10-16; promoted by World as slice B): the skin's parts (origins/world/building-skins.json, numbers as fractions of the building) scaled to one block's
// width, height and depth and stood where the block stands. The block's own footprint, solid and door are unchanged by it. `buildingSkin(id)` is the seam frontier-skin.ts (Web's #3212) asks for: the plan and the
// greybox draw through it and never see how the rows are stored. Pure: no three.js, no DOM.
import { propTint } from '../world/props-rules.ts';
import { fitScale, skinFit, skinIds, skinKind, skinParts, type SkinPart } from '../world/building-skins-rules.ts';
import type { Piece, Shape } from './exchange-plan.ts';
import type { BuildingSkin } from './frontier-skin.ts';

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

/** The skin a zone's `look.buildings` names, as the frontier plan draws through it; null for '' or an unknown id (the brick blocks as they were). */
export function buildingSkin(skinId: string): BuildingSkin | null {
  if (!skinIds().includes(skinId)) return null;
  return {
    model(kind, x, z, facing, w, d, strict = false) {
      const fit = skinFit(skinId, kind) ?? (strict ? null : skinFit(skinId, 'default'));
      return fit ? { node: fit.node, x, z, rotY: facing, scale: fitScale(fit, w, d) } : null;
    },
    parts(kind, x, z, facing, w, h, d) { const p = skinParts(skinId, kind); return p ? skinPieces(p, x, z, facing, w, h, d) : null; },
    landmark(kind, x, z, facing, w, h, d) { const p = skinKind(skinId, kind); return p ? skinPieces(p, x, z, facing, w, h, d) : null; },
  };
}

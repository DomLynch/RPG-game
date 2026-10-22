// The town's 3D kit on the plan (Web, Lead's brief 2026-10-22; Characters' docs/briefs/town-3d-kit.md): a plan piece row may name a building-skins model id in `skin`. The glb then draws it, through the same instanced path the
// Zone 1 kit uses (skin-models.ts loadSkinModels -> kitGroup, near/far bodies swapped by the model's own `lod.dist`), while the piece's shape stays as the fallback (drawn until the file lands, or for good if it fails) and
// as the footprint the walk and the plan were pinned to. Every number is a row: the piece's x/y/z/rotY/scale, the model's url/nodes/lod. Pure: no three.js.
import type { Piece, Shape } from '../zones/plan.ts';
import { skinModels } from '../world/building-skins-rules.ts';
import type { ModelPlacement } from './frontier-skin.ts';

/** Metres from a shape's centre down to its base (the model's origin stands on the base): a pediment extrudes up from y 0 already. */
const BASE_DROP: Record<Shape[0], (s: Shape) => number> = {
  box: (s) => (s[2] as number) / 2, cylinder: (s) => (s[3] as number) / 2, cone: (s) => (s[2] as number) / 2, sphere: (s) => s[1] as number, pediment: () => 0,
};
export const shapeBaseY = (p: Pick<Piece, 'shape' | 'y'>): number => p.y - BASE_DROP[p.shape[0]](p.shape);

/** The pieces that ask for a model, by skin id. */
export const skinnedPieces = (pieces: readonly Piece[]): Map<string, Piece[]> => {
  const by = new Map<string, Piece[]>();
  for (const p of pieces) if (p.skin) by.set(p.skin, [...(by.get(p.skin) ?? []), p]);
  return by;
};

/** The pieces a model's greybox is made of: the ones that carry its `skin` and the ones that only `cover` for it, by model id. */
export const greyboxOfSkins = (pieces: readonly Piece[]): Map<string, Piece[]> => {
  const by = new Map<string, Piece[]>();
  for (const p of pieces) { const id = p.skin ?? p.cover; if (id) by.set(id, [...(by.get(id) ?? []), p]); }
  return by;
};

/** One placement per skinned piece (the model's first node, on the piece's base). A skin id no model row holds is dropped: that piece keeps its shape. */
export function skinPlacements(pieces: readonly Piece[]): ModelPlacement[] {
  const out: ModelPlacement[] = [];
  for (const [id, list] of skinnedPieces(pieces)) {
    const node = skinModels().find((m) => m.id === id)?.nodes[0]; if (!node) continue;
    for (const p of list) out.push({ node, x: p.x, z: p.z, rotY: p.rotY, scale: p.scale ?? 1, y: shapeBaseY(p) });
  }
  return out;
}

/** The skin ids whose file is `url` (the greybox of these pieces can go once the file has landed). */
export const skinsOfFile = (url: string): readonly string[] => skinModels().filter((m) => m.url === url).map((m) => m.id);

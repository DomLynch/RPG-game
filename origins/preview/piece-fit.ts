// Fit the hero-rig loot pieces to a re-proportioned body (zone sandbox, Dom 2026-10-18: "measure the size difference and multiply it"). A loot piece is authored on the HERO's bind pose; the engine already hangs it on the
// body's own bones using the piece's own inverse binds (characters.ts `wear`, #606), so every piece follows the troll's joints, but its offset from each joint stays hero-sized: on a bigger-limbed body the
// piece sinks into the limb and shows as shards. This measures, per bone, how much longer the body's segment is than the hero's (the distance from the bone to its parent in the bind pose, hero vs body)
// and scales the piece's offset from that bone by the ratio: the inverse bind becomes `scale(ratio) * inverseBind`, so a vertex weighted to the bone is placed `ratio` times as far from the joint. Per bone,
// not one number: the shoulders can widen more than the shins. No resolution is lost (geometry moves, textures stay), and no art is made. Pure maths on skeleton data; the ratio limits are rows.
import * as THREE from 'three';
import { fxNum } from '../../src/fight/fx-rows.ts';

const worldAt = (skeleton: THREE.Skeleton, i: number): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i]!.clone().invert());
const parentOf = (skeleton: THREE.Skeleton, i: number): number => { const parent = skeleton.bones[i]!.parent; return parent ? skeleton.bones.findIndex((b) => b.name === parent.name) : -1; };

/** Per piece-bone name: body segment length / hero segment length, from the bind poses. A bone with no usable segment (the root, a zero-length joint) takes its parent's ratio, else 1; every ratio stays inside the rows' limits. */
export function boneRatios(source: THREE.Skeleton, rig: THREE.Skeleton): Map<string, number> {
  const minLen = fxNum('fit.min-len-m'), lo = fxNum('fit.ratio-min'), hi = fxNum('fit.ratio-max'), byName = new Map(rig.bones.map((b, i) => [b.name, i] as const)), out = new Map<string, number>();
  const ratioOf = (i: number): number => {
    const name = source.bones[i]!.name; const known = out.get(name); if (known !== undefined) return known;
    const p = parentOf(source, i), rigAt = byName.get(name), rigParent = p >= 0 ? byName.get(source.bones[p]!.name) : undefined;
    let ratio = 1;
    if (p >= 0 && rigAt !== undefined && rigParent !== undefined) {
      const heroLen = worldAt(source, i).distanceTo(worldAt(source, p)), bodyLen = worldAt(rig, rigAt).distanceTo(worldAt(rig, rigParent));
      ratio = heroLen >= minLen && bodyLen >= minLen ? bodyLen / heroLen : p >= 0 ? ratioOf(p) : 1;
    }
    ratio = Math.min(hi, Math.max(lo, ratio)); out.set(name, ratio); return ratio;
  };
  for (let i = 0; i < source.bones.length; i++) ratioOf(i);
  return out;
}

/** The pieces re-fitted to the rig: each a clone sharing the geometry and material, on a copy of its skeleton whose inverse binds carry the per-bone ratio. One new skeleton per source skeleton. */
export function fitPieces(pieces: readonly THREE.SkinnedMesh[], rig: THREE.Skeleton): THREE.SkinnedMesh[] {
  const fitted = new Map<THREE.Skeleton, THREE.Skeleton>(), rigNames = new Set(rig.bones.map((b) => b.name));
  return pieces.map((piece) => {
    if (!piece.skeleton) return piece;
    if (!piece.skeleton.bones.every((b) => rigNames.has(b.name))) return piece;   // scope: a biped rig with the hero's own bone names (troll, goblin); any other skeleton keeps the engine's plain retarget, no promise made
    let skeleton = fitted.get(piece.skeleton);
    if (!skeleton) {
      const ratios = boneRatios(piece.skeleton, rig);
      const at = new Map(rig.bones.map((b, k) => [b.name, k] as const));
      skeleton = new THREE.Skeleton(piece.skeleton.bones, piece.skeleton.boneInverses.map((m, i) => {
        const name = piece.skeleton.bones[i]!.name, k = at.get(name), r = ratios.get(name) ?? 1;
        if (k === undefined) return m;
        // At the body's bind pose a vertex lands where the hero's piece sits relative to its joint, scaled by the ratio about that joint, around the BODY's joint: trollPos + r * (p - heroPos), in world axes, so the body's different
        // posture (a hunch, arms forward) does not turn the piece about the joint. After that it follows the body's bones from the bind pose. invBind' = bodyInverse * T(bodyPos) * S(r) * T(-heroPos).
        const heroPos = worldAt(piece.skeleton, i), bodyPos = worldAt(rig, k);
        return rig.boneInverses[k]!.clone().multiply(new THREE.Matrix4().makeTranslation(bodyPos.x, bodyPos.y, bodyPos.z)).multiply(new THREE.Matrix4().makeScale(r, r, r)).multiply(new THREE.Matrix4().makeTranslation(-heroPos.x, -heroPos.y, -heroPos.z));
      }));
      fitted.set(piece.skeleton, skeleton);
    }
    const copy = piece.clone(); copy.skeleton = skeleton; return copy;
  });
}

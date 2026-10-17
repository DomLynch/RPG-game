// A creature that is hidden, or beyond `nearTick`, stands where it was posed: its rig is cut out of scene.updateMatrixWorld's walk and its skeletons stop updating (mobs-view.ts). Three's walk does not skip an
// invisible object, so before this every creature's 65-bone hierarchy (and the hero's) was walked each frame whether drawn or not (the T4 profile of the empty zone: updateMatrixWorld on top).
// HOW: a group with `matrixWorldAutoUpdate = false` is NOT enough in three 0.186: the flag now guards only that object's OWN matrix, and Object3D.updateMatrixWorld still calls every child, so the bones are
// walked and recomputed anyway (tests/creature-freeze.test.ts counts the visits). The walk is pruned by giving the frozen group an own no-op `updateMatrixWorld` (the scene's walk stops at it) and restoring the
// prototype's when it thaws. A skeleton's `update` is wrapped too (no bone-matrix recompute, no boneTexture upload). A skinned mesh draws from the bone matrices of its LAST update, so a frozen creature holds
// its pose until it is posed: `pose` below, called after the actor's own update.
import * as THREE from 'three';

export type Ice = { frozen: boolean; thaw: boolean };
export const newIce = (): Ice => ({ frozen: false, thaw: false });
const skip = (): void => {};

/** Wrap every skeleton under `root` once: while the creature is frozen (and not posed this frame) its update is a no-op. The render calls it for every drawn skin each frame. */
export function wrapSkeletons(root: THREE.Object3D, ice: Ice): void {
  const seen = new Set<THREE.Skeleton>();
  root.traverse((o) => { const skeleton = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh).skeleton : undefined; if (skeleton) seen.add(skeleton); });
  for (const skeleton of seen) { const real = skeleton.update.bind(skeleton); skeleton.update = () => { if (!ice.frozen || ice.thaw) real(); }; }
}

/** Freeze or thaw a creature's scene-graph cost: the group's own `updateMatrixWorld` becomes a no-op (the scene's walk stops there) or the prototype's returns. `thaw` is per frame: set it with `pose`. */
export function freeze(group: THREE.Object3D, ice: Ice, on: boolean): void {
  ice.frozen = on; ice.thaw = false;
  if (on) group.updateMatrixWorld = skip; else delete (group as Partial<Pick<THREE.Object3D, 'updateMatrixWorld'>>).updateMatrixWorld;
}

/** The frame a frozen creature is posed (after its position is set and its actor updated): its skeletons run for this frame's render and its root and bones are brought current once, since the scene's walk skips the group. */
export function pose(group: THREE.Object3D, ice: Ice): void { ice.thaw = true; THREE.Object3D.prototype.updateMatrixWorld.call(group, true); }

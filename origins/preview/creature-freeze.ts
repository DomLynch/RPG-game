// A creature that is hidden, or beyond `nearTick`, stands where it was posed: its group is cut out of scene.updateMatrixWorld's walk and its skeletons stop updating (mobs-view.ts). Three's walk does not skip an
// invisible object, so before this every creature's 65-bone hierarchy (and the hero's) was walked each frame whether drawn or not (the T4 profile of the empty zone: updateMatrixWorld on top). The same pattern
// remote-heroes.ts uses for its cheap and hidden figures (a group with matrixWorldAutoUpdate off is skipped by the scene's walk, and its skeletons' `update` does nothing, so no bone-matrix recompute and no
// boneTexture upload). A skinned mesh draws from the bone matrices of its LAST update, so a frozen creature holds its pose until it is posed: `pose` below, called after the actor's own update.
import * as THREE from 'three';

export type Ice = { frozen: boolean; thaw: boolean };
export const newIce = (): Ice => ({ frozen: false, thaw: false });

/** Wrap every skeleton under `root` once: while the creature is frozen (and not posed this frame) its update is a no-op. The render calls it for every drawn skin each frame. */
export function wrapSkeletons(root: THREE.Object3D, ice: Ice): void {
  const seen = new Set<THREE.Skeleton>();
  root.traverse((o) => { const skeleton = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh).skeleton : undefined; if (skeleton) seen.add(skeleton); });
  for (const skeleton of seen) { const real = skeleton.update.bind(skeleton); skeleton.update = () => { if (!ice.frozen || ice.thaw) real(); }; }
}

/** Freeze or thaw a creature's scene-graph cost: the group drops out of (or returns to) scene.updateMatrixWorld's walk. `thaw` is per frame: set it with `pose`. */
export function freeze(group: THREE.Object3D, ice: Ice, on: boolean): void { ice.frozen = on; ice.thaw = false; group.matrixWorldAutoUpdate = !on; }

/** The frame a frozen creature is posed (after its position is set and its actor updated): its skeletons run for this frame's render and its bones and root are brought current once, since the scene's walk skips the group. */
export function pose(group: THREE.Object3D, ice: Ice): void { ice.thaw = true; group.updateMatrixWorld(true); }

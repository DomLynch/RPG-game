// The Pit's one picker (Lead 2026-09-30: PR A, shared by the skull wall and the racks). A tap on the canvas is a ray from the Pit camera;
// what it picks is the NEAREST of the room's pick volumes it passes through. The volumes are world-space boxes kept beside the room, not
// meshes: the room's draws are merged by material, so nothing in the scene could be picked apart, and boxes cost the GPU nothing.
import * as THREE from 'three';

export type PickTarget<T> = { id: T; box: THREE.Box3 };
export type Picker<T> = (tap: { x: number; y: number }) => T | null;   // tap in NDC (x right, y up, −1..1), as Stage.readTap gives it

export function createPicker<T>(camera: THREE.Camera, targets: () => readonly PickTarget<T>[]): Picker<T> {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  return (tap) => {
    ray.setFromCamera(ndc.set(tap.x, tap.y), camera);
    let best: T | null = null, near = Infinity;
    for (const target of targets()) {
      if (!ray.ray.intersectBox(target.box, hit)) continue;
      const d = hit.distanceToSquared(ray.ray.origin);
      if (d < near) { near = d; best = target.id; }
    }
    return best;
  };
}

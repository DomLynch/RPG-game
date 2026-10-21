// The phone's sun-shadow caster set (Dom: the phone is slow; the T4 profile put the shadow pass at 10% of the main thread at 4x, and a census showed 260 meshes / 675 k triangles casting: every creature's rank-look pieces, the weapons, the kit's ground stones and props).
// A phone keeps the hero as the one caster; every other mesh stops casting (a creature already has its soft contact blob). Pure over an object graph, so it is tested without a renderer.
import type * as THREE from 'three';

/** Turn castShadow ON for every mesh under each of `roots` (the creatures a phone keeps as casters: their bodies and pieces default to off, the contact blob stands in for the rest). */
export function enableCasters(roots: readonly THREE.Object3D[]): void {
  for (const r of roots) r.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.castShadow) m.castShadow = true; });
}

/** Turn off castShadow on every mesh under `root` that is not inside `keep`. Returns how many it switched off (0 once the set is already limited). */
export function limitCasters(root: THREE.Object3D, keep: THREE.Object3D | readonly THREE.Object3D[] | null | undefined): number {
  let off = 0;
  const kept = new Set<THREE.Object3D>(Array.isArray(keep) ? keep : keep ? [keep as THREE.Object3D] : []);
  const walk = (o: THREE.Object3D): void => {
    if (kept.has(o)) return;   // a kept subtree is not entered
    const m = o as THREE.Mesh;
    if (m.isMesh && m.castShadow) { m.castShadow = false; off++; }
    for (const c of o.children) walk(c);
  };
  walk(root);
  return off;
}

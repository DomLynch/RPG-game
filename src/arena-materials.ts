// Clones of the arena's material set for the Pit's look mocks (Lead, 2026-09-30: the Pit gets clones, so nothing it tweaks can change
// the arena's own render). A clone shares the maps (the worker's sand and stone albedo and normal maps) and owns everything else; the
// vertex-colour flag is off, because the room's geometry carries no colour attribute (the arena bakes its grime into vertex colours).
import type { MeshStandardMaterial } from 'three';

export function clonesOf<K extends string>(materials: Record<K, MeshStandardMaterial>): Record<K, MeshStandardMaterial> {
  const out = {} as Record<K, MeshStandardMaterial>;
  for (const key of Object.keys(materials) as K[]) { const clone = materials[key].clone(); clone.vertexColors = false; out[key] = clone; }
  return out;
}

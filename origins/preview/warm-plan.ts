// The zone warm-up list (the Metal reading of live Zone 2, 2026-10-09: 11 programs compiled AFTER [zone ready], all the hero's own materials, plus a 300 ms stall at engage). A zone's creature kinds
// were the whole list, so a zone whose kinds do not happen to share the player's materials (Zone 1's knight/pitborn/witch do, Zone 2's goblin + wolf do not) paid for the PLAYER's actor at his first
// cut. The player's actor is in EVERY zone's list, derived from nothing zone-specific. Pure: the GL work (warmActor) is the page's and is checked on a real GPU (scripts/origins-engage-warmup.mjs).
import * as THREE from 'three';

export const PLAYER = 'player';
/** Everything a zone must have linked and uploaded before it is ready: the player's actor first, then the zone's creature kinds. */
export const warmList = (kinds: readonly string[]): string[] => [PLAYER, ...kinds.filter((k) => k !== PLAYER)];
/** Ready when every entry is warmed or failed (a failed one is logged and skipped, never waited for forever). */
export const warmDone = (list: readonly string[], warmed: readonly string[], failed: readonly string[]): boolean => list.every((k) => warmed.includes(k) || failed.includes(k));

/** Link the programs, upload the textures of `root` (the player's actor), off-frame: a clone with EVERY part visible (a drawn sword, a tabard, the eyes: three compiles only visible objects, and a part hidden until the first cut compiled at engage). */
export async function warmActor(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene, probe: THREE.Object3D, frame: () => Promise<void>): Promise<void> {
  probe.traverse((o) => { o.visible = true; });
  const holder = new THREE.Group(); holder.add(probe);   // not in the scene: the scene is only the lights and fog the programs are keyed on
  await renderer.compileAsync(holder, camera, scene);
  const textures = new Set<THREE.Texture>();
  probe.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture); });
  for (const t of textures) { renderer.initTexture(t); await frame(); }
}

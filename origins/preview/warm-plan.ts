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

/**
 * Warm `kits` one after another within `boundMs` (the kit warm-up's own cap, `kitWarmMs`). `settle` is settleWithin (true when the work settled, false at the bound). At the bound the loop STOPS before its next kit and the result is `failed: true`, so the page keeps remotes
 * on the base figure. A compile cannot be taken back, so the ONE kit already in flight is waited for (at most `hardMs`, a compile that never settles must not hold the zone): when this returns nothing is compiling and nothing will, so nothing compiles after ready.
 * A kit that throws stops the loop the same way. `done` runs once when the loop has really ended (clean up what it set up). `ended` resolves at that same moment: a kit that outlasts `hardMs` (a slow runner) is still compiling when this returns,
 * so whoever must not read the programs mid-compile (the page's `remoteKitsWarm`, the row's `before` snapshot) waits for `ended`.
 */
export async function warmKitsWithin<K>(kits: readonly K[], warmOne: (kit: K) => Promise<void>, boundMs: number, settle: (label: string, work: Promise<unknown>, boundMs: number) => Promise<boolean>, done: () => void = () => {}, hardMs = boundMs * 6): Promise<{ failed: boolean; warmed: number; ended: Promise<void> }> {
  let stop = false, broke = false, warmed = 0;
  const loop = (async () => {
    try { for (const kit of kits) { if (stop) return; await warmOne(kit); warmed++; } } catch { broke = true; } finally { done(); }
  })();
  const settled = await settle('remote-kits', loop, boundMs);
  if (!settled) { stop = true; await settle('remote-kits in flight', loop, hardMs); }
  return { failed: !settled || broke, warmed, ended: loop };
}

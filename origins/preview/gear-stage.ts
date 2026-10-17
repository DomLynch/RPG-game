// The gear sheet's mannequin (zone-agnostic: it takes only the hero rig url, so any zone mounts it): the engine's own player rig (src/fight loadWarriors, the warrior the Zone 1 hero is) in a small scene of its own, dressed with the engine's
// own loot pieces (loadLoot -> actor.wear, the call src/fight/scene.ts makes for the Pit's player). src/core/gear-room.ts draws it through the GearStage seam; it borrows only Zone 1's renderer, so the
// walk's scene is never touched. Presentation only: the rig and pieces load on the first open, and what was asked to be worn before they land goes on when they do.
import * as THREE from 'three';
import { captureException } from '@sentry/browser';
import { loadLoot, loadWarriors, lootIds, lootWorn } from '../../src/fight/index.ts';
import { warmGearRoom, type GearStage } from '../../src/core/index.ts';
import type { Tier } from '../../src/core/index.ts';
import { drawProxy } from './warm-proxy.ts';
import { previewRule } from './preview-rules.ts';
import lootUrl from '../../src/assets/loot.glb?url';

// `bodyUrl` is the hero rig's url as the page already holds it (play.ts ASSETS.hero, the build's optimized file): the stage never imports the .glb itself, which would ship a second, unoptimized copy.
export function createGearStage(renderer: THREE.WebGLRenderer, bodyUrl: string) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x302820, 1.1));   // the room's key and rim come from gear-room.ts; this is the fill the Pit borrows from its arena
  let actor: Awaited<ReturnType<typeof loadWarriors>>['player'] | undefined, pieces: Awaited<ReturnType<typeof loadLoot>> | undefined, worn: readonly string[] = [], tiers: Record<string, Tier> = {}, started = false;
  const dress = () => { if (actor && pieces) actor.wear(pieces.filter((piece) => lootWorn(piece, worn)), (id, error) => captureException(error, { tags: { loot: id } }), (piece) => tiers[lootIds(piece).find((id) => worn.includes(id)) ?? ''] ?? 'Recruit'); };
  let loading: Promise<void> = Promise.resolve();
  const load = () => { if (started) return loading; started = true; loading = Promise.all([loadWarriors(bodyUrl), loadLoot(lootUrl)]).then(([warriors, loot]) => { actor = warriors.player; pieces = loot; scene.add(actor.anchor); dress(); }).catch((error: unknown) => { started = false; console.warn('the gear screen rig did not load', error); captureException(error); }); return loading; };
  const stage: GearStage = {
    scene, camera,
    setArenaVisible() { /* a scene of its own: there is no arena in it to hide */ },
    hero: { place(x, z, heading, speed, dt) { load(); if (!actor) return; actor.anchor.position.set(x, 0, z); actor.anchor.rotation.y = heading; actor.update(speed, dt, 'sheathed', 0); } },
    draw() { if (held) renderer.clear(); else renderer.render(scene, camera); },   // while the warm-up runs the sheet shows its empty stage (the backdrop clear), not a synchronous program link under the player's thumb
  };
  const paint = () => renderer.render(scene, camera);
  // The rig and loot.glb load, the worn set goes on, and the studio frame is built off the main thread: the sheet's programs link after [zone ready] on the kit warm's queue, not when the player first opens it
  // (a no-op where the rig did not load). `hold()` is called when that warm is queued, and the stage is released whatever the warm does.
  // The mannequin's rig is parsed on its own, so its textures and geometry are not the walking hero's: uploaded here ONE per frame (T4 2026-10-17: the one frame that drew it all was a 248 ms task, 1 program of it).
  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  async function uploadSlices() {
    const textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
    scene.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; geometries.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture); });
    for (const t of textures) { renderer.initTexture(t); await nextFrame(); }
    for (const g of geometries) { drawProxy(renderer, camera, g); await nextFrame(); }
  }
  let held = false;
  const hold = () => { held = true; };
  const warm = async () => {   // resolves with the ms the one synchronous frame took (the long task the warm leaves on the main thread) and how the programs split between the compile and that frame
    let drawMs = 0;
    const trace = { compileMs: 0, compilePrograms: 0, drawPrograms: 0, slowest: '' };
    const count = () => renderer.info.programs?.length ?? -1;
    const timed = (label = 'all') => { const t = performance.now(), before = count(); paint(); const ms = performance.now() - t; if (ms > drawMs) { drawMs = ms; trace.slowest = label; } trace.drawPrograms += count() - before; };
    // compileAsync builds the programs off the main thread, but the GPU's first draw with each still costs (T4: 13 programs, one 226 ms frame): so the backdrop and then each mesh are drawn alone, one per frame.
    const slices = async (s: THREE.Scene, c: THREE.Camera) => {
      const t = performance.now(), before = count(); await renderer.compileAsync(s, c); trace.compileMs = Math.round(performance.now() - t); trace.compilePrograms = count() - before;
      const meshes: THREE.Object3D[] = []; s.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) meshes.push(o); });
      for (const m of meshes) m.visible = false;
      for (let i = 0; i < previewRule('gearWarmSettle'); i++) await nextFrame();   // the driver's own pipeline builds for the compiled programs finish while no frame waits on them (T4: the first draw after compileAsync was a 179 ms wait)
      try { timed('backdrop'); await nextFrame(); for (const m of meshes) { m.visible = true; timed(`${m.name}|${(m as THREE.SkinnedMesh).isSkinnedMesh ? 'skinned' : 'mesh'}|${String(((m as THREE.Mesh).material as THREE.Material).name)}`); m.visible = false; await nextFrame(); } } finally { for (const m of meshes) m.visible = true; }
    };
    try {
      await load();
      if (actor) await uploadSlices();
      if (actor) await warmGearRoom({ ...stage, draw: timed }, slices);
    } finally { held = false; }
    return { drawMs, ...trace };
  };
  return { stage, load, hold, warm, wear(ids: readonly string[], next: Record<string, Tier>) { worn = ids; tiers = next; dress(); } };
}

// The gear sheet's mannequin (zone-agnostic: it takes only the hero rig url, so any zone mounts it): the engine's own player rig (src/fight loadWarriors, the warrior the Zone 1 hero is) in a small scene of its own, dressed with the engine's
// own loot pieces (loadLoot -> actor.wear, the call src/fight/scene.ts makes for the Pit's player). src/core/gear-room.ts draws it through the GearStage seam; it borrows only Zone 1's renderer, so the
// walk's scene is never touched. Presentation only: the rig and pieces load on the first open, and what was asked to be worn before they land goes on when they do.
import * as THREE from 'three';
import { captureException } from '@sentry/browser';
import { loadLoot, loadWarriors, lootIds, lootWorn } from '../../src/fight/index.ts';
import { warmGearRoom, type GearStage } from '../../src/core/index.ts';
import type { Tier } from '../../src/core/index.ts';
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
  let held = false;
  const hold = () => { held = true; };
  const warm = async () => {   // resolves with the ms the one synchronous frame took (the long task the warm leaves on the main thread) and how the programs split between the compile and that frame
    let drawMs = 0;
    const trace = { compileMs: 0, compilePrograms: 0, drawPrograms: 0 };
    const count = () => renderer.info.programs?.length ?? -1;
    try {
      await load();
      if (actor) await warmGearRoom({ ...stage, draw: () => { const t = performance.now(), before = count(); paint(); drawMs = performance.now() - t; trace.drawPrograms = count() - before; } }, async (s, c) => { const t = performance.now(), before = count(); await renderer.compileAsync(s, c); trace.compileMs = Math.round(performance.now() - t); trace.compilePrograms = count() - before; });
    } finally { held = false; }
    return { drawMs, ...trace };
  };
  return { stage, load, hold, warm, wear(ids: readonly string[], next: Record<string, Tier>) { worn = ids; tiers = next; dress(); } };
}

// The Zone 1 gear sheet's mannequin: the engine's own player rig (src/characters.ts loadWarriors, the warrior the Zone 1 hero is) in a small scene of its own, dressed with the engine's
// own loot pieces (loadLoot -> actor.wear, the call src/scene.ts makes for the Pit's player). src/gear-room.ts draws it through the GearStage seam; it borrows only Zone 1's renderer, so the
// walk's scene is never touched. Presentation only: the rig and pieces load on the first open, and what was asked to be worn before they land goes on when they do.
import * as THREE from 'three';
import { captureException } from '@sentry/browser';
import { loadLoot, loadWarriors, lootIds, lootWorn } from '../../src/characters.ts';
import type { GearStage } from '../../src/gear-room.ts';
import type { Tier } from '../../src/grades.ts';
import warriorUrl from '../../src/assets/warrior.glb?url';
import lootUrl from '../../src/assets/loot.glb?url';

export function createZone1GearStage(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff0dd, 0x302820, 1.1));   // the room's key and rim come from gear-room.ts; this is the fill the Pit borrows from its arena
  let actor: Awaited<ReturnType<typeof loadWarriors>>['player'] | undefined, pieces: Awaited<ReturnType<typeof loadLoot>> | undefined, worn: readonly string[] = [], tiers: Record<string, Tier> = {}, started = false;
  const dress = () => { if (actor && pieces) actor.wear(pieces.filter((piece) => lootWorn(piece, worn)), (id, error) => captureException(error, { tags: { loot: id } }), (piece) => tiers[lootIds(piece).find((id) => worn.includes(id)) ?? ''] ?? 'Recruit'); };
  const load = () => { if (started) return; started = true; void Promise.all([loadWarriors(warriorUrl), loadLoot(lootUrl)]).then(([warriors, loot]) => { actor = warriors.player; pieces = loot; scene.add(actor.anchor); dress(); }).catch((error: unknown) => { started = false; console.warn('the gear screen rig did not load', error); captureException(error); }); };
  const stage: GearStage = {
    scene, camera,
    setArenaVisible() { /* a scene of its own: there is no arena in it to hide */ },
    hero: { place(x, z, heading, speed, dt) { load(); if (!actor) return; actor.anchor.position.set(x, 0, z); actor.anchor.rotation.y = heading; actor.update(speed, dt, 'sheathed', 0); } },
    draw() { renderer.render(scene, camera); },
  };
  return { stage, load, wear(ids: readonly string[], next: Record<string, Tier>) { worn = ids; tiers = next; dress(); } };
}

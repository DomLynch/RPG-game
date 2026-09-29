// The Pit's whole view of the game (docs/pit-design.md §3). src/pit-coordinator.ts builds it from the scene and main.ts and passes it
// in; nothing in src/pit/ imports a live game module (tests/pit-boundary.test.ts). The renderer, scene and camera are borrowed: the Pit
// never disposes them, and adds to the scene only what it built itself. The rack, mover and gate hooks join in the room PR.
import type * as THREE from 'three';
import type { Loot } from '../loot.ts';

export type Stage = {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  setArenaVisible(on: boolean): void;   // scene.ts: everything but the lights and the player, hidden while the Pit shows
  hero: { place(x: number, z: number, heading: number, speed: number, dt: number): void };   // scene.ts: the player's rig, walk/idle
  draw(): void;   // one frame of the borrowed renderer; the fight's render() does not run while the Pit shows
  grade(material: THREE.MeshStandardMaterial, kind: 'stone' | 'sand'): void;   // the arena's background grade (colour-grade.ts)
  pieces(ids: readonly string[]): Promise<THREE.Mesh[]>;   // still copies of owned pieces; geometry and material shared, never disposed
  loot(): Loot;
};
// How the player came down: through the gate after a win, or the side door after a defeat (lands at the rack, Lead 2026-09-29).
export type Entry = 'win' | 'defeat';
// Where the camera stands: the rack or the next-fight gate (the `?look=pit` stills, docs/pit-design.md §7).
export type Pose = 'rack' | 'gate';
export type Pit = { frame(dt: number): void; leave(): void; dispose(): void };

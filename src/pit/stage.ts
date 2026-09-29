// The Pit's whole view of the game (docs/pit-design.md §3). src/pit-coordinator.ts builds it from the scene and main.ts and passes it
// in; nothing in src/pit/ imports a live game module (tests/pit-boundary.test.ts). The renderer, scene and camera are borrowed: the Pit
// never disposes them, and adds to the scene only what it built itself.
import type * as THREE from 'three';
import type { Loot, LootId } from '../loot.ts';
import type { OpponentId } from '../roster.ts';

export type Stage = {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  setArenaVisible(on: boolean): void;   // scene.ts: the arena and the opponent, hidden while the Pit shows
  hero: { place(x: number, z: number, heading: number, speed: number, dt: number): void };   // scene.ts: the player's rig, walk/idle
  readMove(): { x: number; z: number };   // the player's move intent, already in the Pit camera's ground plane
  loot(): Loot; wear(id: LootId): void; legendName(opponent: OpponentId, tier?: number): string;
  nextFight(): void; rematch(): void;   // main.ts's own kill-screen handlers
};
// How the player came down: through the gate after a win, or the side door after a defeat (lands at the rack, Lead 2026-09-29).
export type Entry = 'win' | 'defeat';
export type Pit = { frame(dt: number): void; leave(): void; dispose(): void };

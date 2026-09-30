// The Pit's whole view of the game (docs/pit-design.md §3). src/pit-coordinator.ts builds it from the scene and main.ts and passes it
// in; nothing in src/pit/ imports a live game module (tests/pit-boundary.test.ts). The renderer, scene and camera are borrowed: the Pit
// never disposes them, and adds to the scene only what it built itself.
import type * as THREE from 'three';
import type { Loot, LootId } from '../loot.ts';

// The scene's half (scene.ts pitStage).
export type SceneStage = {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  setArenaVisible(on: boolean): void;   // everything but the lights and the player, hidden while the Pit shows
  hero: { place(x: number, z: number, heading: number, speed: number, dt: number): void };   // the player's rig, walk/idle
  draw(): void;   // one frame of the borrowed renderer; the fight's render() does not run while the Pit shows
  grade(material: THREE.MeshStandardMaterial, kind: 'stone' | 'sand'): void;   // the arena's background grade (colour-grade.ts)
  arenaMaterials?(): Record<'sand' | 'stone' | 'iron' | 'cloth' | 'coal', THREE.MeshStandardMaterial>;   // CLONES of the ring's own surfaces (maps shared, never disposed by the Pit); the D3 look mocks only
  pieces(ids: readonly string[]): Promise<THREE.Mesh[]>;   // still copies of owned pieces; geometry and material shared, never disposed
  loot(): Loot;
};
// main.ts's half: the fight's own input, rack rows and gate. Absent on the `?look=pit` still, which walks nowhere and taps nothing.
export type GameStage = {
  readMove(): { x: number; z: number };   // the move intent as input.ts gives it (x right, z −1 forward); the Pit turns it by its camera
  rackRows(): HTMLElement[];   // the journal rack's own rows (name, provenance caption, Wear/Worn), wired to its own wear path
  trophyLine(id: LootId): string;   // "Taken from Leonidas, rank 7"
  gate(): { label: string; go(): void };   // the kill screen's own Next/Rematch: go() closes the Pit, then presses it
};
export type Stage = SceneStage & Partial<GameStage>;
// How the player came down: through the gate after a win, or the side door after a defeat (lands at the rack, Lead 2026-09-29).
export type Entry = 'win' | 'defeat';
// Where the camera stands on the `?look=pit` stills: the rack, the trophy wall or the next-fight gate (docs/pit-design.md §7).
export type Pose = 'rack' | 'trophies' | 'gate';
// A D3 look mock (styles.ts), stills only: `?look=pit&style=a|b|c`.
export type PitStyle = 'a' | 'b' | 'c';
export type Pit = { frame(dt: number): void; leave(): void; dispose(): void };

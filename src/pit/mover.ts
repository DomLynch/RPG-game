// The hero's walk in the Pit (docs/pit-design.md §1): a small kinematic mover, not the simulation. It reads the same move intent the fight
// does (input.ts: x right, z −1 forward) and turns it by the Pit camera's yaw with the fight's own formula (sim.ts advance), so the stick
// means the same thing in both. The room's floor, less a margin and the furniture, bounds him; the zone he stands in picks the camera.
import type * as THREE from 'three';

export const WALK = 1.9;   // m/s: the rig's walk blend (characters.ts gaitWeights), not a jog; the room is 10 m across
export const EYE_BACK = 3.45, EYE_GAP = 2.25;   // the walking camera's farthest z (the ramp mouth) and the least it stands behind him
// The rack's pegs (x −5 + 0.65) and the plinths (x 5 − 1.1); at the back he stops EYE_GAP short of the camera, or the lens fills with his helmet.
export const BOUNDS = { x: [-4.35, 3.9], z: [-3.1, EYE_BACK - EYE_GAP] } as const;
export type Zone = 'rack' | 'trophies' | 'gate';   // where he can stand; a look Pose (stage.ts) may frame more (the skull wall, the vault) without being a zone
export type Walker = { x: number; z: number; heading: number; speed: number };

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
const TURN = 10;   // 1/s: how fast he turns to face his walk (critically damped on the shortest arc)

export function walk(w: Walker, move: { x: number; z: number }, yaw: number, dt: number): Walker {
  const length = Math.hypot(move.x, move.z);
  if (!length || !Number.isFinite(length) || dt <= 0) return { ...w, speed: 0 };
  const scale = Math.min(1, length) / length;   // a full stick walks at WALK, a half stick at half
  const dx = (move.x * Math.cos(yaw) + move.z * Math.sin(yaw)) * scale, dz = (-move.x * Math.sin(yaw) + move.z * Math.cos(yaw)) * scale;
  const x = clamp(w.x + dx * WALK * dt, BOUNDS.x), z = clamp(w.z + dz * WALK * dt, BOUNDS.z);
  const want = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(want - w.heading), Math.cos(want - w.heading));
  // Speed is what he actually covered, so a walk into the wall stands him still instead of treading on the spot.
  return { x, z, heading: w.heading + turn * Math.min(1, dt * TURN), speed: Math.hypot(x - w.x, z - w.z) / dt };
}

// The zone under him: the rack (left wall), the trophy wall (right), the gate (the far wall's middle), or the open floor (null).
export function zoneAt(x: number, z: number): Zone | null {
  if (x < -3.1) return 'rack';
  if (x > 2.7) return 'trophies';
  if (z < -2.25 && Math.abs(x) < 1.4) return 'gate';
  return null;
}

// The yaw the fight's formula wants for a camera at `camera` looking at `target` (camera.ts: the eye sits at target + (sin yaw, cos yaw)).
export const yawOf = (camera: readonly number[], target: readonly number[]) => Math.atan2(camera[0]! - target[0]!, camera[2]! - target[2]!);

// The right-finger look (Dom's live test, 2026-09-30): the arena's own gesture, a drag on the canvas, turns the walking camera round him.
// `yaw` and `pitch` are the drag's offsets in radians (main.ts feeds pixels at the arena's rates); the eye swings round the look point at
// its own distance, rises or dips with the pitch, and never leaves the room (ROOM.md's box less a margin), so no wall clips at 375.
export const LOOK = { yawPerPx: 0.005, pitchPerPx: 0.003, pitch: [-0.35, 0.55] as const, eye: { x: 4.6, z: [-3.35, 3.45] as const, y: [0.7, 3.3] as const } };
export function orbitEye(eye: THREE.Vector3, look: THREE.Vector3, yaw: number, pitch: number): THREE.Vector3 {
  const dx = eye.x - look.x, dz = eye.z - look.z, r = Math.hypot(dx, dz), a = Math.atan2(dx, dz) + yaw;
  const p = clamp(pitch, LOOK.pitch);
  eye.set(look.x + Math.sin(a) * r, eye.y + r * Math.tan(p), look.z + Math.cos(a) * r);
  eye.x = clamp(eye.x, [-LOOK.eye.x, LOOK.eye.x]); eye.z = clamp(eye.z, LOOK.eye.z); eye.y = clamp(eye.y, LOOK.eye.y);
  return eye;
}

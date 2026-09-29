// The hero's walk in the Pit (docs/pit-design.md §1): a small kinematic mover, not the simulation. It reads the same move intent the fight
// does (input.ts: x right, z −1 forward) and turns it by the Pit camera's yaw with the fight's own formula (sim.ts advance), so the stick
// means the same thing in both. The room's floor, less a margin and the furniture, bounds him; the zone he stands in picks the camera.
import type { Pose } from './stage.ts';

export const WALK = 1.9;   // m/s: the rig's walk blend (characters.ts gaitWeights), not a jog; the room is 8 m across
export const EYE_BACK = 2.85, EYE_GAP = 1.6;   // the walking camera's farthest z (the ramp mouth) and the least it stands behind him
// The rack's pegs (x −4 + 0.65) and the plinths (x 4 − 1.1); at the back he stops EYE_GAP short of the camera, or the lens fills with his helmet.
export const BOUNDS = { x: [-3.35, 2.9], z: [-2.35, EYE_BACK - EYE_GAP] } as const;
export type Zone = Pose | 'trophies';
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
  if (x < -2.1) return 'rack';
  if (x > 1.7) return 'trophies';
  if (z < -1.5 && Math.abs(x) < 1.4) return 'gate';
  return null;
}

// The yaw the fight's formula wants for a camera at `camera` looking at `target` (camera.ts: the eye sits at target + (sin yaw, cos yaw)).
export const yawOf = (camera: readonly number[], target: readonly number[]) => Math.atan2(camera[0]! - target[0]!, camera[2]! - target[2]!);

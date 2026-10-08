// COPY of src/sim.ts `advance` / `wrapAngle` for the open world (Dom: copy the Pit, edit only what the open world forces). The ONLY change is marked `// open-world:` below; src/sim.ts is untouched.
import { M } from '../../src/detmath.ts';   // never Math.<transcendental> in the sim: engines round them differently (tests/detmath.test.ts)
import { TARGET, type Input, type State } from '../../src/sim.ts';
export type { Input, State };
// open-world: there is no wall. Every `RADIUS` site in the copied duel.ts (walled(), the loiter band, the retreat band, the knockback clamp, validatePose) reads this, so each is dead without being edited.
export const RADIUS = 1e9;
const STEP = 1 / 60;
// World coordinates only. No renderer, clock, animation, physics or browser state.
// `pace` scales the fighter's speed (moves.ts `Opponent.speed`; 1 = a man): walking, sprinting, the wind-up lunge and the backstep all follow it.
export function advance(state: State, input: Input, target: { x: number; z: number } = TARGET, pace = 1): State {
  const length = M.hypot(input.x, input.z);
  if (!length || !Number.isFinite(length) || !Number.isFinite(input.yaw)) return { ...state };
  const scale = Math.min(1, length) / length;
  const dx = (input.x * M.cos(input.yaw) + input.z * M.sin(input.yaw)) * scale;
  const dz = (-input.x * M.sin(input.yaw) + input.z * M.cos(input.yaw)) * scale;
  const speed = (input.run ? 5.2 : 3) * pace;
  let x = state.x + dx * speed * STEP;
  let z = state.z + dz * speed * STEP;
  // Resolve against the other fighter, including attack step-in and retreat.
  const tx = x - target.x, tz = z - target.z;
  const gap = M.hypot(tx, tz);
  if (gap < 0.85) {
    const angle = gap > 0.00001 ? M.atan2(tx, tz) : state.heading + Math.PI;
    x = target.x + M.sin(angle) * 0.85;
    z = target.z + M.cos(angle) * 0.85;
  }
  // open-world: the ring-wall clamp (src/sim.ts pulled x,z back inside the play circle) is removed; the world has no wall.
  if (M.hypot(x - target.x, z - target.z) < .85 - 1e-8) return { ...state };
  return { x, z, heading: M.atan2(dx, dz), distance: state.distance + M.hypot(x - state.x, z - state.z) };
}

export function wrapAngle(angle: number): number {
  return M.atan2(M.sin(angle), M.cos(angle));
}

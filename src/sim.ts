export const STEP = 1 / 60;
export const RADIUS = 8.55;
export const TARGET = { x: 0, z: -2.5 };
export type State = { x: number; z: number; heading: number; distance: number };
export type Input = { x: number; z: number; yaw: number; run: boolean };
export const initialState = (): State => ({ x: 0, z: 4, heading: Math.PI, distance: 0 });

// World coordinates only. No renderer, clock, animation, physics or browser state.
export function advance(state: State, input: Input): State {
  const length = Math.hypot(input.x, input.z);
  if (!length || !Number.isFinite(length) || !Number.isFinite(input.yaw)) return { ...state };
  const scale = Math.min(1, length) / length;
  const dx = (input.x * Math.cos(input.yaw) + input.z * Math.sin(input.yaw)) * scale;
  const dz = (-input.x * Math.sin(input.yaw) + input.z * Math.cos(input.yaw)) * scale;
  const speed = input.run ? 5.2 : 3;
  let x = state.x + dx * speed * STEP;
  let z = state.z + dz * speed * STEP;
  // A stationary capsule lets the camera trial exercise a real near-target case.
  const tx = x - TARGET.x, tz = z - TARGET.z;
  const gap = Math.hypot(tx, tz);
  if (gap < 0.85) {
    const angle = gap > 0.00001 ? Math.atan2(tx, tz) : state.heading + Math.PI;
    x = TARGET.x + Math.sin(angle) * 0.85;
    z = TARGET.z + Math.cos(angle) * 0.85;
  }
  const radius = Math.hypot(x, z);
  if (radius > RADIUS) { x *= RADIUS / radius; z *= RADIUS / radius; }
  return { x, z, heading: Math.atan2(dx, dz), distance: state.distance + Math.hypot(x - state.x, z - state.z) };
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

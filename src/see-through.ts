// The hero fades while his body hides the opponent's wind-up (Lead, 2026-10-05: at close range the Goblin's knife and the Executioner's
// scythe sit behind the hero's back, so the player cannot read the tell). Presentation only: nothing here reads or changes the sim.
export const SEE_THROUGH = { opacity: 0.35, seconds: 0.1, radius: 0.35, height: 1.9 } as const;   // opacity while faded; ease in/out (~6 frames at 60 Hz); body capsule (m)

type Point = { x: number; y: number; z: number };

// Whether the line from the eye to `point` passes through the hero's body: a vertical capsule of SEE_THROUGH.radius from the floor to
// SEE_THROUGH.height, standing at (hero.x, hero.z). Solved in the floor plane (the closest approach of the line's shadow to his axis), then
// checked for height at that approach. A point in front of him (nearer the eye than his axis) is never hidden by him.
export function bodyHides(eye: Point, point: Point, hero: { x: number; z: number }, scale = 1): boolean {
  const dx = point.x - eye.x, dz = point.z - eye.z, len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return false;
  const t = ((hero.x - eye.x) * dx + (hero.z - eye.z) * dz) / len2;   // where along the eye-to-point line his axis is closest
  if (t <= 0 || t >= 1) return false;
  const cx = eye.x + dx * t - hero.x, cz = eye.z + dz * t - hero.z;
  if (Math.hypot(cx, cz) > SEE_THROUGH.radius * scale) return false;
  const y = eye.y + (point.y - eye.y) * t;
  return y >= 0 && y <= SEE_THROUGH.height * scale;
}

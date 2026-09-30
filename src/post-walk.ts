// The walk after a win (docs/pit-design.md §9, D2): with the fight over, the stick walks the winner round the sand toward the gate. A small
// kinematic mover in the presentation, like the Pit's (src/pit/mover.ts): the fight is finished, so the simulation and its record never see
// these steps (duel.ts steps nobody once a fighter is down). The stick is turned by the camera's yaw with the fight's own formula (sim.ts
// advance), so it means the same thing before the fight, in it and after it. The sand circle bounds him (sim.ts RADIUS) except inside the
// gate's arc, where he may walk on to the wall line; what happens at the gate is the Pit's (pit-coordinator.ts).
import { inGate, LAYOUT } from './arena.ts';
import { RADIUS, type State } from './sim.ts';

export const WALK = 1.9;   // m/s: the rig's walk blend (characters.ts gaitWeights), the Pit's own pace (src/pit/mover.ts WALK)
export const GATE_REACH = LAYOUT.wall.inner - 0.3;   // how far through the arc he may go: the wall line, less his own half-width
const TURN = 10;   // 1/s: how fast he turns to face his walk (the Pit mover's)
export type Walker = { x: number; z: number; heading: number; speed: number };

export const walkerFrom = (body: Pick<State, 'x' | 'z' | 'heading'>): Walker => ({ x: body.x, z: body.z, heading: body.heading, speed: 0 });

// The farthest he may stand at this angle: the sand circle, or through the gate's arc the wall line. Inside the arc at the circle's own
// radius the arc is measured at that radius, so a step that starts in the arc stays free to carry on toward the wall.
export const reachAt = (angle: number, r: number): number => (inGate(angle, Math.min(r, GATE_REACH)) ? GATE_REACH : RADIUS);

const allowed = (x: number, z: number) => { const r = Math.hypot(x, z); return r <= reachAt(Math.atan2(x, z), r) + 1e-9; };

export function walk(w: Walker, move: { x: number; z: number }, yaw: number, dt: number): Walker {
  const length = Math.hypot(move.x, move.z);
  if (!length || !Number.isFinite(length) || !Number.isFinite(yaw) || dt <= 0) return { ...w, speed: 0 };
  const scale = Math.min(1, length) / length;   // a full stick walks at WALK, a half stick at half
  const dx = (move.x * Math.cos(yaw) + move.z * Math.sin(yaw)) * scale, dz = (-move.x * Math.sin(yaw) + move.z * Math.cos(yaw)) * scale;
  let x = w.x + dx * WALK * dt, z = w.z + dz * WALK * dt;
  if (!allowed(x, z)) {
    if (Math.hypot(w.x, w.z) > RADIUS) {
      // In the passage (past the sand circle, so inside the arc) a step keeps only its part along the gate's axis: he walks in and out
      // parallel to the passage's sides, never sideways off it, where the circle would snap him back metres. A step that is still out
      // (the wall line, or the arc's rim, which is measured round the ring) stands him where he was.
      const ax = Math.sin(LAYOUT.gate), az = Math.cos(LAYOUT.gate), along = (x - w.x) * ax + (z - w.z) * az;
      x = w.x + ax * along; z = w.z + az * along;
      if (!allowed(x, z)) { x = w.x; z = w.z; }
    } else {   // on the sand he slides round the circle
      const r = Math.hypot(x, z), reach = reachAt(Math.atan2(x, z), r);
      x *= reach / r; z *= reach / r;
    }
  }
  const want = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(want - w.heading), Math.cos(want - w.heading));
  // Speed is what he actually covered, so a walk into the wall stands him still instead of treading on the spot.
  return { x, z, heading: w.heading + turn * Math.min(1, dt * TURN), speed: Math.hypot(x - w.x, z - w.z) / dt };
}

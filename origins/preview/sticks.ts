// Origins greybox: the two thumb sticks. LEFT walks (up/down) and strafes (left/right); pushed well past the rim it RUNS, the same deliberate
// push the Pit's pad uses (src/input.ts SPRINT_PUSH). RIGHT looks: left/right turns the hero, up/down tilts the camera. Pure: pad offsets in,
// one intent out; no DOM, clock or storage, so the mapping is tested without a browser.
export const STICK_R = 48;      // px of thumb travel that is one full push (the rim)
export const RUN_PUSH = 1.4;    // the rim is 1; past 1.4 the move stick runs (the Pit's SPRINT_PUSH)
export const DEAD = 0.12;       // a push shorter than this is a resting thumb
export type Pad = { x0: number; y0: number; x: number; y: number } | null;
export type Intent = { forward: number; strafe: number; turn: number; pitch: number; running: boolean };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// forward: +1 walk .. +2 run, -0.6 back; strafe: +right; turn: +left (heading grows left, as the keys' A); pitch: +up (camera looks up).
export function intent(move: Pad, look: Pad): Intent {
  let forward = 0, strafe = 0, turn = 0, pitch = 0, running = false;
  if (move) {
    const dx = (move.x - move.x0) / STICK_R, dy = (move.y0 - move.y) / STICK_R, len = Math.hypot(dx, dy);
    if (len >= DEAD) {
      const k = Math.max(1, len);
      running = len > RUN_PUSH && dy > 0;
      forward = clamp(dy / k, -0.6, 1) * (running ? 2 : 1);
      strafe = clamp(dx / k, -1, 1) * 0.7 * (running ? 2 : 1);
    }
  }
  if (look) {
    const dx = (look.x - look.x0) / STICK_R, dy = (look.y0 - look.y) / STICK_R;
    if (Math.hypot(dx, dy) >= DEAD) { turn = -clamp(dx, -1, 1); pitch = clamp(dy, -1, 1); }
  }
  return { forward, strafe, turn, pitch, running };
}

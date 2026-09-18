// The v8 strike circle reads intent, not the blade: a stroke's direction selects an authored attack; the simulation executes it.
// Diagonals resolve to the nearest axis (diagonal cuts are a later slice). Guard, step and kick keep their own controls.
export type Flick = 'left' | 'right' | 'up' | 'down';
export const FLICK_THRESHOLD = 28;
export function swipeAction(dx: number, dy: number): Flick | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.max(Math.abs(dx), Math.abs(dy)) < FLICK_THRESHOLD) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
}

// Deliberately no tap/hold ambiguity: guard/parry keeps its immediate dedicated control.
// Horizontal strokes choose the cut's side; the simulation owns what a side means.
export function swipeAction(dx: number, dy: number): 'light_left' | 'light_right' | 'heavy' | 'dodge' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.max(Math.abs(dx),Math.abs(dy)) < 28) return null;
  if (Math.abs(dx) > Math.abs(dy)*1.25) return dx < 0 ? 'light_left' : 'light_right';
  if (Math.abs(dy) > Math.abs(dx)*1.25) return dy < 0 ? 'heavy' : 'dodge';
  return null;
}

// Deliberately no tap/hold ambiguity: guard/parry keeps its immediate dedicated control.
export function swipeAction(dx: number, dy: number): 'light' | 'heavy' | 'dodge' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.max(Math.abs(dx),Math.abs(dy)) < 28) return null;
  if (Math.abs(dx) > Math.abs(dy)*1.25) return 'light';
  if (Math.abs(dy) > Math.abs(dx)*1.25) return dy < 0 ? 'heavy' : 'dodge';
  return null;
}

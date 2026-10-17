// Which tier each remote hero is drawn in (pure, no THREE): the nearest `full` keep the full skinned figure, the next `mid` take the middle tier (Characters' merged far LOD), the rest are the
// impostor (one instanced billboard per figure, remote-impostor.ts), and anything past `range` metres is not drawn at all. Nearest first, ties by id, so a figure never flips tier between two
// frames of the same positions. The numbers are rows (remote-impostor-defs.json); remote-heroes.ts reads them and calls this each frame.
export type TierIn = { readonly id: number; readonly x: number; readonly z: number };
export type Tiers = { full: number[]; mid: number[]; far: number[]; dropped: number[] };
export function assignTiers(list: readonly TierIn[], hero: { x: number; z: number }, o: { full: number; mid: number; range: number }): Tiers {
  const near = list.map((f) => ({ id: f.id, d: Math.hypot(f.x - hero.x, f.z - hero.z) })).sort((a, b) => a.d - b.d || a.id - b.id), out: Tiers = { full: [], mid: [], far: [], dropped: [] };
  for (const f of near) {
    if (f.d > o.range) out.dropped.push(f.id);
    else if (out.full.length < o.full) out.full.push(f.id);
    else if (out.mid.length < o.mid) out.mid.push(f.id);
    else out.far.push(f.id);
  }
  return out;
}

/** Which of `cells` baked views of a figure faces the camera: the angle between where the figure faces and where the camera sees it from, in turns, rounded to the nearest cell (cell 0 = seen from the front). */
export function viewCell(heading: number, camYaw: number, cells: number): number {
  const TAU = Math.PI * 2, turn = ((((camYaw - heading) % TAU) + TAU) % TAU) / TAU;
  return Math.round(turn * cells) % cells;
}

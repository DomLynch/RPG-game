// Measures a Pit layout (a zone plan, origins/zones/plan-rows.json) the way the hero walks it: a flood fill over the walkable pieces' tops from the start mark, a cell reachable from a neighbour when the height between them differs by less than the climb step.
// Reports what Dom's layout test needs: how many square metres of each level the hero can reach, the steepest slope he walks, the biggest step, and where the levels are. Pure; used by tests/pit-layouts.test.ts and scripts/pit-layout-measure.mjs.
import { planFor, walkHeight, type Piece } from '../../origins/zones/plan.ts';

export type Measure = { zone: string; reachable: number; area: Record<string, number>; maxSlopeDeg: number; maxStepM: number; levels: number[]; floorReached: boolean; duelReached: boolean; yardArea: number };

const CELL = 0.25;   // metres per grid cell

/** `slope`: the steepest rise per metre the hero may walk (the layoutSlope rule); between two neighbouring cells that is slope x CELL. */
export function measureLayout(zone: string, slope: number, duel: { x: number; z: number }, extent = 70): Measure {
  const stepM = slope * CELL;
  const plan = planFor(zone, () => 0)!, pieces: readonly Piece[] = plan.pieces, start = plan.marks!.start!;
  const key = (i: number, j: number) => `${i},${j}`, seen = new Map<string, number>(), queue: [number, number, number][] = [];
  const cell = (i: number, j: number) => walkHeight(pieces, i * CELL, j * CELL);
  const si = Math.round(start.x / CELL), sj = Math.round(start.z / CELL), h0 = cell(si, sj);
  if (h0 === null) throw new Error(`${zone}: the start mark is not on a walkable piece`);
  seen.set(key(si, sj), h0); queue.push([si, sj, h0]);
  let maxSlope = 0, maxStep = 0;
  const lim = Math.round(extent / CELL);
  while (queue.length) {
    const [i, j, h] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj; if (Math.abs(ni) > lim || Math.abs(nj) > lim || seen.has(key(ni, nj))) continue;
      const nh = cell(ni, nj); if (nh === null) continue;
      const dh = Math.abs(nh - h); if (dh > stepM) continue;
      maxStep = Math.max(maxStep, dh); maxSlope = Math.max(maxSlope, (Math.atan(dh / CELL) * 180) / Math.PI);
      seen.set(key(ni, nj), nh); queue.push([ni, nj, nh]);
    }
  }
  const area: Record<string, number> = {}; let floorReached = false, duelReached = false, yardArea = 0;
  const heights = new Set<number>();
  for (const [k, h] of seen) {
    const [i, j] = k.split(',').map(Number) as [number, number], x = i * CELL, z = j * CELL, level = Math.round(h * 2) / 2;
    heights.add(level); area[`${level}`] = (area[`${level}`] ?? 0) + CELL * CELL;
    if (Math.hypot(x, z) < 2 && h < -4) floorReached = true;
    if (Math.hypot(x - duel.x, z - duel.z) < 3 && h < -2) duelReached = true;
    if (h > -0.05 && z > 20) yardArea += CELL * CELL;
  }
  const rounded = Object.fromEntries(Object.entries(area).map(([k, v]) => [k, Math.round(v)]));
  return { zone, reachable: Math.round(seen.size * CELL * CELL), area: rounded, maxSlopeDeg: Math.round(maxSlope * 10) / 10, maxStepM: Math.round(maxStep * 100) / 100, levels: [...heights].sort((a, b) => b - a), floorReached, duelReached, yardArea: Math.round(yardArea) };
}

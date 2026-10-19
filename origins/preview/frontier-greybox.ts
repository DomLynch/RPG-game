// The Ash Frontier greybox's DRAWING (Web; Lead's split 2026-10-18): the boxes, cylinders, tints and board faces that dress the plan, every number here being how a piece LOOKS (heights, thicknesses, eaves, the sign
// board, soot, palettes, rock-skirt depths). It owns no collision: it is never handed `solids`, decides nothing about where a player may stand or what is in view, and keeps no copy of a footprint or of any solid,
// gate-post or house-ring number: frontier-plan.ts computes every position and size that sets a solid from its rows (frontier-plan-defs.json) and hands them in (tests/frontier-greybox.test.ts guards this).
// Pieces are written through the `put` the plan gives, in the order the plan walks, so the build is byte-identical to the one the plan used to draw itself. Pure: no three.js, no DOM.
import { toWorld } from '../world/derive.ts';
import { stageRule } from '../world/stage-rules.ts';
import type { Figure, Layer, Shape, Tint } from './exchange-plan.ts';
import { off } from './frontier-geom.ts';
import type { At, Board, Sign, ZonePlan } from './frontier-plan.ts';

export type Put = (layer: Layer, shape: Shape, x: number, y: number, z: number, tint: Tint, rotY?: number, foot?: number) => void;
type Pt = { x: number; z: number };

const ASH: Tint = [0.5, 0.47, 0.44], DARK: Tint = [0.62, 0.6, 0.57], SAND: Tint = [1.05, 1, 0.92], TIMBER: Tint = [0.42, 0.3, 0.2], SOOT: Tint = [0.1, 0.09, 0.08];
const GROUND: Record<string, Tint> = { ash: ASH, paving: [0.86, 0.83, 0.78], sand: [0.95, 0.82, 0.62] };
const CLOTH = ['#5a4a3a', '#3a3a44', '#6e5a40', '#4a2a24', '#2e3640'];
// A building per landmark kind (by the name's last word): its height and tint. Its footprint (width, depth) is NOT here: it sets the solid's radius, so it is a row the plan hands in.
const LOOK: Record<string, [number, Tint]> = {
  hall: [6, DARK], forge: [4, DARK], jail: [3.5, [0.4, 0.38, 0.36]], healer: [4.2, SAND], fence: [1.1, TIMBER],
  house: [4.5, SAND], boathouse: [4, TIMBER], watchtower: [12, DARK], crypt: [3, [0.35, 0.33, 0.32]],
};
/** The building kinds the greybox can dress (the plan's footprint rows must name exactly these). */
export const blockKinds = (): string[] => Object.keys(LOOK);

/** The west road: a paved causeway from the Exchange's west gate, kerbed, on a skirt of rock. `mid` and `len` are the road's middle and length. */
export function drawRoad(put: Put, r: { width: number; facing: number }, len: number, mid: Pt): void {
  put('stone', ['box', r.width + 1, 0.4, len + 1], mid.x, -0.2, mid.z, GROUND.paving!, r.facing);
  put('stone', ['box', r.width + 2, 14, len], mid.x, -7.4, mid.z, DARK, r.facing, -14);
  for (const side of [-1, 1]) { const k = off(mid, r.facing, 0, side * (r.width / 2 + 0.4)); put('stone', ['box', 0.4, 0.8, len], k.x, 0.4, k.z, SAND, r.facing, 0); }
}
/** A zone's ground: its footprint, a hair lower per zone (`i`) so overlapping footprints do not fight, on a skirt of rock; hills dip the plane and its skirt by the zone's relief (frontier-relief.ts draws the ground itself). */
export function drawGround(put: Put, z: ZonePlan, i: number): void {
  const centre = toWorld({ x: 0, d: z.depth / 2 }, z.mount), top = -0.004 * i, drop = z.relief.relief;
  put('stone', ['box', z.width, 0.4, z.depth], centre.x, top - 0.2 - drop, centre.z, GROUND[z.ground] ?? ASH, z.mount.heading);
  put('stone', ['box', z.width + 1, 12, z.depth + 1], centre.x, top - 6.4 - drop, centre.z, DARK, z.mount.heading, top - 12 - drop);
}
/** One gate post of a way on, at `p`. */
export function drawGatePost(put: Put, p: Pt, facing: number): void { put('stone', ['box', 0.6, 3, 0.6], p.x, 1.5, p.z, DARK, facing, 0); }
/** A building of `kind` on the landmark `a`: body, eaves and a soot strip. `c` is its centre and (w, d) its footprint, all from the plan's rows. */
export function drawBlock(put: Put, a: At, kind: string, c: Pt, w: number, d: number): void {
  const [h, tint] = LOOK[kind]!;
  put('stone', ['box', w, h, d], c.x, h / 2, c.z, tint, a.facing, 0);
  put('stone', ['box', w + 0.6, 0.35, d + 0.6], c.x, h + 0.17, c.z, TIMBER, a.facing); // eaves
  if (w > 2) put('soot', ['box', Math.min(stageRule('sootWidthMax'), w / 3), Math.min(stageRule('sootHeightMax'), h - 0.5), 0.12], off(a, a.facing, 0.02).x, Math.min(stageRule('sootCenterMax'), (h - 0.5) / 2), off(a, a.facing, 0.02).z, SOOT, a.facing);
}
/** The town centre's well-head. */
export function drawCentre(put: Put, a: At): void { put('stone', ['cylinder', 1.2, 1.3, 0.8, 16], a.x, 0.4, a.z, DARK, 0, 0); }
export function drawMilestone(put: Put, a: At): void { put('stone', ['box', 0.5, 1.4, 0.35], a.x, 0.7, a.z, SAND, a.facing, 0); }
export function drawShrine(put: Put, a: At): void {
  put('stone', ['cylinder', 3, 3.2, 0.5, 20], a.x, 0.25, a.z, DARK, 0, 0);
  put('stone', ['box', 1.6, 2.8, 1.2], a.x, 1.9, a.z, [0.42, 0.4, 0.4], a.facing, 0.5);
}
/** A scorched patch: the pits (smaller) or the hollow. */
export function drawScorch(put: Put, a: At, pits: boolean): void { put('soot', ['cylinder', pits ? 6 : 10, pits ? 6 : 10, 0.06, 24], a.x, 0.03, a.z, SOOT); }
export function drawDock(put: Put, a: At): void { const c = off(a, a.facing, 3); put('stone', ['box', 3.5, 0.3, 7], c.x, 0.15, c.z, TIMBER, a.facing, 0); }
/** A bank of reeds / stakes. */
export function drawBank(put: Put, a: At): void {
  for (let j = 0; j < 14; j++) { const p = off(a, a.facing, (j % 4) * 1.3 - 2, Math.floor(j / 4) * 1.4 - 2); put('stone', ['box', 0.08, 1.6 + (j % 3) * 0.3, 0.08], p.x, 0.9, p.z, [0.5, 0.48, 0.3], 0, 0); }
}
/** One post of the ruin's gate, at `p`, and its lintel across the way. */
export function drawRuinPost(put: Put, p: Pt, facing: number): void { put('stone', ['box', 1, 4.5, 1], p.x, 2.25, p.z, DARK, facing, 0); }
export function drawLintel(put: Put, a: At): void { put('stone', ['box', 6.4, 0.9, 1.2], a.x, 4.9, a.z, DARK, a.facing); }
export function drawCairn(put: Put, a: At): void { put('stone', ['box', 0.8, 1, 0.8], a.x, 0.5, a.z, DARK, a.facing, 0); }
/** The town's name on a board at its centre (both faces) and the post it stands on. */
export function townBoards(c: Pt, name: string): Board[] { return [{ x: c.x, y: 2.6, z: c.z + 0.01, facing: 0, lines: [name] }, { x: c.x, y: 2.6, z: c.z - 0.01, facing: Math.PI, lines: [name] }]; }
export function drawTownPost(put: Put, c: Pt): void { put('soot', ['box', 0.14, 2.2, 0.14], c.x, 1.9, c.z, SOOT, 0, 0.8); }
/** The people about a town's centre; `i` is the zone's index (it rotates their cloth). */
export function townPeople(c: Pt, i: number): Figure[] {
  const people: Figure[] = [];
  for (let j = 0; j < 4; j++) { const p = off(c, j * 1.7, 4 + j); people.push({ x: p.x, z: p.z, color: CLOTH[(i + j) % CLOTH.length]! }); }
  return people;
}
/** A signpost: a post 2 m in from the link and 2.6 m to its right as you walk out, its board toward whoever walks up to it. Returns the board's face. */
export function drawSignpost(put: Put, s: Sign): Board {
  const face = s.at.facing + Math.PI, p = off(s.at, s.at.facing, -2, -2.6);
  put('soot', ['box', 0.14, 2.6, 0.14], p.x, 1.3, p.z, SOOT, face, 0);
  put('stone', ['box', 1.9, 0.18 + 0.32 * s.lines.length, 0.08], p.x, 2.25, p.z, TIMBER, face);
  const front = off(p, face, 0.05);
  return { x: front.x, y: 2.25, z: front.z, facing: face, lines: s.lines };
}

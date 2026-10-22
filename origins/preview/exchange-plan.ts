// The Concord Exchange greybox as a plan: every placed piece of the walk out (the passage behind the Pit's gate, the plaza, the stoas,
// the Covenant Stone, the bank's front, the smithy, braziers, stalls and standing figures) as plain data, with no three.js in it.
// exchange.ts turns a plan into meshes; the plan itself is ROWS (exchange-rows.json, read by exchange-rows.ts; World, Lead's ruling 2026-10-22), pinned to the greybox as it stood before it read the world data (exchange.test.ts)
// and to the frozen code that built it (tests/exchange-rows.test.ts).
//
// Where things stand comes from the world data (origins/world/concord.ts through concordMounts and place): the gladiator gate's
// passage, the Exchange's outer gate, the Covenant Stone, the contract board, the forge and the bank. Everything else is metres of
// greybox massing measured from those anchors (a column's spacing, a step's rise), which is what a greybox is: rows that follow the anchors.
import { stageRule } from '../world/stage-rules.ts';
import { previewRule } from './preview-rules.ts';
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { place, toMetres, toWorld } from '../world/derive.ts';
import { resolveZone, type WorldData } from '../world/resolve.ts';
import { planFromRows } from './exchange-rows.ts';

export type Tint = [number, number, number];
export type Shape =
  | ['box', number, number, number] // width, height, depth
  | ['cylinder', number, number, number, number] // radius top, radius bottom, height, radial segments
  | ['cone', number, number, number] // radius, height, radial segments
  | ['sphere', number, number, number] // radius, width segments, height segments
  | ['pediment', number, number, number]; // base width, height, depth: a triangle extruded and centred on its depth
export type Layer = 'stone' | 'paving' | 'iron' | 'soot' | 'coal' | 'plain';   // 'paving' = the plaza deck and its joint slabs: stone to the eye, its own mesh so a look can grade ground and masonry apart
// One placed piece: world position, a turn about y, a tint darkened toward `foot` (exchange.ts piece()).
export type Piece = { layer: Layer; shape: Shape; x: number; y: number; z: number; tint: Tint; rotY: number; foot: number };
export type Figure = { x: number; z: number; color: string };
export type Plan = {
  pieces: Piece[];
  awnings: (Figure & { y: number })[];
  people: Figure[];
  frieze: { x: number; y: number; z: number; text: string };
  braziers: { x: number; z: number }[];
  hearth: { x: number; y: number; z: number };
};

// The world-data anchors of the walk out, in world metres (the Pit's centre at the origin, the gate toward −z).
export type Anchors = {
  passage: { halfWidth: number; from: number; to: number }; // the gladiator gate's tunnel, its z from and to
  gate: { x: number; z: number }; // the Exchange's outer gate: where the plaza begins
  halfWidth: number; // half the Exchange zone's width
  stone: { x: number; z: number };
  board: { x: number; z: number };
  forge: { x: number; z: number };
  bank: { x: number; z: number }; // the foot of the bank's lowest step
};

export function exchangeAnchors(data: WorldData = CONCORD): Anchors {
  const mounts = concordMounts(data), pit = resolveZone(data, CONCORD_REGION, 'pit-yard'), ex = resolveZone(data, CONCORD_REGION, 'exchange');
  if (!mounts.ok || !pit.ok || !ex.ok) throw new Error(`the Exchange world data does not resolve: ${JSON.stringify([mounts, pit, ex].flatMap((r) => (r.ok ? [] : r.issues)))}`);
  const at = (name: string) => {
    const p = place(ex.value, name);
    if (!p.ok) throw new Error(`the Exchange has no landmark ${name}`);
    return toWorld(p.value, mounts.value.exchange);
  };
  const passage = toMetres(pit.value).passages['gladiator-gate']!, from = toWorld(passage.from, mounts.value.pit), to = toWorld(passage.to, mounts.value.pit);
  return {
    passage: { halfWidth: passage.width / 2, from: from.z, to: to.z },
    gate: at('outer-gate'), halfWidth: toMetres(ex.value).width / 2,
    stone: at('covenant-stone'), board: at('contract-board'), forge: at('forge'), bank: at('bank'),
  };
}

// ?region=1 only: open the left stoa's back wall and the balustrade behind it where the west road leaves (a gap `half` either side of
// `z`); the doorway that stood there goes. Pieces wholly inside the colonnade or the plaza are not touched. Without it the plan is today's.
export function openWest(plan: Plan, a: Anchors, z: number, half: number): Plan {
  const wall = a.gate.x - (a.halfWidth - KERB_INSET) - 1, lo = z - half, hi = z + half, pieces: Piece[] = [];
  for (const p of plan.pieces) {
    const depth = p.shape[0] === 'box' ? p.shape[3] : 0, from = p.z - depth / 2, to = p.z + depth / 2;
    if (p.x > wall || p.shape[0] !== 'box' || to <= lo || from >= hi) { pieces.push(p); continue; }
    if (depth < half * 2) continue; // a doorway in the gap
    const [, w, h] = p.shape;
    if (from < lo) pieces.push({ ...p, shape: ['box', w, h, lo - from], z: (from + lo) / 2 });
    if (to > hi) pieces.push({ ...p, shape: ['box', w, h, to - hi], z: (hi + to) / 2 });
  }
  return { ...plan, pieces };
}

// Greybox sizes: not world data, the massing's own measurements.
export const KERB_INSET = stageRule('kerbInset'); // the paved field stops this far inside the zone's edge; the stoas' back walls stand in the gap
export const STONE_RADIUS = stageRule('stoneRadius');
export const FORGE_HALF = { x: previewRule('forgeHalfX'), z: previewRule('forgeHalfZ') };   // m: the smithy's half footprint (preview-rules rows)

/** The plan for these anchors, built from the rows (exchange-rows.json); the four rule values above are what the rows' shapes were measured from. */
export const exchangePlan = (a: Anchors = exchangeAnchors()): Plan => planFromRows(a, { kerb: KERB_INSET, stone: STONE_RADIUS, forgeX: FORGE_HALF.x, forgeZ: FORGE_HALF.z });

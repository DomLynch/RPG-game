// The Concord Exchange greybox as a plan: every placed piece of the walk out (the passage behind the Pit's gate, the plaza, the stoas,
// the Covenant Stone, the bank's front, the smithy, braziers, stalls and standing figures) as plain data, with no three.js in it.
// exchange.ts turns a plan into meshes; exchange.test.ts pins the plan to the greybox as it stood before it read the world data.
//
// Where things stand comes from the world data (origins/world/concord.ts through concordMounts and place): the gladiator gate's
// passage, the Exchange's outer gate, the Covenant Stone, the contract board, the forge and the bank. Everything else is metres of
// greybox massing measured from those anchors (a column's spacing, a step's rise), which is what a greybox is.
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { place, toMetres, toWorld } from '../world/derive.ts';
import { resolveZone, type WorldData } from '../world/resolve.ts';

export type Tint = [number, number, number];
export type Shape =
  | ['box', number, number, number] // width, height, depth
  | ['cylinder', number, number, number, number] // radius top, radius bottom, height, radial segments
  | ['cone', number, number, number] // radius, height, radial segments
  | ['sphere', number, number, number] // radius, width segments, height segments
  | ['pediment', number, number, number]; // base width, height, depth: a triangle extruded and centred on its depth
export type Layer = 'stone' | 'iron' | 'soot' | 'coal';
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

// Greybox sizes: not world data, the massing's own measurements.
export const KERB_INSET = 4; // the paved field stops this far inside the zone's edge; the stoas' back walls stand in the gap
export const STONE_RADIUS = 2.6;
export const FORGE_HALF = { x: 2.2, z: 2.6 };

const SANDSTONE: Tint = [1.05, 1, 0.92], DARKSTONE: Tint = [0.62, 0.6, 0.57], PAVING: Tint = [0.86, 0.83, 0.78], SOOT: Tint = [0.1, 0.09, 0.08];
const TIMBER: Tint = [0.42, 0.3, 0.2], WHITE: Tint = [1, 1, 1];

export function exchangePlan(a: Anchors = exchangeAnchors()): Plan {
  const pieces: Piece[] = [];
  const put = (layer: Layer, shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0, foot = y - 10) => { pieces.push({ layer, shape, x, y, z, tint, rotY, foot }); };
  const box = (w: number, h: number, d: number): Shape => ['box', w, h, d];
  const column = (r: number, h: number): Shape => ['cylinder', r * 0.88, r, h, 14];
  const fluteColumn = (x: number, z: number, h: number, r: number, base = 0) => {
    put('stone', box(r * 2.6, 0.35, r * 2.6), x, base + 0.175, z, DARKSTONE, 0, base);
    put('stone', column(r, h - 0.8), x, base + 0.35 + (h - 0.8) / 2, z, SANDSTONE, 0, base);
    put('stone', box(r * 2.8, 0.45, r * 2.8), x, base + h - 0.225, z, SANDSTONE, 0, base);
  };
  const P = a.passage, cx = a.gate.x, near = a.gate.z, far = a.bank.z + 0.5, half = a.halfWidth - KERB_INSET;

  // The passage: the gate's dark tunnel carried on under the stands and out through the parapet; a vault of slabs, lit only at its mouth.
  const len = P.from - P.to, mid = (P.from + P.to) / 2;
  for (const side of [-1, 1]) put('stone', box(0.7, 3.2, len), side * (P.halfWidth + 0.35), 1.6, mid, DARKSTONE, 0, 0);
  put('stone', box(P.halfWidth * 2 + 1.4, 0.5, len), 0, 3.45, mid, DARKSTONE);
  put('stone', box(P.halfWidth * 2, 0.1, len), 0, -0.05, mid, SOOT);
  // The outer gate's arch on the plaza side: posts, lintel and a heavy keystone, proud of the parapet.
  for (const side of [-1, 1]) put('stone', box(1.1, 4.4, 1.4), side * (P.halfWidth + 0.55), 2.2, P.to - 0.2, SANDSTONE, 0, 0);
  put('stone', box(P.halfWidth * 2 + 2.6, 0.9, 1.6), 0, 4.85, P.to - 0.2, SANDSTONE);
  put('stone', box(1, 1.2, 1.7), 0, 5.2, P.to - 0.25, SANDSTONE);
  put('iron', box(P.halfWidth * 2 + 0.1, 0.12, 0.12), 0, 3.15, P.to + 0.2, SOOT); // the raised portcullis' bottom bar, parked in the slot

  // The plaza: a paved terrace on the island's rock, its kerb and a skirt of rock falling away under it (Arena 1 floats over the abyss).
  const depth = near - far + 6, cz = (near + far) / 2 - 2;
  put('stone', box(half * 2 + 8, 0.4, depth), cx, -0.2, cz, PAVING);
  for (let i = 0; i < 18; i++) { // flagstone joints: a few darker slabs break the field so scale reads
    const x = cx + ((i * 7.31) % 28) - 14, z = near - 3 - ((i * 11.7) % 36);
    put('stone', box(1.8 + (i % 3) * 0.5, 0.02, 1.2 + (i % 2) * 0.6), x, 0.01, z, DARKSTONE);
  }
  put('stone', box(half * 2 + 9, 26, depth + 1), cx, -13.4, cz, DARKSTONE, 0, -26);
  for (const side of [-1, 1]) put('stone', box(0.6, 1.1, depth - 4), cx + side * (half + 3.6), 0.55, cz, SANDSTONE, 0, 0); // balustrade over the drop

  // The two stoas: deep colonnades either side where the vaults, the contract board and the counters will live.
  for (const side of [-1, 1]) {
    const x = cx + side * (half - 1.5), back = cx + side * (half + 3), from = near - 6, to = far + 6;
    for (let z = from; z >= to; z -= 4) fluteColumn(x, z, 5.2, 0.32);
    put('stone', box(5.4, 0.7, from - to + 2), (x + back) / 2, 5.55, (from + to) / 2, SANDSTONE);
    put('stone', box(0.8, 5.2, from - to + 2), back, 2.6, (from + to) / 2, DARKSTONE, 0, 0);
    for (let z = from - 2; z > to; z -= 8) put('soot', box(0.1, 2.6, 1.6), back - side * 0.42, 1.3, z, SOOT); // doorways into the back rooms
  }
  // The contract board, under the left stoa: a timber frame and pinned notices.
  const N = a.board;
  put('stone', box(0.25, 2.6, 0.25), N.x, 1.3, N.z + 1.4, SOOT);
  put('stone', box(0.25, 2.6, 0.25), N.x, 1.3, N.z - 1.4, SOOT);
  put('stone', box(0.14, 1.5, 3.1), N.x, 1.75, N.z, [0.5, 0.36, 0.24]);
  for (let i = 0; i < 9; i++) put('stone', box(0.02, 0.36, 0.28), N.x + 0.1, 1.3 + (i % 3) * 0.45, N.z + 1 - Math.floor(i / 3) * 0.95 + (i % 2) * 0.12, [1.5, 1.42, 1.25]);

  // The Covenant Stone at the centre: why rivals may meet here without blades. A stepped round plinth and a tall dark stele.
  const S = a.stone, R = STONE_RADIUS;
  put('stone', ['cylinder', R, R + 0.2, 0.4, 24], S.x, 0.2, S.z, DARKSTONE, 0, 0);
  put('stone', ['cylinder', R - 0.7, R - 0.6, 0.4, 24], S.x, 0.6, S.z, DARKSTONE, 0, 0);
  put('stone', box(1.1, 6.2, 0.7), S.x, 3.9, S.z, [0.42, 0.4, 0.4], 0, 0.8);
  put('stone', ['cone', 0.62, 0.9, 4], S.x, 7.45, S.z, [0.42, 0.4, 0.4], Math.PI / 4);

  // The bank's front: a podium of steps, eight columns, the entablature and pediment, the great iron doors.
  const B = a.bank.z, bx = a.bank.x, W = 26;
  for (let i = 0; i < 4; i++) { const h = 0.3 * (i + 1), d = 12 - i * 0.9; put('stone', box(W - i * 1.2, h, d), bx, h / 2, B - i * 0.9 - d / 2, SANDSTONE, 0, 0); } // front edge steps back 0.9 m a riser
  const deck = 1.2, front = B - 3.2;
  for (let i = 0; i < 8; i++) fluteColumn(bx - 10.5 + i * 3, front, 9, 0.55, deck);
  put('stone', box(W - 1, 1.5, 2.2), bx, deck + 9 + 0.75, front, SANDSTONE);
  put('stone', box(W, 0.4, 2.6), bx, deck + 10.7, front, SANDSTONE);
  put('stone', ['pediment', W, 3.4, 2.2], bx, deck + 10.9, front, SANDSTONE);
  put('stone', box(W - 2, 12.5, 6), bx, deck + 6.25, front - 5.2, DARKSTONE, 0, deck); // the hall behind the portico
  put('soot', box(4.6, 6.2, 0.3), bx, deck + 3.1, front - 2.1, SOOT); // the doorway's depth
  for (const side of [-1, 1]) put('iron', box(2.1, 5.8, 0.18), bx + side * 1.1, deck + 2.9, front - 1.85, [1.6, 1.2, 0.75]); // bronze-faced iron leaves
  for (let i = 0; i < 24; i++) put('iron', ['sphere', 0.07, 6, 4], bx + (i % 2 ? 1 : -1) * (0.4 + (i % 4 < 2 ? 0 : 1.3)), deck + 0.8 + Math.floor(i / 4) * 0.9, front - 1.74, [2.2, 1.6, 0.9]);

  // The blacksmith: an open-fronted smithy beside the bank, its mouth to the plaza. Back and side walls, a timber roof, a tall chimney,
  // the hearth's coals, an anvil and a quench trough; a hanging sign. Greybox massing only.
  const F = { ...a.forge, halfX: FORGE_HALF.x, halfZ: FORGE_HALF.z };
  put('stone', box(0.6, 4, F.halfZ * 2), F.x - F.halfX, 2, F.z, DARKSTONE, 0, 0);
  for (const side of [-1, 1]) put('stone', box(F.halfX * 2, 4, 0.5), F.x, 2, F.z + side * F.halfZ, DARKSTONE, 0, 0);
  put('stone', box(F.halfX * 2 + 1.2, 0.3, F.halfZ * 2 + 0.8), F.x + 0.3, 4.15, F.z, TIMBER);
  put('stone', box(1.3, 7.5, 1.3), F.x - F.halfX + 0.5, 3.75, F.z - 1.2, DARKSTONE, 0, 0);
  put('stone', box(1.6, 0.9, 1.6), F.x - F.halfX + 1.1, 0.45, F.z - 1.2, DARKSTONE, 0, 0);
  put('iron', box(0.9, 0.5, 0.35), F.x + 0.4, 0.75, F.z + 0.3, SOOT);
  put('iron', box(0.4, 0.5, 0.3), F.x + 0.4, 0.25, F.z + 0.3, SOOT);
  put('stone', box(0.6, 0.55, 1.6), F.x + 0.6, 0.28, F.z + 1.7, TIMBER, 0, 0);
  put('stone', box(0.12, 0.9, 1.8), F.x + F.halfX + 0.7, 3.2, F.z - F.halfZ - 0.4, TIMBER);
  // Braziers: the light language of the Pit carried out here (coal glow; the flames are the arena's own flicker in main.ts).
  const braziers = [{ x: bx - 4, z: B - 1.2 }, { x: bx + 4, z: B - 1.2 }, { x: -3.4, z: P.to - 2 }, { x: 3.4, z: P.to - 2 }, { x: S.x - 4.2, z: S.z }, { x: S.x + 4.2, z: S.z }];
  put('coal', box(1.3, 0.08, 1.3), F.x - F.halfX + 1.1, 0.94, F.z - 1.2, WHITE);
  for (const b of braziers) {
    put('iron', ['cylinder', 0.08, 0.14, 1.2, 8], b.x, 0.6, b.z, SOOT, 0, 0);
    put('iron', ['cylinder', 0.5, 0.28, 0.35, 12], b.x, 1.3, b.z, [0.6, 0.5, 0.4]);
    put('coal', ['cylinder', 0.42, 0.42, 0.06, 12], b.x, 1.46, b.z, WHITE);
  }

  // Market stalls under awnings, right of the stone; cloth in the Pit's muted dyes.
  const dyes = ['#6e2a20', '#7a5a26', '#2f3a4e', '#4e3a2a'], awnings: Plan['awnings'] = [];
  for (let i = 0; i < 4; i++) {
    const x = cx + 8.5, z = near - 6 - i * 6.5;
    put('stone', box(2.6, 1.0, 1.2), x, 0.5, z, [0.55, 0.42, 0.3], 0, 0);
    for (const dx of [-1.25, 1.25]) for (const dz of [-0.8, 0.8]) put('stone', box(0.1, 2.3, 0.1), x + dx, 1.15, z + dz, [0.45, 0.33, 0.22], 0, 0);
    awnings.push({ x, y: 2.35, z, color: dyes[i]! });
  }

  // Envoys and traders standing about (scale figures only: 1.8 m capsules in cloth tones), as (across, metres in from the outer gate).
  const people: [number, number, string][] = [[-2.5, 8, '#5a4a3a'], [-1.8, 8.8, '#3a3a44'], [5.2, 15, '#6e5a40'], [6, 15.6, '#4a2a24'], [-9.5, 11, '#2e3640'], [-10, 10.2, '#5a4a3a'],
    [-3.5, 27, '#4a2a24'], [-2.8, 27.8, '#7a6a50'], [6.5, 31, '#3a3a44'], [1.5, 36, '#5a4a3a'], [-6, 35, '#2e3640'], [10.5, 22, '#4e3a2a'], [11, 9, '#6e2a20'], [-13, 25, '#3a3a44']];

  return {
    pieces, awnings, braziers,
    people: people.map(([x, d, color]) => ({ x: cx + x, z: near - d, color })),
    frieze: { x: bx, y: deck + 9.75, z: front + 1.12, text: 'CONCORD  ·  EXCHANGE' },
    hearth: { x: F.x - F.halfX + 1.1, y: 1.3, z: F.z - 1.2 },
  };
}

// The Exchange greybox as it was built in CODE (origins/preview/exchange-plan.ts before the plan moved to rows, trunk 2bf101977), frozen here as the TEST ORACLE: tests/zone-plan.test.ts compares the row-built plan
// against this generator for the shipped anchors and for moved ones. The four rule values it read (kerb inset, stone radius, smithy half footprint) are parameters so the oracle can be moved too. Not used by the game.
import type { Anchors, Layer, Piece, Plan, Shape, Tint } from '../../origins/preview/exchange-plan.ts';

export type Knobs = { kerb: number; stone: number; forgeX: number; forgeZ: number };

const SANDSTONE: Tint = [1.05, 1, 0.92], DARKSTONE: Tint = [0.62, 0.6, 0.57], PAVING: Tint = [0.86, 0.83, 0.78], SOOT: Tint = [0.1, 0.09, 0.08];
const TIMBER: Tint = [0.42, 0.3, 0.2], WHITE: Tint = [1, 1, 1];

export function oraclePlan(a: Anchors, k: Knobs): Plan {
  const pieces: Piece[] = [];
  const put = (layer: Layer, shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0, foot = y - 10) => { pieces.push({ layer, shape, x, y, z, tint, rotY, foot }); };
  const box = (w: number, h: number, d: number): Shape => ['box', w, h, d];
  const column = (r: number, h: number): Shape => ['cylinder', r * 0.88, r, h, 14];
  const fluteColumn = (x: number, z: number, h: number, r: number, base = 0) => {
    put('stone', box(r * 2.6, 0.35, r * 2.6), x, base + 0.175, z, DARKSTONE, 0, base);
    put('stone', column(r, h - 0.8), x, base + 0.35 + (h - 0.8) / 2, z, SANDSTONE, 0, base);
    put('stone', box(r * 2.8, 0.45, r * 2.8), x, base + h - 0.225, z, SANDSTONE, 0, base);
  };
  const P = a.passage, cx = a.gate.x, near = a.gate.z, far = a.bank.z + 0.5, half = a.halfWidth - k.kerb;

  const len = P.from - P.to, mid = (P.from + P.to) / 2;
  for (const side of [-1, 1]) put('stone', box(0.7, 3.2, len), side * (P.halfWidth + 0.35), 1.6, mid, DARKSTONE, 0, 0);
  put('stone', box(P.halfWidth * 2 + 1.4, 0.5, len), 0, 3.45, mid, DARKSTONE);
  put('stone', box(P.halfWidth * 2, 0.1, len), 0, -0.05, mid, SOOT);
  for (const side of [-1, 1]) put('stone', box(1.1, 4.4, 1.4), side * (P.halfWidth + 0.55), 2.2, P.to - 0.2, SANDSTONE, 0, 0);
  put('stone', box(P.halfWidth * 2 + 2.6, 0.9, 1.6), 0, 4.85, P.to - 0.2, SANDSTONE);
  put('stone', box(1, 1.2, 1.7), 0, 5.2, P.to - 0.25, SANDSTONE);
  put('iron', box(P.halfWidth * 2 + 0.1, 0.12, 0.12), 0, 3.15, P.to + 0.2, SOOT);

  const depth = near - far + 6, cz = (near + far) / 2 - 2;
  put('paving', box(half * 2 + 8, 0.4, depth), cx, -0.2, cz, PAVING);
  for (let i = 0; i < 18; i++) {
    const x = cx + ((i * 7.31) % 28) - 14, z = near - 3 - ((i * 11.7) % 36);
    put('paving', box(1.8 + (i % 3) * 0.5, 0.02, 1.2 + (i % 2) * 0.6), x, 0.01, z, DARKSTONE);
  }
  put('stone', box(half * 2 + 9, 26, depth + 1), cx, -13.4, cz, DARKSTONE, 0, -26);
  for (const side of [-1, 1]) put('stone', box(0.6, 1.1, depth - 4), cx + side * (half + 3.6), 0.55, cz, SANDSTONE, 0, 0);

  for (const side of [-1, 1]) {
    const x = cx + side * (half - 1.5), back = cx + side * (half + 3), from = near - 6, to = far + 6;
    for (let z = from; z >= to; z -= 4) fluteColumn(x, z, 5.2, 0.32);
    put('stone', box(5.4, 0.7, from - to + 2), (x + back) / 2, 5.55, (from + to) / 2, SANDSTONE);
    put('stone', box(0.8, 5.2, from - to + 2), back, 2.6, (from + to) / 2, DARKSTONE, 0, 0);
    for (let z = from - 2; z > to; z -= 8) put('soot', box(0.1, 2.6, 1.6), back - side * 0.42, 1.3, z, SOOT);
  }
  const N = a.board;
  put('stone', box(0.25, 2.6, 0.25), N.x, 1.3, N.z + 1.4, SOOT);
  put('stone', box(0.25, 2.6, 0.25), N.x, 1.3, N.z - 1.4, SOOT);
  put('stone', box(0.14, 1.5, 3.1), N.x, 1.75, N.z, [0.5, 0.36, 0.24]);
  for (let i = 0; i < 9; i++) put('stone', box(0.02, 0.36, 0.28), N.x + 0.1, 1.3 + (i % 3) * 0.45, N.z + 1 - Math.floor(i / 3) * 0.95 + (i % 2) * 0.12, [1.5, 1.42, 1.25]);

  const S = a.stone, R = k.stone;
  put('stone', ['cylinder', R, R + 0.2, 0.4, 24], S.x, 0.2, S.z, DARKSTONE, 0, 0);
  put('stone', ['cylinder', R - 0.7, R - 0.6, 0.4, 24], S.x, 0.6, S.z, DARKSTONE, 0, 0);
  put('stone', box(1.1, 6.2, 0.7), S.x, 3.9, S.z, [0.42, 0.4, 0.4], 0, 0.8);
  put('stone', ['cone', 0.62, 0.9, 4], S.x, 7.45, S.z, [0.42, 0.4, 0.4], Math.PI / 4);

  const B = a.bank.z, bx = a.bank.x, W = 26;
  for (let i = 0; i < 4; i++) { const h = 0.3 * (i + 1), d = 12 - i * 0.9; put('stone', box(W - i * 1.2, h, d), bx, h / 2, B - i * 0.9 - d / 2, SANDSTONE, 0, 0); }
  const deck = 1.2, front = B - 3.2;
  for (let i = 0; i < 8; i++) fluteColumn(bx - 10.5 + i * 3, front, 9, 0.55, deck);
  put('stone', box(W - 1, 1.5, 2.2), bx, deck + 9 + 0.75, front, SANDSTONE);
  put('stone', box(W, 0.4, 2.6), bx, deck + 10.7, front, SANDSTONE);
  put('stone', ['pediment', W, 3.4, 2.2], bx, deck + 10.9, front, SANDSTONE);
  put('stone', box(W - 2, 12.5, 6), bx, deck + 6.25, front - 5.2, DARKSTONE, 0, deck);
  put('soot', box(4.6, 6.2, 0.3), bx, deck + 3.1, front - 2.1, SOOT);
  for (const side of [-1, 1]) put('iron', box(2.1, 5.8, 0.18), bx + side * 1.1, deck + 2.9, front - 1.85, [1.6, 1.2, 0.75]);
  for (let i = 0; i < 24; i++) put('iron', ['sphere', 0.07, 6, 4], bx + (i % 2 ? 1 : -1) * (0.4 + (i % 4 < 2 ? 0 : 1.3)), deck + 0.8 + Math.floor(i / 4) * 0.9, front - 1.74, [2.2, 1.6, 0.9]);

  const F = { ...a.forge, halfX: k.forgeX, halfZ: k.forgeZ };
  put('stone', box(0.6, 4, F.halfZ * 2), F.x - F.halfX, 2, F.z, DARKSTONE, 0, 0);
  for (const side of [-1, 1]) put('stone', box(F.halfX * 2, 4, 0.5), F.x, 2, F.z + side * F.halfZ, DARKSTONE, 0, 0);
  put('stone', box(F.halfX * 2 + 1.2, 0.3, F.halfZ * 2 + 0.8), F.x + 0.3, 4.15, F.z, TIMBER);
  put('stone', box(1.3, 7.5, 1.3), F.x - F.halfX + 0.5, 3.75, F.z - 1.2, DARKSTONE, 0, 0);
  put('stone', box(1.6, 0.9, 1.6), F.x - F.halfX + 1.1, 0.45, F.z - 1.2, DARKSTONE, 0, 0);
  put('iron', box(0.9, 0.5, 0.35), F.x + 0.4, 0.75, F.z + 0.3, SOOT);
  put('iron', box(0.4, 0.5, 0.3), F.x + 0.4, 0.25, F.z + 0.3, SOOT);
  put('stone', box(0.6, 0.55, 1.6), F.x + 0.6, 0.28, F.z + 1.7, TIMBER, 0, 0);
  put('stone', box(0.12, 0.9, 1.8), F.x + F.halfX + 0.7, 3.2, F.z - F.halfZ - 0.4, TIMBER);
  const braziers = [{ x: bx - 4, z: B - 1.2 }, { x: bx + 4, z: B - 1.2 }, { x: -3.4, z: P.to - 2 }, { x: 3.4, z: P.to - 2 }, { x: S.x - 4.2, z: S.z }, { x: S.x + 4.2, z: S.z }];
  put('coal', box(1.3, 0.08, 1.3), F.x - F.halfX + 1.1, 0.94, F.z - 1.2, WHITE);
  for (const b of braziers) {
    put('iron', ['cylinder', 0.08, 0.14, 1.2, 8], b.x, 0.6, b.z, SOOT, 0, 0);
    put('iron', ['cylinder', 0.5, 0.28, 0.35, 12], b.x, 1.3, b.z, [0.6, 0.5, 0.4]);
    put('coal', ['cylinder', 0.42, 0.42, 0.06, 12], b.x, 1.46, b.z, WHITE);
  }

  const dyes = ['#6e2a20', '#7a5a26', '#2f3a4e', '#4e3a2a'], awnings: Plan['awnings'] = [];
  for (let i = 0; i < 4; i++) {
    const x = cx + 8.5, z = near - 6 - i * 6.5;
    put('stone', box(2.6, 1.0, 1.2), x, 0.5, z, [0.55, 0.42, 0.3], 0, 0);
    for (const dx of [-1.25, 1.25]) for (const dz of [-0.8, 0.8]) put('stone', box(0.1, 2.3, 0.1), x + dx, 1.15, z + dz, [0.45, 0.33, 0.22], 0, 0);
    awnings.push({ x, y: 2.35, z, color: dyes[i]! });
  }

  const people: [number, number, string][] = [[-2.5, 8, '#5a4a3a'], [-1.8, 8.8, '#3a3a44'], [5.2, 15, '#6e5a40'], [6, 15.6, '#4a2a24'], [-9.5, 11, '#2e3640'], [-10, 10.2, '#5a4a3a'],
    [-3.5, 27, '#4a2a24'], [-2.8, 27.8, '#7a6a50'], [6.5, 31, '#3a3a44'], [1.5, 36, '#5a4a3a'], [-6, 35, '#2e3640'], [10.5, 22, '#4e3a2a'], [11, 9, '#6e2a20'], [-13, 25, '#3a3a44']];

  return {
    pieces, awnings, braziers,
    people: people.map(([x, d, color]) => ({ x: cx + x, z: near - d, color })),
    frieze: { x: bx, y: deck + 9.75, z: front + 1.12, text: 'CONCORD  ·  EXCHANGE' },
    hearth: { x: F.x - F.halfX + 1.1, y: 1.3, z: F.z - 1.2 },
  };
}

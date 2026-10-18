// The town generator (World lane, docs/TOP10.md town plan row 5): a town from a seed and a wealth number, laid out in OpenTTD-style rings round a centre.
//   ring 0  the plaza: the bank, the Pit board, the rankings board, a well/market stalls (the civic centre, always one of each)
//   ring 1  the shops (smith, general, apothecary, inn, ...): each a lot facing the plaza
//   ring 2  the houses
//   ring 3  the edge: stalls and the gate arches on the road, the outermost houses
// Wealth (0..1) is how grand the town is: more lots, wider rings, bigger buildings, more variants. Pure data (no three.js, no clock, no Math.random): same seed + wealth = the same town.
// Output is placement data keyed on the building kit's node names (TOP10 row 3: wall, corner, arch, roof, stall, counter, sign, chimney); Characters' kit file maps them to meshes.
// Donor: OpenTTD town growth (rings round a centre; study and rewrite, GPL) and 2004Scape's fixed civic NPC set; the circle-packing placement here is our own.
import { TOWN_DEFS, shopTrades, type LotKindRow, type TownDefs } from './town-defs.ts';
import { layoutRule } from './layout-rules.ts';
export const TOWN_NODES = ['wall', 'corner', 'arch', 'roof', 'stall', 'counter', 'sign', 'chimney'] as const;
export type TownNode = (typeof TOWN_NODES)[number];
export type LotKind = string;   // a key of the lot kind rows (origins/region1/towns.json definitions.lotKinds, town-defs.ts): a new kind is a row
export type Slot = 'door' | 'window' | 'plain';   // which kind of wall a `wall` piece is: the door in the front, windows, or plain
export type TownPiece = { node: TownNode; x: number; z: number; rotY: number; scale: number; variant: number; slot?: Slot };   // world metres, town-local (the centre is 0,0)
export type Lot = { id: string; kind: LotKind; ring: 0 | 1 | 2 | 3; x: number; z: number; rotY: number; w: number; d: number; r: number; trade?: string; pieces: TownPiece[] };
export type Town = { seed: string; wealth: number; lots: Lot[]; radius: number };

export const ROAD_HALF = layoutRule('roadHalf');  // metres either side of the z axis kept clear of stalls: the road runs through the gate arches
export const MODULE = layoutRule('buildingModule');  // metres: the building kit's wall module

// The seed hash's own numbers (mulberry32 over a string hash; changing any one changes every town, so they are the format, not tuning: exempt in scripts/as-data/allow/origins-world.json)
const HASH_SEED = 1779033703, HASH_MUL = 3432918353, HASH_ROT_LEFT = 13, HASH_ROT_RIGHT = 19, STEP = 0x6d2b79f5, MIX_A = 15, MIX_B = 7, MIX_OR = 61, MIX_C = 14, UINT32 = 4294967296;
const SEED_WEALTH_STEPS = 100;   // the wealth is keyed into the seed to a hundredth
const HALF = 0.5;   // the centre of a unit interval
const half = (n: number) => n / 2, turns = (n: number) => n * Math.PI * 2, radians = (deg: number) => deg * (Math.PI / 180);   // half; a count of full turns in radians; degrees to radians
const WINDOW_CHANCE = layoutRule('windowChance'), SIGN_OFFSET = layoutRule('signOffset'), COUNTER_INSET = layoutRule('counterInset'), COUNTER_DIVISOR = layoutRule('counterDivisor');
const CHIMNEY_DIVISOR = layoutRule('chimneyDivisor'), ROOF_DIVISOR = layoutRule('roofDivisor'), PIECE_VARIANTS = layoutRule('pieceVariants'), PLAZA_BASE = layoutRule('plazaBase'), PLAZA_SPAN = layoutRule('plazaSpan');
const CIVIC_CENTRES = layoutRule('civicCentres'), TURN_BASE = layoutRule('turnBase'), TURN_SPAN = layoutRule('turnSpan'), RING_TRIES = layoutRule('ringTries'), RING_SPREAD = layoutRule('ringSpread');
const RING_JITTER = layoutRule('ringJitter'), TOWN_RADIUS_PAD = layoutRule('townRadiusPad');

const rng = (seed: string) => {
  let h = HASH_SEED ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), HASH_MUL); h = (h << HASH_ROT_LEFT) | (h >>> HASH_ROT_RIGHT); }
  let a = h >>> 0;
  return () => { a = (a + STEP) >>> 0; let t = a; t = Math.imul(t ^ (t >>> MIX_A), t | 1); t ^= t + Math.imul(t ^ (t >>> MIX_B), t | MIX_OR); return ((t ^ (t >>> MIX_C)) >>> 0) / UINT32; };
};

// A building's pieces round its footprint (w across the front, d deep), facing +z at rotY 0: corner posts, wall runs along the four sides (the front keeps a door gap), a roof, a sign on a shop, a chimney on a house or a smithy, a counter in a bank.
function building(row: LotKindRow, trade: string | undefined, w: number, d: number, R: () => number, defs: TownDefs): TownPiece[] {
  const out: TownPiece[] = [], v = () => Math.floor(R() * PIECE_VARIANTS), piece = (node: TownNode, x: number, z: number, rotY: number, scale = 1, slot?: Slot) => out.push({ node, x, z, rotY, scale, variant: v(), ...(slot ? { slot } : {}) });
  if (row.open) { piece('stall', 0, 0, 0); return out; }   // an open stall: one piece
  if (row.stand !== undefined) { piece('sign', 0, 0, 0, row.stand); piece('stall', 0, half(-d), 0); return out; }   // a notice board: a big sign on a stand
  if (!row.walls) return out;   // no building (the gate: its arch is added by the generator)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) piece('corner', half(sx * w), half(sz * d), 0);
  const run = (len: number, at: (t: number) => [number, number], rotY: number, front = false) => {   // the kit's module is 3 m (public/world/town/buildings.json)
    const n = Math.max(1, Math.round(len / MODULE));
    for (let i = 0; i < n; i++) { const [x, z] = at((i + HALF) / n); piece('wall', x, z, rotY, len / n / MODULE, front && i === Math.floor(half(n)) ? 'door' : R() < WINDOW_CHANCE ? 'window' : 'plain'); }
  };
  run(w, (t) => [(t - HALF) * w, half(d)], 0, true); run(w, (t) => [(t - HALF) * w, half(-d)], 0);
  run(d, (t) => [half(-w), (t - HALF) * d], half(Math.PI)); run(d, (t) => [half(w), (t - HALF) * d], half(Math.PI));
  piece('roof', 0, 0, 0, Math.max(w, d) / ROOF_DIVISOR);
  if (row.sign) piece('sign', 0, half(d) + SIGN_OFFSET, 0);
  if (row.chimney || (trade && defs.trades[trade]?.chimney)) piece('chimney', w / CHIMNEY_DIVISOR, -d / CHIMNEY_DIVISOR, 0);
  if (row.counter) piece('counter', 0, half(d) - COUNTER_INSET, 0, w / COUNTER_DIVISOR);
  return out;
}

export function generateTown(seed: string, wealth: number, defs: TownDefs = TOWN_DEFS): Town {
  const k = Math.min(1, Math.max(0, wealth)), R = rng(`town:${seed}:${Math.round(k * SEED_WEALTH_STEPS)}`), lots: Lot[] = [];
  const kinds = Object.entries(defs.lotKinds).sort((x, y) => x[1].order - y[1].order), trades = shopTrades(defs);
  const put = (kind: LotKind, ring: Lot['ring'], x: number, z: number, faceX: number, faceZ: number, w: number, d: number, trade?: string) => {
    const rotY = Math.atan2(faceX - x, faceZ - z), id = `${kind}-${lots.filter((l) => l.kind === kind).length + 1}`;
    const lot: Lot = { id, kind, ring, x, z, rotY, w, d, r: half(Math.hypot(w, d)) + 1, ...(trade ? { trade } : {}), pieces: building(defs.lotKinds[kind]!, trade, w, d, R, defs) };
    lots.push(lot);
    return lot;
  };
  const free = (x: number, z: number, r: number) => lots.every((l) => Math.hypot(l.x - x, l.z - z) >= l.r + r);
  // ring 0: the civic centre, the kinds with a `civic` size, 120 degrees apart round a plaza whose size follows the wealth
  const plaza = PLAZA_BASE + PLAZA_SPAN * k, civic = kinds.filter(([, r]) => r.civic), spin = turns(R()), third = Math.PI / CIVIC_CENTRES, turn = Math.floor(spin / third) * third + radians(TURN_BASE + (TURN_SPAN * (spin % third)) / third);   // the three centres are 120 degrees apart, so mod 180 they sit at t, t+60, t+120 (t = turn mod 60): t in [27, 33] degrees keeps every centre 27-33 degrees off the road axis (+-z), the best any turn can do (30 is the maximin)
  civic.forEach(([kind, row], i) => { const a = turn + turns(i) / CIVIC_CENTRES; put(kind, 0, Math.sin(a) * plaza, Math.cos(a) * plaza, 0, 0, row.civic!.w[0] + row.civic!.w[1] * k, row.civic!.d[0] + row.civic!.d[1] * k); });
  // rings 1 to 3: lots packed on a circle at each ring's radius (the previous ring's radius plus the ring's `gap`), each facing the centre, skipping a spot that would overlap
  const radii = new Map<number, number>(); let prev = plaza;
  for (const [, row] of kinds) if (row.ring > 0 && row.gap && !radii.has(row.ring)) { prev = prev + row.gap[0] + row.gap[1] * k; radii.set(row.ring, prev); }
  const dim = ([base, span, wealthSpan]: readonly [number, number, number]) => base + (span ? span * R() : 0) + wealthSpan * k;
  const ring = (n: number, radius: number, kind: LotKind, ringNo: Lot['ring'], size: () => [number, number], trade?: (i: number) => string | undefined) => {
    const start = turns(R());
    for (let i = 0, placed = 0, tries = 0; placed < n && tries < n * RING_TRIES; i++, tries++) {
      const a = start + turns(i / n) +(R() - HALF) * RING_JITTER, rr = radius + (R() - HALF) * RING_SPREAD, [w, d] = size(), x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      const r = half(Math.hypot(w, d)) + 1;
      if (!free(x, z, r) || Math.abs(x) < ROAD_HALF + r) continue;   // no lot of any kind (its whole footprint, radius r) stands on the road the two gate arches sit on (the z axis)
      put(kind, ringNo, x, z, 0, 0, w, d, trade?.(placed)); placed++;
    }
  };
  let outer = plaza;
  for (const [kind, row] of kinds) {
    if (row.ring < 1) continue;
    const radius = radii.get(row.ring) ?? outer; outer = Math.max(outer, radius);
    if (row.size && row.count) ring(Math.round(row.count[0] + row.count[1] * k), radius, kind, row.ring as Lot['ring'], () => [dim(row.size!.w), dim(row.size!.d)], row.trades && trades.length ? (i) => trades[i % trades.length] : undefined);
    // the gates: the road comes in on -z and goes out on +z, an arch at the town's rim on each
    if (row.gate) { for (const s of [-1, 1]) { const gate = put(kind, row.ring as Lot['ring'], 0, s * (radius + row.gate.offset), 0, 0, row.gate.w, row.gate.d); if (row.arch) gate.pieces.push({ node: 'arch', x: 0, z: 0, rotY: s < 0 ? 0 : Math.PI, scale: 1, variant: 0 }); } }
  }
  return { seed, wealth: k, lots, radius: outer + TOWN_RADIUS_PAD };
}

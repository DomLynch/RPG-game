// The town generator (World lane, docs/TOP10.md town plan row 5): a town from a seed and a wealth number, laid out in OpenTTD-style rings round a centre.
//   ring 0  the plaza: the bank, the Pit board, the rankings board, a well/market stalls (the civic centre, always one of each)
//   ring 1  the shops (smith, general, apothecary, inn, ...): each a lot facing the plaza
//   ring 2  the houses
//   ring 3  the edge: stalls and the gate arches on the road, the outermost houses
// Wealth (0..1) is how grand the town is: more lots, wider rings, bigger buildings, more variants. Pure data (no three.js, no clock, no Math.random): same seed + wealth = the same town.
// Output is placement data keyed on the building kit's node names (TOP10 row 3: wall, corner, arch, roof, stall, counter, sign, chimney); Characters' kit file maps them to meshes.
// Donor: OpenTTD town growth (rings round a centre; study and rewrite, GPL) and 2004Scape's fixed civic NPC set; the circle-packing placement here is our own.
export const TOWN_NODES = ['wall', 'corner', 'arch', 'roof', 'stall', 'counter', 'sign', 'chimney'] as const;
export type TownNode = (typeof TOWN_NODES)[number];
export type LotKind = 'bank' | 'board' | 'rankings' | 'stall' | 'shop' | 'house' | 'gate';
export type Slot = 'door' | 'window' | 'plain';   // which kind of wall a `wall` piece is: the door in the front, windows, or plain
export type TownPiece = { node: TownNode; x: number; z: number; rotY: number; scale: number; variant: number; slot?: Slot };   // world metres, town-local (the centre is 0,0)
export type Lot = { id: string; kind: LotKind; ring: 0 | 1 | 2 | 3; x: number; z: number; rotY: number; w: number; d: number; r: number; trade?: string; pieces: TownPiece[] };
export type Town = { seed: string; wealth: number; lots: Lot[]; radius: number };

export const ROAD_HALF = 6;   // metres either side of the z axis kept clear of stalls: the road runs through the gate arches
export const MODULE = 3;   // metres: the building kit's wall module
const TRADES = ['smith', 'general', 'apothecary', 'inn', 'tailor', 'fletcher', 'chandler', 'baker', 'cooper', 'jeweller'] as const;

const rng = (seed: string) => {   // mulberry32 over a string hash
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

// A building's pieces round its footprint (w across the front, d deep), facing +z at rotY 0: corner posts, wall runs along the four sides (the front keeps a door gap), a roof, a sign on a shop, a chimney on a house or a smithy, a counter in a bank.
function building(kind: LotKind, trade: string | undefined, w: number, d: number, R: () => number): TownPiece[] {
  const out: TownPiece[] = [], v = () => Math.floor(R() * 3), piece = (node: TownNode, x: number, z: number, rotY: number, scale = 1, slot?: Slot) => out.push({ node, x, z, rotY, scale, variant: v(), ...(slot ? { slot } : {}) });
  if (kind === 'stall') { piece('stall', 0, 0, 0); return out; }   // an open stall: one piece
  if (kind === 'gate') return out;   // the arch is added by the generator
  if (kind === 'board' || kind === 'rankings') { piece('sign', 0, 0, 0, 1.4); piece('stall', 0, -d / 2, 0); return out; }   // a notice board: a big sign on a stand
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) piece('corner', (sx * w) / 2, (sz * d) / 2, 0);
  const run = (len: number, at: (t: number) => [number, number], rotY: number, front = false) => {   // the kit's module is 3 m (public/world/town/buildings.json)
    const n = Math.max(1, Math.round(len / MODULE));
    for (let i = 0; i < n; i++) { const [x, z] = at((i + 0.5) / n); piece('wall', x, z, rotY, len / n / MODULE, front && i === Math.floor(n / 2) ? 'door' : R() < 0.4 ? 'window' : 'plain'); }
  };
  run(w, (t) => [(t - 0.5) * w, d / 2], 0, true); run(w, (t) => [(t - 0.5) * w, -d / 2], 0);
  run(d, (t) => [-w / 2, (t - 0.5) * d], Math.PI / 2); run(d, (t) => [w / 2, (t - 0.5) * d], Math.PI / 2);
  piece('roof', 0, 0, 0, Math.max(w, d) / 6);
  if (kind === 'shop' || kind === 'bank') piece('sign', 0, d / 2 + 0.3, 0);
  if (kind === 'house' || trade === 'smith' || trade === 'baker') piece('chimney', w / 4, -d / 4, 0);
  if (kind === 'bank') piece('counter', 0, d / 2 - 1.2, 0, w / 5);
  return out;
}

export function generateTown(seed: string, wealth: number): Town {
  const k = Math.min(1, Math.max(0, wealth)), R = rng(`town:${seed}:${Math.round(k * 100)}`), lots: Lot[] = [];
  const put = (kind: LotKind, ring: Lot['ring'], x: number, z: number, faceX: number, faceZ: number, w: number, d: number, trade?: string) => {
    const rotY = Math.atan2(faceX - x, faceZ - z), id = `${kind}-${lots.filter((l) => l.kind === kind).length + 1}`;
    lots.push({ id, kind, ring, x, z, rotY, w, d, r: Math.hypot(w, d) / 2 + 1, ...(trade ? { trade } : {}), pieces: building(kind, trade, w, d, R) });
  };
  const free = (x: number, z: number, r: number) => lots.every((l) => Math.hypot(l.x - x, l.z - z) >= l.r + r);
  // ring 0: the civic centre, three fixed buildings 120 degrees apart round a plaza whose size follows the wealth
  const plaza = 9 + 6 * k, civic = [['bank', 12 + 5 * k, 9 + 3 * k], ['board', 6, 4], ['rankings', 6, 4]] as const, turn = R() * Math.PI * 2;
  civic.forEach(([kind, w, d], i) => { const a = turn + (i * Math.PI * 2) / 3; put(kind, 0, Math.sin(a) * plaza, Math.cos(a) * plaza, 0, 0, w, d); });
  // rings 1 to 3: lots packed on a circle at each ring's radius, each facing the centre, skipping a spot that would overlap
  const ring = (n: number, radius: number, kind: LotKind, ringNo: Lot['ring'], size: (i: number) => [number, number], trade?: (i: number) => string | undefined) => {
    const start = R() * Math.PI * 2;
    for (let i = 0, placed = 0, tries = 0; placed < n && tries < n * 6; i++, tries++) {
      const a = start + (i / n) * Math.PI * 2 + (R() - 0.5) * 0.25, rr = radius + (R() - 0.5) * 2, [w, d] = size(placed), x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      if (!free(x, z, Math.hypot(w, d) / 2 + 1) || (kind === 'stall' && Math.abs(x) < ROAD_HALF)) continue;   // a stall never stands on the road the two gate arches sit on (z axis)
      put(kind, ringNo, x, z, 0, 0, w, d, trade?.(placed)); placed++;
    }
  };
  const shops = 4 + Math.round(6 * k), houses = 6 + Math.round(22 * k), r1 = plaza + 16 + 4 * k, r2 = r1 + 14 + 4 * k, r3 = r2 + 12;
  ring(shops, r1, 'shop', 1, () => [7 + 4 * R() + 3 * k, 6 + 3 * R()], (i) => TRADES[i % TRADES.length]);
  ring(houses, r2, 'house', 2, () => [5 + 3 * R() + 2 * k, 5 + 3 * R()]);
  ring(Math.round(3 + 5 * k), r3, 'stall', 3, () => [3, 3]);
  // the gates: the road comes in on -z and goes out on +z, an arch at the town's rim on each
  for (const s of [-1, 1]) put('gate', 3, 0, s * (r3 + 6), 0, 0, 6, 2);
  lots.at(-2)!.pieces.push({ node: 'arch', x: 0, z: 0, rotY: 0, scale: 1, variant: 0 }); lots.at(-1)!.pieces.push({ node: 'arch', x: 0, z: 0, rotY: Math.PI, scale: 1, variant: 0 });
  return { seed, wealth: k, lots, radius: r3 + 12 };
}

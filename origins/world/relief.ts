// Zone 1 quality, step 1 (TOP10 "Zone 1 quality"): the ground's relief, as a pure function of (x, z, terrain params).
// `terrain.relief` (m) is the height of the hills either side of flat ground, `hillScale` (m) their wavelength, `seed` picks the landscape. Seeded value noise, a gentle domain warp
// so the contours meander, three octaves; flat pads (camp, gate, boss anchor) blend smoothly to height 0. No Math.random, no clock, no Math.hypot (its last bit differs between
// engines): every host (browser, the writer, a test) computes the same heights, so the drawn mesh and the ground the hero stands on cannot drift apart.
// Donor: World of Claudecraft src/.../terrain_relief.ts (MIT: seeded warped fbm, the same heights on client and server); the warp + fbm idea is taken, the code is written for this schema
// (a ±relief range, pads, no gradient-damped or ridged layers: Zone 1 is gentle hills, not mountains).
export type ReliefParams = { relief: number; hillScale: number; seed: number };
export type Pad = { x: number; z: number; r: number };   // a flat disc of radius r metres round (x, z); the ground blends back to the hills over the next 0.6 r

const OCTAVES = 3, GAIN = 0.5, LACUNARITY = 2, WARP = 0.6, PAD_BLEND = 1.6;
const NORM = (1 - GAIN ** OCTAVES) / (1 - GAIN);   // the fbm's summed amplitude, so it stays in [0, 1)

// A lattice hash to [0, 1): integer mixing only (Math.imul and shifts), so it is exact everywhere.
function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
function noise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), u = fade(x - xi), v = fade(z - zi);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, seed: number): number {
  let sum = 0, amp = 1, f = 1;
  for (let i = 0; i < OCTAVES; i++) { sum += amp * noise(x * f, z * f, seed + i * 101); amp *= GAIN; f *= LACUNARITY; }
  return sum / NORM;
}
const smooth = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c); };

// The zone id as a seed when the data leaves `terrain.seed` at 0: FNV-1a over the id's UTF-16 units.
export function seedOf(zoneId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < zoneId.length; i++) h = Math.imul(h ^ zoneId.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// Ground height in metres at (x, z): within ±relief, exactly 0 inside every pad. relief 0 is flat ground and costs nothing.
export function reliefAt(x: number, z: number, p: ReliefParams, pads: readonly Pad[] = []): number {
  if (p.relief === 0) return 0;
  const k = 1 / p.hillScale, seed = p.seed | 0;
  const wx = x + (noise(x * k * 0.5 + 17.3, z * k * 0.5, seed + 7) - 0.5) * p.hillScale * WARP;   // the warp: contours meander instead of lying on a grid
  const wz = z + (noise(x * k * 0.5, z * k * 0.5 + 31.7, seed + 13) - 0.5) * p.hillScale * WARP;
  let h = (fbm(wx * k, wz * k, seed) - 0.5) * 2 * p.relief;
  for (const pad of pads) {
    const dx = x - pad.x, dz = z - pad.z;
    h *= smooth((Math.sqrt(dx * dx + dz * dz) - pad.r) / (pad.r * (PAD_BLEND - 1)));
  }
  return h;
}

// The 32 x 32 heightfield the renderer meshes: `n` samples a side over a `size` m square centred on (cx, cz), row-major (z rows, x columns).
export function heightfield(p: ReliefParams, size: number, pads: readonly Pad[] = [], n = 32, cx = 0, cz = 0): Float32Array {
  const out = new Float32Array(n * n), step = size / (n - 1);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[j * n + i] = reliefAt(cx - size / 2 + i * step, cz - size / 2 + j * step, p, pads);
  return out;
}

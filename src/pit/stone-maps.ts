// `?look=pit-stone` (Web, Lead 2026-09-30): the Pit's wall, vault and floor as stone that reads real at 375. This file only makes the
// maps, as plain bytes (no THREE, no DOM), so it runs the same in a worker, a test or the page. Procedural, nothing downloaded (CC0 by
// construction); a loaded PBR set (GPT's tileable 1024s) takes the same slot in stone.ts.
//
// One set: a tile `tile` metres square (3 m at 512²: ~6 mm a texel, so a 4 cm joint is ~6 texels and survives the mips) of broken-bond coursing — every course its own height, every block its own width and start, so no
// two courses line up and the repeat sits at `tile` metres only. Each block is a slab with a bevel, a slight tilt, pitting and chips;
// the mortar sits recessed. The albedo carries the cavity (the mortar and pits dark); the normal map is the heightfield's slope.
export type StoneSpec = {
  size: number; tile: number; seed: number;
  course: [number, number]; block: [number, number];   // course height and block width ranges, metres
  mortar: number; bevel: number;   // the joint's half-width and the arris round-over, metres
  stone: [number, number, number]; joint: [number, number, number];   // sRGB 0..1
  sand?: [number, number, number];   // flags: sand drifts into the joints and the low faces
};
export type StoneBytes = { size: number; albedo: Uint8Array; normal: Uint8Array };

export const WALL: StoneSpec = { size: 512, tile: 3, seed: 7, course: [0.24, 0.5], block: [0.35, 1.05], mortar: 0.019, bevel: 0.045, stone: [0.46, 0.42, 0.37], joint: [0.17, 0.155, 0.14] };
export const FLOOR: StoneSpec = { size: 512, tile: 3, seed: 19, course: [0.45, 0.8], block: [0.5, 1.1], mortar: 0.014, bevel: 0.05, stone: [0.4, 0.37, 0.33], joint: [0.2, 0.18, 0.15], sand: [0.42, 0.36, 0.27] };

// A seeded 0..1 stream (mulberry32).
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Cuts `length` into pieces within [lo, hi], scaled to sum exactly `length` (so the tile wraps).
function cuts(length: number, [lo, hi]: [number, number], rnd: () => number): number[] {
  const out: number[] = [];
  let sum = 0;
  while (sum < length) { const w = lo + (hi - lo) * rnd(); out.push(w); sum += w; }
  if (out.length > 1 && sum - length > out[out.length - 1]! / 2) { sum -= out.pop()!; }
  return out.map((w) => w * length / sum);
}
// Tileable value noise, period `p` cells over the tile, 0..1; fbm of three octaves.
function lattice(p: number, rnd: () => number) { return { p, v: Float32Array.from({ length: p * p }, rnd) }; }
function value(l: { p: number; v: Float32Array }, u: number, v: number): number {
  const x = u * l.p, y = v * l.p, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), p = l.p;
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = l.v[y0 * p + x0]!, b = l.v[y0 * p + x1]!, c = l.v[y1 * p + x0]!, d = l.v[y1 * p + x1]!;
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function stoneBytes(spec: StoneSpec): StoneBytes {
  const { size, tile, mortar, bevel } = spec, rnd = random(spec.seed), px = tile / size;
  // The layout: courses bottom to top, each with its own start offset and block widths; per block a tone, a hue lean, a tilt and a bevel.
  const heights = cuts(tile, spec.course, rnd);
  const courses = heights.map((h, i) => {
    const widths = cuts(tile, spec.block, rnd), y0 = heights.slice(0, i).reduce((s, x) => s + x, 0), off = rnd() * tile;
    const starts = widths.map((_, j) => widths.slice(0, j).reduce((s, x) => s + x, 0));
    return { y0, h, off, starts, widths, blocks: widths.map(() => ({ tone: 0.78 + 0.38 * rnd(), warm: rnd() - 0.5, tx: (rnd() - 0.5) * 0.2, ty: (rnd() - 0.5) * 0.2, bevel: bevel * (0.6 + 0.8 * rnd()), chip: rnd() })) };
  });
  const rowOf = new Int16Array(size);
  for (let y = 0, c = 0; y < size; y++) { const m = (y + 0.5) * px; while (c < courses.length - 1 && m >= courses[c]!.y0 + courses[c]!.h) c++; rowOf[y] = c; }
  const coarse = lattice(8, rnd), mid = lattice(32, rnd), fine = lattice(128, rnd), sandNoise = lattice(12, rnd);
  const height = new Float32Array(size * size), albedo = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const course = courses[rowOf[y]!]!, my = (y + 0.5) * px, dyEdge = Math.min(my - course.y0, course.y0 + course.h - my), v = y / size;
    let j = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, mx = ((x + 0.5) * px + course.off) % tile;
      if (mx < course.starts[j]!) j = 0;   // the course's offset wrapped past the tile's edge
      while (j < course.widths.length - 1 && mx >= course.starts[j]! + course.widths[j]!) j++;
      const n1 = value(coarse, u, v), n2 = value(mid, u, v), n3 = value(fine, u, v), grain = 0.55 * n2 + 0.45 * n3;
      // Hewn, not sawn: the edges are measured on a warped copy of the point, so every arris wanders by a few centimetres.
      const wx = 0.035 * (value(mid, u + 0.37, v) - 0.5) * 2, wy = 0.03 * (value(mid, u, v + 0.61) - 0.5) * 2;
      const block = course.blocks[j]!, bx = mx - course.starts[j]! + wx, dxEdge = Math.min(bx, course.widths[j]! - bx);
      const d = Math.min(dxEdge, dyEdge + wy * Math.sign(my - course.y0 - course.h / 2)) - mortar * (0.6 + 0.8 * n3);
      let h: number;
      if (d <= 0) h = 0.08 * n3;
      else {
        const t = Math.min(1, d / block.bevel), round = t * t * (3 - 2 * t);
        h = 0.3 + 0.55 * round + block.tx * (bx / course.widths[j]! - 0.5) + block.ty * ((my - course.y0) / course.h - 0.5) + 0.3 * (grain - 0.5);   // a rough-dressed face, not a pillow
        if (d < 0.06 && n2 > 0.62 + 0.3 * block.chip) h -= 0.25 * (n2 - 0.62);   // a chipped arris
        if (n3 > 0.8) h -= 0.12 * (n3 - 0.8) * 5;   // pitting
      }
      height[y * size + x] = h;
      const i = (y * size + x) * 4;
      let r: number, g: number, b: number;
      if (d <= 0) { const k = 0.8 + 0.4 * n3; r = spec.joint[0] * k; g = spec.joint[1] * k; b = spec.joint[2] * k; }
      else {
        const low = 1 - (my - course.y0) / course.h;   // weathering gathers on each block's lower face
        const k = block.tone * (0.72 + 0.42 * grain) * (0.78 + 0.4 * n1) * (0.5 + 0.55 * Math.min(1, Math.max(0, h))) * (1 - 0.12 * low * low);   // the cavity baked in
        r = spec.stone[0] * k * (1 + 0.08 * block.warm); g = spec.stone[1] * k; b = spec.stone[2] * k * (1 - 0.08 * block.warm);
      }
      if (spec.sand) {   // sand lies in the joints, on the low faces and in drifts
        const drift = value(sandNoise, u, v), s = Math.min(1, Math.max(0, (d <= 0 ? 0.45 : 0) + (0.5 - h) * 1.2 + (drift - 0.5) * 2.2));   // the joints dusty, not bright lines
        const k = 0.85 + 0.3 * n3;
        r += (spec.sand[0] * k - r) * s; g += (spec.sand[1] * k - g) * s; b += (spec.sand[2] * k - b) * s;
        if (s > 0) height[y * size + x] = h + (0.45 - h) * s * 0.8;   // the sand fills, flattening the relief it covers
      }
      albedo[i] = Math.min(255, r * 255); albedo[i + 1] = Math.min(255, g * 255); albedo[i + 2] = Math.min(255, b * 255); albedo[i + 3] = 255;
    }
  }
  // The normal map from the heightfield (wrapping, so it tiles): OpenGL convention, +y up the texture (row 0 is v 0, as DataTexture lays it).
  const k = 0.045 / px;   // relief: height 1 ≈ 4.5 cm of depth (World: 1.4 cm faces blurred to a mottle at room distance)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = height[y * size + ((x + size - 1) % size)]!, r = height[y * size + ((x + 1) % size)]!;
    const dn = height[((y + size - 1) % size) * size + x]!, up = height[((y + 1) % size) * size + x]!;
    const nx = (l - r) * k * 0.5, ny = (dn - up) * k * 0.5, len = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    normal[i] = (nx / len * 0.5 + 0.5) * 255; normal[i + 1] = (ny / len * 0.5 + 0.5) * 255; normal[i + 2] = (1 / len * 0.5 + 0.5) * 255; normal[i + 3] = 255;
  }
  return { size, albedo, normal };
}

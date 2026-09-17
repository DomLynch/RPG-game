// The arena's textures, generated at load from seeded noise: original work, no downloads (the arena's transfer budget is ≤ 600 KB gzip;
// these are a few KB of code). Every function is pure in (size, seed) so tests/arena.test.ts can measure the same pixels the phone sees.
// Materials rule: sand, stone, ash, iron, bone, blood — worn, matte, nothing saturated. Colours are sRGB bytes.
export type Pixels = { width: number; height: number; data: Uint8Array };

// Portable integer hash → [0, 1). No Math.sin: identical on every platform, so a capture is a capture.
export function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Tileable value noise: octaves of lattices sampled with a smoothstep, summed with `gain`. Returns a sampler over the unit square.
export function fbm(period: number, octaves: number, seed: number, gain = 0.5): (u: number, v: number) => number {
  const layers = Array.from({ length: octaves }, (_, o) => { const p = period << o, table = new Float32Array(p * p); for (let i = 0; i < p * p; i++) table[i] = hash(i % p, Math.floor(i / p), seed + o * 131); return { p, table }; });
  let norm = 0; for (let o = 0; o < octaves; o++) norm += gain ** o;
  return (u, v) => {
    let sum = 0, amp = 1;
    for (const { p, table } of layers) {
      const x = ((u % 1) + 1) % 1 * p, y = ((v % 1) + 1) % 1 * p, ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const jx = (ix + 1) % p, jy = (iy + 1) % p, a = table[iy * p + ix], b = table[iy * p + jx], c = table[jy * p + ix], d = table[jy * p + jx];
      sum += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy); amp *= gain;
    }
    return sum / norm;
  };
}
const clamp = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v;
function pixels(width: number, height: number, shade: (u: number, v: number, x: number, y: number) => [number, number, number, number?]): Pixels {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0, i = 0; y < height; y++) for (let x = 0; x < width; x++, i += 4) { const [r, g, b, a = 255] = shade(x / width, y / height, x, y); data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b); data[i + 3] = clamp(a); }
  return { width, height, data };
}
// Pebbles: the gravel. Seeded ellipses that wrap at the tile edge; `plot` receives each covered texel with its height (a dome, 0..1).
type Pebble = { x: number; y: number; rx: number; ry: number; tone: number; rot: number };
export function pebbles(size: number, count: number, seed: number, minR: number, maxR: number): Pebble[] {
  return Array.from({ length: count }, (_, i) => { const r = minR + hash(i, 3, seed) ** 2 * (maxR - minR); return { x: hash(i, 0, seed) * size, y: hash(i, 1, seed) * size, rx: r, ry: r * (0.55 + hash(i, 4, seed) * 0.45), tone: hash(i, 2, seed), rot: hash(i, 5, seed) * Math.PI }; });
}
function stamp(size: number, list: Pebble[], plot: (x: number, y: number, dome: number, p: Pebble, dx: number, dy: number) => void) {
  for (const p of list) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot), reach = Math.ceil(Math.max(p.rx, p.ry)) + 1;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const lx = (dx * c + dy * s) / p.rx, ly = (-dx * s + dy * c) / p.ry, d = lx * lx + ly * ly;
      if (d < 1) plot((((p.x | 0) + dx) % size + size) % size, (((p.y | 0) + dy) % size + size) % size, Math.sqrt(1 - d), p, dx, dy);
    }
  }
}
// Sand with gravel: dusty ochre, damp mottling, trodden grain, grey and brown pebbles with a lit edge, a rare bone chip. Mean linear
// luminance must stay below the hero's skin (tests/arena.test.ts); the sand is the darkest thing the fighters stand against, on purpose.
export function sandAlbedo(size = 1024, seed = 7): Pixels {
  const mottle = fbm(6, 5, seed), damp = fbm(3, 3, seed + 17), grain = fbm(64, 2, seed + 29, 0.6);
  const out = pixels(size, size, (u, v, x, y) => {
    const m = 0.9 + 0.36 * (mottle(u, v) - 0.5), d = Math.max(0, damp(u, v) - 0.58) * 1.4, g = 0.96 + 0.1 * (grain(u, v) - 0.5) + 0.05 * (hash(x, y, seed) - 0.5);
    const k = m * g * (1 - 0.3 * d);
    return [146 * k + 4 * d, 120 * k, 90 * k - 3 * d];
  });
  // Gravel sits in the sand: tones near the sand's own, a soft dome, a shadowed lower-right rim (the sun is high and to the upper left).
  const shade = (x: number, y: number, dome: number, p: Pebble, dx: number, dy: number, palette: [number, number, number][]) => {
    const i = (y * size + x) * 4, [r, g, b] = palette[Math.floor(p.tone * palette.length)], rim = (dx + dy) / (p.rx + p.ry), lit = 0.82 + 0.2 * dome - 0.28 * Math.max(0, rim) * (1 - dome) - 0.1 * Math.max(0, -rim) * (1 - dome) * -1;
    out.data[i] = clamp(r * lit); out.data[i + 1] = clamp(g * lit); out.data[i + 2] = clamp(b * lit);
  };
  const gravel: [number, number, number][] = [[118, 106, 92], [134, 118, 100], [104, 96, 86], [142, 124, 104], [122, 110, 94], [96, 90, 84]];
  stamp(size, pebbles(size, Math.round(size * size / 420), seed + 3, 1.5, size / 190), (x, y, dome, p, dx, dy) => shade(x, y, dome, p, dx, dy, gravel));
  stamp(size, pebbles(size, Math.round(size * size / 9000), seed + 5, size / 170, size / 80), (x, y, dome, p, dx, dy) => shade(x, y, dome, p, dx, dy, gravel));
  stamp(size, pebbles(size, Math.round(size * size / 120000), seed + 9, size / 300, size / 130), (x, y, dome, p, dx, dy) => shade(x, y, dome, p, dx, dy, [[190, 178, 154], [172, 162, 140]]));   // bone chips
  return out;
}
// Sand normal map: ripples and grain plus the same pebbles as domes; tangent-space, +Y up, wraps.
export function sandNormal(size = 512, seed = 7): Pixels {
  const ripple = fbm(5, 4, seed + 41), grain = fbm(48, 2, seed + 43, 0.6), height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) height[y * size + x] = ripple(x / size, y / size) * 3 + grain(x / size, y / size) * 0.8;
  const domes = (list: Pebble[], h: number) => stamp(size, list, (x, y, dome) => { height[y * size + x] = Math.max(height[y * size + x], height[y * size + x] * 0.4 + dome * h); });
  domes(pebbles(size, Math.round(size * size / 420), seed + 3, 0.75, size / 190), 2.2); domes(pebbles(size, Math.round(size * size / 9000), seed + 5, size / 170, size / 80), 3.2);
  return pixels(size, size, (_u, _v, x, y) => {
    const at = (i: number, j: number) => height[((j + size) % size) * size + (i + size) % size], dx = (at(x + 1, y) - at(x - 1, y)) * 0.9, dy = (at(x, y + 1) - at(x, y - 1)) * 0.9, l = Math.hypot(dx, dy, 1);
    return [128 - 127 * dx / l, 128 - 127 * dy / l, 128 + 127 / l];
  });
}
// Ashlar stone: ash-grey blocks in staggered courses with worn mortar, mottling, soot, a few cracks. One tile = 2 m × 2 m on the wall.
export function stoneAlbedo(size = 512, seed = 11): Pixels {
  const mottle = fbm(8, 4, seed), soot = fbm(3, 3, seed + 7), grain = fbm(64, 2, seed + 13, 0.6), crackField = fbm(5, 4, seed + 5, 0.55), crackMask = fbm(3, 2, seed + 9), courses = 4, blocks = 2;
  return pixels(size, size, (u, v, x, y) => {
    const course = Math.floor(v * courses), bu = (u + (course % 2) * 0.5 / blocks) * blocks, bv = v * courses, fx = bu - Math.floor(bu), fy = bv - Math.floor(bv), block = hash(Math.floor(bu), course, seed);
    const wobble = 0.03 + 0.05 * grain(u * 3, v * 3), edge = Math.min(fx, 1 - fx, (fy - 0.02) * 2, (1 - fy) * 2), mortar = edge < wobble ? 0.66 + (edge / wobble) * 0.34 : 1;
    const m = 0.82 + 0.34 * (mottle(u, v) - 0.5) + 0.26 * (block - 0.5), s = Math.max(0, soot(u, v) - 0.62) * 1.3, g = 0.95 + 0.1 * (grain(u, v) - 0.5) + 0.05 * (hash(x, y, seed) - 0.5);
    const crack = Math.abs(crackField(u, v) - 0.5) < 0.004 && mortar === 1 && crackMask(u, v) > 0.6 ? 0.6 : 1, k = m * g * mortar * crack * (1 - 0.4 * s), warm = 1 + 0.06 * (hash(Math.floor(bu), course, seed + 2) - 0.5);
    return [158 * k * warm, 150 * k, 138 * k / warm];
  });
}
// The sky: an ash-grey dome, its horizon the scene's fog colour so the dome and the fog meet, with one break of light around the sun.
// Equirectangular: u around, v from the horizon (0.5) to the zenith (1). `sunU` is the sun's azimuth on the dome's u axis.
export function skyPixels(width = 512, height = 256, sunU = 0.86, sunV = 0.77, seed = 19): Pixels {
  const cloud = fbm(4, 4, seed), wisp = fbm(12, 3, seed + 3);
  return pixels(width, height, (u, v) => {
    const up = Math.max(0, (v - 0.5) * 2), du = Math.min(Math.abs(u - sunU), 1 - Math.abs(u - sunU)) * 2.2, dv = (v - sunV) * 2.8, sun = Math.exp(-(du * du + dv * dv) * 2.4);
    const c = cloud(u, v * 2) - 0.5, w = wisp(u, v * 3) - 0.5, shade = 1 - 0.32 * up + 0.14 * c + 0.05 * w;
    return [156 * shade + 70 * sun, 168 * shade * 0.98 + 52 * sun, 166 * shade * 0.94 + 30 * sun];
  });
}
// Crowd atlas: four silhouettes (standing, fist raised, cloaked, leaning) in a row; white with a faint top light, alpha cut. Tinted per
// instance by the arena. Cheap variation: the outline, not the pixels, tells them apart.
export function crowdAtlas(cell = 128, seed = 23): Pixels {
  const shapes: ((x: number, y: number) => boolean)[] = [   // x, y in [0,1] of the cell, y up; each is a union of blobs and bars
    (x, y) => blob(x, y, .5, .86, .065, .08) || bar(x, y, .5, .62, .3, .24) || bar(x, y, .5, .36, .24, .3) || bar(x, y, .43, .12, .09, .24) || bar(x, y, .58, .12, .09, .24),
    (x, y) => blob(x, y, .5, .84, .065, .08) || bar(x, y, .5, .6, .3, .24) || bar(x, y, .5, .34, .24, .3) || bar(x, y, .42, .11, .09, .22) || bar(x, y, .59, .11, .09, .22) || bar(x, y, .71, .78, .07, .32) || blob(x, y, .72, .95, .055, .05),
    (x, y) => blob(x, y, .5, .87, .08, .09) || bar(x, y, .5, .5, .4, .5) || bar(x, y, .5, .14, .34, .28) || bar(x, y, .5, .7, .22, .1),
    (x, y) => blob(x, y, .56, .8, .065, .08) || bar(x, y, .52, .56, .3, .24) || bar(x, y, .48, .32, .24, .26) || bar(x, y, .42, .1, .09, .2) || bar(x, y, .56, .1, .09, .2) || bar(x, y, .7, .6, .07, .26),
  ];
  return pixels(cell * shapes.length, cell, (_u, v, x, y) => {
    const i = Math.floor(x / cell), lx = (x - i * cell) / cell, ly = v, inside = shapes[i](lx + (hash(x, y, seed) - .5) * .02, ly), tone = 205 + 40 * ly;
    return [tone, tone, tone, inside ? 255 : 0];
  });
}
const blob = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const bar = (x: number, y: number, cx: number, cy: number, w: number, h: number) => Math.abs(x - cx) < w / 2 && Math.abs(y - cy) < h / 2;
// A torn banner: alpha only. Ragged hem, frayed sides, a few holes; the cloth colour is the material's.
export function bannerAlpha(width = 128, height = 256, seed = 31): Pixels {
  const hem = fbm(6, 3, seed), holes = fbm(5, 3, seed + 3), fray = fbm(10, 2, seed + 5);
  return pixels(width, height, (u, v) => {
    const torn = v < 0.28 + 0.2 * (hem(u, 0.5) - 0.5) + 0.06 * (fray(u, v) - 0.5), side = Math.min(u, 1 - u) < 0.05 * fray(v, u), hole = holes(u, v) > 0.72 && v < 0.75;
    return [255, 255, 255, torn || side || hole ? 0 : 255];
  });
}
// Mean linear luminance of an sRGB pixel buffer: the number the contrast rule is written in.
export function luminance(p: Pixels): number {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  let sum = 0; for (let i = 0; i < p.data.length; i += 4) sum += 0.2126 * lin(p.data[i]) + 0.7152 * lin(p.data[i + 1]) + 0.0722 * lin(p.data[i + 2]);
  return sum / (p.data.length / 4);
}

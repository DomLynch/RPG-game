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
// Sand with gravel: dusty grey-stone (owner: less yellow, more gravel), damp mottling, trodden grain, grey pebbles with a lit edge,
// a rare bone chip. Mean linear luminance must stay below the hero's skin (tests/arena.test.ts); the sand is the darkest thing the
// fighters stand against, on purpose.
export function sandAlbedo(size = 1024, seed = 7): Pixels {
  const mottle = fbm(6, 5, seed), damp = fbm(3, 3, seed + 17), grain = fbm(64, 2, seed + 29, 0.6);
  const out = pixels(size, size, (u, v, x, y) => {
    const m = 0.9 + 0.36 * (mottle(u, v) - 0.5), d = Math.max(0, damp(u, v) - 0.58) * 1.4, g = 0.96 + 0.1 * (grain(u, v) - 0.5) + 0.05 * (hash(x, y, seed) - 0.5);
    const k = m * g * (1 - 0.3 * d);
    return [134 * k + 3 * d, 124 * k, 110 * k - 2 * d];
  });
  // Gravel sits in the sand: tones near the sand's own, a soft dome, a shadowed lower-right rim (the sun is high and to the upper left).
  const shade = (x: number, y: number, dome: number, p: Pebble, dx: number, dy: number, palette: [number, number, number][]) => {
    const i = (y * size + x) * 4, [r, g, b] = palette[Math.floor(p.tone * palette.length)], rim = (dx + dy) / (p.rx + p.ry), lit = 0.82 + 0.2 * dome - 0.28 * Math.max(0, rim) * (1 - dome) - 0.1 * Math.max(0, -rim) * (1 - dome) * -1;
    out.data[i] = clamp(r * lit); out.data[i + 1] = clamp(g * lit); out.data[i + 2] = clamp(b * lit);
  };
  const gravel: [number, number, number][] = [[112, 108, 100], [126, 120, 110], [100, 96, 90], [134, 128, 118], [116, 112, 104], [92, 90, 86]];
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
// The ashlar block layout, shared by the albedo and the normal map so the carved relief lands exactly on the printed blocks.
function ashlar(seed: number) {
  const courseH = Array.from({ length: 5 }, (_, c) => 0.7 + hash(c, 0, seed + 40) * 0.6), cSum = courseH.reduce((a, b) => a + b, 0);
  const courseAt = [0]; for (const h of courseH) courseAt.push(courseAt[courseAt.length - 1] + h / cSum);
  const blocksOf = courseH.map((_h, c) => { const n = 2 + Math.floor(hash(c, 1, seed + 41) * 3), w = Array.from({ length: n }, (_, k) => 0.6 + hash(k, c, seed + 42) * 0.9), s = w.reduce((a, b) => a + b, 0), at = [0]; for (const x of w) at.push(at[at.length - 1] + x / s); return { at, stagger: hash(c, 2, seed + 43) }; });
  const locate = (at: number[], t: number) => { let i = 0; while (i < at.length - 2 && t >= at[i + 1]) i++; return [i, (t - at[i]) / (at[i + 1] - at[i])] as const; };
  return { courseAt, blocksOf, locate };
}
// Ashlar stone: hand-laid, not robotic (owner). Uneven course heights, 2–4 uneven blocks a course with staggered joints that
// wander, blocks sitting proud (casting a shadow on the course below) or recessed, a damaged block here and there, worn mortar,
// a per-block chamfer, weather streaks, pitting, mottling, soot, a few cracks. One tile = 2 m × 2 m on the wall.
export function stoneAlbedo(size = 512, seed = 11): Pixels {
  const mottle = fbm(8, 4, seed), soot = fbm(3, 3, seed + 7), grain = fbm(64, 2, seed + 13, 0.6), crackField = fbm(5, 4, seed + 5, 0.55), crackMask = fbm(3, 2, seed + 9), stains = fbm(6, 3, seed + 21), dampF = fbm(3, 3, seed + 17);
  // Reused stone: each block picks a hue — quarry grey, warm tan, cool slate, faint rose, sand-tinged, dark basalt. Half strength
  // (the full spread read as patchwork, 2026-09-17); the warm hues dampened toward grey again (still too yellow, 2026-09-18).
  const hues: [number, number, number][] = [[1, 1, 1], [1.035, 1.0, 0.955], [0.95, 0.98, 1.03], [1.025, 0.98, 0.95], [1.015, 1.0, 0.95], [0.92, 0.925, 0.94]];
  const { courseAt, blocksOf, locate } = ashlar(seed);
  return pixels(size, size, (u, v, x, y) => {
    const [course, fy0] = locate(courseAt, v), { at, stagger } = blocksOf[course], [bi, fx0] = locate(at, (((u + stagger) % 1) + 1) % 1), block = hash(bi, course, seed);
    const jx = (grain(u * 5, v * 5) - 0.5) * 0.12, fx = Math.min(1, Math.max(0, fx0 + jx * 0.4)), fy = Math.min(1, Math.max(0, fy0 + jx));   // the joints wander
    const wobble = 0.035 + 0.05 * grain(u * 3, v * 3), edge = Math.min(fx, 1 - fx, (fy - 0.02) * 2, (1 - fy) * 2), mortar = edge < wobble ? 0.5 + (edge / wobble) * 0.5 : 1;
    const proud = hash(bi, course, seed + 44), above = blocksOf[(course + 1) % blocksOf.length], [biAbove] = locate(above.at, (((u + above.stagger) % 1) + 1) % 1);
    const drop = hash(biAbove, course + 1, seed + 44) > 0.62 && fy > 0.88 ? 0.78 : 1, recess = proud < 0.3 ? 0.9 : 1;   // proud blocks throw a shadow down; recessed ones sit in shade
    const chamfer = mortar === 1 ? 1 + 0.09 * (0.5 - fx) + 0.11 * (0.5 - fy) : 1;   // worn arris: the sun catches the top-left of each block
    const damaged = block > 0.85 ? 0.82 + 0.3 * (mottle(u * 2, v * 2) - 0.5) : 1;
    const m = 0.82 + 0.5 * (mottle(u, v) - 0.5) + 0.42 * (block - 0.5), s = Math.max(0, soot(u, v) - 0.62) * 1.3, g = 0.93 + 0.16 * (grain(u, v) - 0.5) + 0.07 * (hash(x, y, seed) - 0.5);
    const streak = Math.max(0, stains(u * 3, v * 0.4) - 0.6) * 1.4, pit = hash(x, y, seed + 31) > 0.992 ? 0.72 : 1;
    const damp = Math.max(0, dampF(u, v) - 0.6) * 1.2, speck = hash(x, y, seed + 50), grit = speck > 0.97 ? 1.28 : speck < 0.03 ? 0.74 : 1;   // quartz flecks and dark pits: the grit
    const crack = Math.abs(crackField(u, v) - 0.5) < 0.004 && mortar === 1 && crackMask(u, v) > 0.6 ? 0.6 : 1, k = m * g * mortar * chamfer * drop * recess * damaged * crack * pit * grit * (1 - 0.4 * s) * (1 - 0.3 * streak) * (1 - 0.35 * damp);
    const [hr, hg, hb] = hues[Math.floor(hash(bi, course, seed + 6) * hues.length)];
    return [158 * k * hr, 150 * k * hg, 138 * k * hb];
  });
}
// Stone normal map: the relief the albedo only prints — the wall read flat and machine-smooth with colour alone (owner 2026-09-18).
// Same layout, joint wander, chamfer and crack fields as stoneAlbedo, so every groove and step lands on its printed line; plus
// erosion undulation, surface tooth, pitted dents and knocked corners. Tangent-space, +Y up, wraps.
export function stoneNormal(size = 512, seed = 11): Pixels {
  const { courseAt, blocksOf, locate } = ashlar(seed);
  const grain = fbm(64, 2, seed + 13, 0.6), mottle = fbm(8, 4, seed), crackField = fbm(5, 4, seed + 5, 0.55), crackMask = fbm(3, 2, seed + 9), tooth = fbm(48, 2, seed + 71, 0.6);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const [course, fy0] = locate(courseAt, v), { at, stagger } = blocksOf[course], [bi, fx0] = locate(at, (((u + stagger) % 1) + 1) % 1);
    const jx = (grain(u * 5, v * 5) - 0.5) * 0.12, fx = Math.min(1, Math.max(0, fx0 + jx * 0.4)), fy = Math.min(1, Math.max(0, fy0 + jx));
    const wobble = 0.035 + 0.05 * grain(u * 3, v * 3), edge = Math.min(fx, 1 - fx, (fy - 0.02) * 2, (1 - fy) * 2);
    let h = (hash(bi, course, seed + 44) - 0.5) * 1.1;                                     // proud and recessed blocks: the joints catch light
    const face = Math.min(1, Math.max(0, (edge - wobble) / 0.22));                         // 0 in the joint → 1 on the face
    h += (0.4 + 0.8 * hash(bi, course, seed + 60)) * face * face * (3 - 2 * face);         // the chamfer up to the face, per-block amplitude
    if (edge < wobble) h -= 1.5 * Math.pow(1 - edge / wobble, 0.7);                        // the mortar groove itself
    h += (mottle(u * 2, v * 2) - 0.5) * 0.55 * face + (tooth(u, v) - 0.5) * 0.22;          // erosion undulation and surface tooth
    if (hash(bi, course, seed + 61) > 0.78) {                                              // a knocked corner: a bite out of one corner of the block
      const cx = hash(bi, course, seed + 62) > 0.5 ? 0.06 : 0.94, cy = hash(bi, course, seed + 63) > 0.5 ? 0.08 : 0.92;
      const d2 = ((fx - cx) / 0.3) ** 2 + ((fy - cy) / 0.3) ** 2;
      if (d2 < 1) h -= 1.5 * Math.pow(1 - d2, 0.7);
    }
    if (edge >= wobble && crackMask(u, v) > 0.6) {                                         // the albedo's cracks, carved
      const t = Math.abs(crackField(u, v) - 0.5);
      if (t < 0.012) h -= 0.9 * (1 - t / 0.012);
    }
    height[y * size + x] = h;
  }
  // Pitted dents: two layers of seeded hollows (the inverse of the sand's pebbles), fading out down in the mortar grooves.
  const dents = (list: Pebble[], depth: number) => stamp(size, list, (x, y, dome) => { const i = y * size + x; height[i] -= dome * depth * (0.55 + 0.45 * Math.tanh(height[i] + 1.5)); });
  dents(pebbles(size, Math.round(size * size / 900), seed + 65, 1, size / 128), 0.5);
  dents(pebbles(size, Math.round(size * size / 16000), seed + 67, size / 96, size / 36), 1.1);
  return pixels(size, size, (_u, _v, x, y) => {
    const at = (i: number, j: number) => height[((j + size) % size) * size + (i + size) % size], dx = (at(x + 1, y) - at(x - 1, y)) * 0.9, dy = (at(x, y + 1) - at(x, y - 1)) * 0.9, l = Math.hypot(dx, dy, 1);
    return [128 - 127 * dx / l, 128 - 127 * dy / l, 128 + 127 / l];
  });
}
// The sky: an ash-grey dome, its horizon the scene's fog colour so the dome and the fog meet, with one break of light around the sun.
// Equirectangular: u around, v from the horizon (0.5) to the zenith (1). `sunU` is the sun's azimuth on the dome's u axis.
export function skyPixels(width = 512, height = 256, sunU = 0.86, sunV = 0.77, seed = 19): Pixels {
  const cloud = fbm(4, 4, seed), wisp = fbm(12, 3, seed + 3);
  return pixels(width, height, (u, v) => {
    const up = Math.max(0, (v - 0.5) * 2), du = Math.min(Math.abs(u - sunU), 1 - Math.abs(u - sunU)) * 2.2, dv = (v - sunV) * 2.8, sun = Math.exp(-(du * du + dv * dv) * 2.4);
    const c = cloud(u, v * 2) - 0.5, w = wisp(u, v * 3) - 0.5, shade = 1 - 0.32 * up + 0.14 * c + 0.05 * w;
    return [169 * shade + 70 * sun, 168 * shade * 0.98 + 52 * sun, 156 * shade * 0.94 + 30 * sun];
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
// A torn banner: a cut mask. Ragged hem, frayed sides, a few holes; the cloth colour is the material's.
export function bannerAlpha(width = 128, height = 256, seed = 31): Pixels {
  const hem = fbm(6, 3, seed), holes = fbm(5, 3, seed + 3), fray = fbm(10, 2, seed + 5);
  return pixels(width, height, (u, v) => {
    const torn = v < 0.28 + 0.2 * (hem(u, 0.5) - 0.5) + 0.06 * (fray(u, v) - 0.5), side = Math.min(u, 1 - u) < 0.05 * fray(v, u), hole = holes(u, v) > 0.72 && v < 0.75;
    const a = torn || side || hole ? 0 : 255; return [a, a, a, a];   // three.js reads an alphaMap from the green channel: the mask fills every channel
  });
}
// A brazier flame: fat and orange-red (owner 2026-09-18: the first pass read as a thin yellow sword — too narrow, too white,
// pumped up and down; then "fatter still" — body width 0.5 → 0.65 with the quads widened to match; then "70–80 % of the pot,
// less pointy, frayed and separated, gritty not cartoon"). A small warm heart low down, an orange body, deep red edges; drifting
// slots split the upper half into separate tongues, high-frequency fray bites the silhouette, and the tip dies in a ragged line.
// Additive-blended on three crossed quads; the arena leans and waves it per frame, so the texture itself stays static.
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function flamePixels(width = 128, height = 256, seed = 37): Pixels {
  const lick = fbm(5, 3, seed), wisp = fbm(9, 2, seed + 3, 0.6), fray = fbm(14, 2, seed + 7), grain = fbm(24, 1, seed + 11);
  return pixels(width, height, (u, v) => {
    // v: 0 at the base, 1 at the tip. A blunt fat body widest low, still broad at mid-height.
    const body = Math.pow(1 - v, 0.42) * Math.min(1, v * 4), w = 0.88 * body * (0.72 + 0.4 * lick(u, v * 2));
    const d = w > 0 ? Math.abs(u - 0.5) / w : 2, edge = Math.max(0, 1 - d);
    // separation: slots that drift outward with height carve the upper flame into 2–3 tongues
    let slot = 0;
    for (const c0 of [-0.2, 0.16]) {
      const c = 0.5 + c0 * (0.5 + v), spread = 0.003 + 0.006 * Math.max(0, v - 0.35);
      slot = Math.max(slot, Math.exp(-((u - c) ** 2) / spread));
    }
    const carve = slot * smoothstep(0.3, 0.7, v) * 0.9;
    // fray: high-frequency bites, deeper toward the tip; the centre column survives (that is what keeps it fire, not smoke)
    const bite = smoothstep(0.38, 0.66, fray(u * 1.9, v * 1.4) * (0.5 + 0.85 * v) + edge * 0.42);
    // ragged tip: full below ~0.78, noise-eaten to nothing by ~1.0
    const tip = smoothstep(1.0, 0.78, v + 0.16 * (fray(u * 3.1, 0.7) - 0.5));
    const a = Math.pow(edge, 1.15) * (1 - 0.12 * v) * (0.85 + 0.3 * wisp(u, v)) * bite * (1 - carve) * tip;
    const heart = Math.max(0, 1 - d * 2.6) * Math.max(0, 1 - v * 1.6);
    const grit = 0.88 + 0.24 * grain(u * 4, v * 4);   // per-pixel sooty grain so it never reads flat-shaded
    return [(205 + 50 * heart) * grit, (55 + 65 * (1 - d) * (1 - v * 0.6) + 80 * heart) * grit, (10 + 14 * (1 - d) + 55 * heart) * grit, Math.round(255 * Math.min(1, a))];
  });
}
// A drifting ash mote: a soft grey speck with gritty edges. One 32² sprite for the whole particle system —
// ash hangs in the air so the arena reads inhabited (world lane 2026-09-18); normal blending, no glow.
export function motePixels(size = 32, seed = 53): Pixels {
  const grit = fbm(8, 2, seed);
  return pixels(size, size, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2, a = Math.max(0, 1 - r) ** 1.6 * (0.55 + 0.45 * grit(u, v));
    const c = 155 + 40 * grit(v, u);
    return [c, c * 0.96, c * 0.9, Math.round(220 * a)];
  });
}
// Battle-wear decals for the sand (world lane 2026-09-18): scorch, trample, streaks, blotch — four quadrants of one 256²
// atlas. RGB is the stain colour (so the decal is lit like the sand it lies on), alpha is the worn edge.
export function sandWearAtlas(size = 256, seed = 71): Pixels {
  const blotch = fbm(6, 3, seed), fine = fbm(16, 2, seed + 5), streak = fbm(4, 4, seed + 9);
  const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return pixels(size, size, (u, v) => {
    const q = u < 0.5 ? (v < 0.5 ? 0 : 2) : (v < 0.5 ? 1 : 3), s = u % 0.5 * 2, t = v % 0.5 * 2;
    const dx = s - 0.5, dy = t - 0.5, r = Math.hypot(dx, dy) * 2;
    let a: number, tone: number;
    if (q === 0) {          // scorch: a heat-bloomed ring, eaten by noise
      const ring = Math.exp(-((r - 0.55) ** 2) / 0.045);
      a = ring * (0.55 + 0.45 * blotch(s * 2, t * 2)) * (1 - sstep(0.7, 1.0, r)) * sstep(0.06, 0.3, r);
      tone = 0.14 + 0.08 * fine(s, t);
    } else if (q === 1) {   // trample: churned mottle, strongest centre
      a = (1 - sstep(0.25, 1.0, r)) * sstep(0.34, 0.72, fine(s * 1.6, t * 1.6)) * 0.85;
      tone = 0.2 + 0.08 * blotch(s, t);
    } else if (q === 2) {   // streaks: long scuff lines, like something dragged
      const band = 1 - sstep(0.0, 0.34, Math.abs(dy + 0.12 * (streak(s * 3, 0.5) - 0.5)));
      a = band * sstep(0.5, 0.85, fine(s * 6, t * 1.2)) * (1 - sstep(0.7, 1.0, Math.abs(dx) * 2)) * 0.8;
      tone = 0.17 + 0.08 * blotch(s * 2, t);
    } else {                // blotch: an old soaked stain with a soft rim
      a = (1 - sstep(0.3, 0.95, r)) * (0.5 + 0.5 * blotch(s * 1.5, t * 1.5)) * sstep(0.05, 0.35, r);
      tone = 0.17 + 0.08 * fine(s, t);
    }
    const k = 255 * tone;
    return [k * 1.02, k * 0.94, k * 0.82, Math.round(235 * Math.min(1, a))];
  });
}
// Gate light (world lane 2026-09-18): one atlas, two halves. v > 0.5 is the sun shaft that spills through the gate arch —
// soft across, streaked like light through bars, fading along its length. v < 0.5 is the warm pool where it lands on the
// sand. Additive: RGB carries the brightness (peak ~half, warm), alpha carries the shape.
export function gateLightAtlas(width = 128, height = 256, seed = 83): Pixels {
  const streaks = fbm(6, 3, seed), dapple = fbm(10, 2, seed + 4);
  return pixels(width, height, (u, v) => {
    if (v >= 0.5) {
      const s = u, t = (v - 0.5) * 2;
      const across = Math.exp(-((s - 0.5) ** 2) / 0.075);
      const bars = 0.6 + 0.4 * Math.max(0, Math.sin(s * 34 + 2.2 * (streaks(s, t) - 0.5)));
      const a = across * bars * (t < 0.12 ? t / 0.12 : 1 - smoothstep(0.62, 1, t)) * (0.75 + 0.25 * streaks(s * 3, t * 2));
      const k = 150 * a;
      return [k, k * 0.9, k * 0.68, 255];
    }
    const s = u, t = v * 2, r = Math.hypot(s - 0.5, t - 0.5) * 2;
    const a = Math.exp(-(r * r) / 0.55) * (0.7 + 0.3 * dapple(s * 2, t * 2)) * (1 - smoothstep(0.75, 1, r));
    const k = 120 * a;
    return [k, k * 0.88, k * 0.64, 255];
  });
}
// Mean linear luminance of an sRGB pixel buffer: the number the contrast rule is written in.
export function luminance(p: Pixels): number {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  let sum = 0; for (let i = 0; i < p.data.length; i += 4) sum += 0.2126 * lin(p.data[i]) + 0.7152 * lin(p.data[i + 1]) + 0.0722 * lin(p.data[i + 2]);
  return sum / (p.data.length / 4);
}

// The Centurion's crest maps (Dom 2026-09-26, rank sheet: the crest read as "a digital paint image sitting in the air"): dyed
// horsehair as strands, so the crest takes the key light like the bronze beside it instead of a flat red slab. Writes
// src/assets/source/loot/horsehair_cloth_{color,orm,normal}.jpg, which build-warrior.mjs picks up for the `HorsehairCloth` material
// (the `<Family>Cloth` rule; grades.ts classes it cloth, so the rank tint leaves it alone). u runs along the crest, v from the root
// (row 0, on the helmet) to the tips. Deterministic: rerun after any change here, then rebuild loot.glb (`WARRIOR_LOOT=1`).
import jpeg from 'jpeg-js';
import { writeFileSync } from 'node:fs';

const W = 256, H = 256, OUT = 'src/assets/source/loot/horsehair_cloth';
const DYE = [0.42, 0.035, 0.025];   // linear-ish madder red, a shade under the old flat Heraldry red so the highlights have room
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
// One strand per ~2 px: each has its own brightness and a slow sideways drift, so the fibres wave rather than rule straight lines.
const STRANDS = 128, strand = Array.from({ length: STRANDS }, (_, i) => ({ tone: .55 + .45 * hash(i + 1), phase: 6.28 * hash(i + 101), sway: 1.5 + 2 * hash(i + 211) }));
function fibre(x, y) {   // height of the hair surface at a texel: 1 on a strand's crest, 0 between strands (tiles in x)
  const v = y / H, own = strand[((Math.floor(x / (W / STRANDS)) % STRANDS) + STRANDS) % STRANDS], drift = x + own.sway * Math.sin(v * 5 + own.phase);
  const f = ((drift % W) + W) % W / (W / STRANDS), i = Math.floor(f) % STRANDS, t = f - Math.floor(f);
  return { h: Math.sin(Math.PI * t) ** .8, tone: strand[i].tone };
}
const color = Buffer.alloc(W * H * 4), orm = Buffer.alloc(W * H * 4), normal = Buffer.alloc(W * H * 4);
const srgb = c => Math.round(255 * Math.min(1, Math.max(0, c)) ** (1 / 2.2));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = 4 * (y * W + x), v = y / H, { h, tone } = fibre(x, y);
  const root = .45 + .55 * Math.min(1, v / .35);   // the roots, bunched in the helmet's saddle, sit in shadow
  const lum = (.35 + .65 * h) * tone * root;
  for (let c = 0; c < 3; c++) color[k + c] = srgb(DYE[c] * (.12 + .95 * lum * lum));
  orm[k] = Math.round(255 * root); orm[k + 1] = Math.round(255 * (.5 + .3 * (1 - h))); orm[k + 2] = 0;   // occlusion, roughness (strand crests glossier), metal 0
  const dx = fibre(x + 1, y).h - fibre(x - 1, y).h, n = [-dx * 1.6, 0, 1], len = Math.hypot(...n);
  for (let c = 0; c < 3; c++) normal[k + c] = Math.round(255 * (n[c] / len * .5 + .5));
  color[k + 3] = orm[k + 3] = normal[k + 3] = 255;
}
for (const [name, data, quality] of [['color', color, 88], ['orm', orm, 90], ['normal', normal, 92]]) {
  const bytes = jpeg.encode({ data, width: W, height: H }, quality).data;
  writeFileSync(`${OUT}_${name}.jpg`, bytes);
  console.log(`${OUT}_${name}.jpg ${W}x${H} ${(bytes.length / 1024).toFixed(1)} KB`);
}

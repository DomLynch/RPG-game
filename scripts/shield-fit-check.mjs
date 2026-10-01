// Shield intake (Strategy's shield ruling 2026-09-30, Lead's budget 2026-09-30): does a GLB fit what a carrier's shield slot can take?
// Usage: node scripts/shield-fit-check.mjs <file.glb> [--carrier=<id>] [--band=plain|crafted|ornate]
// The carrier and band come from a `<carrier>-<band>.glb` name when not given (public/shields/veteran-ornate.glb). Exit 1 on any FAIL.
//
// THE DELIVERY FORMAT (what GPT sends; intake bakes the rig rotation, so GPT never sees rig space):
//   - ONE mesh, one node, one material, real metres; UPRIGHT (board height along +Y), the FACE toward +Z, the back face modelled (the board is
//     seen from behind on the arm), no skin, no animation.
//   - The ORIGIN is the grip point: inside the board's width and height, at least 5 cm from every edge, with the face in front of it (+Z).
//   - Envelope per carrier and band (metres, Strategy's shield brief 2026-09-30; width x, height y, depth z): rounds Ø 0.60 (ranks 1-3, the
//     Centurion 2-3) and Ø 0.70 (4-7), the Centurion's tower <= 0.88 tall x 0.60 wide, the Shieldmaiden's kite <= 0.75 tall x 0.60 wide.
//   - <= 6,000 triangles, verts / unique positions <= 1.6, <= 3 maps each <= 1024 x 1024 (one base + MR (+ normal) set), <= 0.9 MB gzip.
// Finish is GPT's painted one: no rank tint over it (Strategy 2026-09-30). The Centurion has no rank-1 shield (his trident fights at Recruit).
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Vector3 } from 'three';
import { measure } from './weapon-fit-check.mjs';

// Bands follow the weapon shapes (src/weapon-shapes.ts bandOf): plain = ranks 1-3 (the Centurion 2-3), crafted 4-7, ornate 8-10.
export const ENVELOPE = {
  veteran:      { plain: { w: .60, h: .60 }, crafted: { w: .70, h: .70 }, ornate: { w: .60, h: .88, tall: true } },   // the Centurion: round, round richer, tower
  shieldmaiden: { plain: { w: .60, h: .60 }, crafted: { w: .70, h: .70 }, ornate: { w: .60, h: .75, tall: true } },   // round, round richer, kite
};
const TOL = .01;            // a centimetre over the envelope either way on the round diameters
const DEPTH = .14;          // today's boards are 0.069 and 0.110 deep; no ruling caps it, so a deeper board is a WARN to judge in the stills
const EDGE = .05;           // the grip stays this far inside the board's edges
const TRIS = 6000, RATIO = 1.6, GZIP = 900_000;

/** @param {Buffer} bytes @param {{ carrier: string, band: string }} options */
export function fitCheck(bytes, { carrier, band }) {
  const env = ENVELOPE[carrier]?.[band]; if (!env) throw new Error(`no shield envelope for ${carrier} ${band}`);
  const { positions, triangles, vertices, unique, materials, meshNodes, meshes, images } = measure(bytes, 'NoSuchRoot');
  if (!positions.length) throw new Error('no triangles found');
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of positions) { min.min(p); max.max(p); }
  const out = [], add = (rule, ok, detail, soft) => out.push({ rule, status: ok ? 'PASS' : soft ?? 'FAIL', detail });
  const f = (v) => v.toFixed(3), w = max.x - min.x, h = max.y - min.y, d = max.z - min.z;
  add('real metres', w > .3 && w < 1 && h > .3 && h < 1.2, `${f(w)} × ${f(h)} × ${f(d)} m (a shield is 0.3–1.2 m; cm or mm exports fail here)`);
  add('width X', w <= env.w + TOL, `${f(w)} (limit ${env.w})`);
  add('height Y', h <= env.h + TOL, `${f(h)} (limit ${env.h})`);
  add('not undersized', w >= env.w * .85 && h >= env.h * .85, `${f(w)} × ${f(h)} against ${env.w} × ${env.h} (at least 85 %)`, 'WARN');
  add('upright', env.tall ? h > w * 1.1 : Math.abs(h - w) <= Math.max(w, h) * .08, env.tall ? `height ${f(h)} over width ${f(w)}: the long axis is +Y` : `round: ${f(w)} × ${f(h)}`);
  add('depth Z', d <= DEPTH + 1e-6, `${f(d)} (soft limit ${DEPTH})`, 'WARN');
  // The grip at the origin, face in front (+Z): the origin is inside the board's width and height with a margin, and the board has depth forward of it.
  const grip = min.x + EDGE <= 0 && max.x - EDGE >= 0 && min.y + EDGE <= 0 && max.y - EDGE >= 0 && max.z > 0 && min.z > -DEPTH;
  add('origin is the grip, face +Z', grip, `x ${f(min.x)} … ${f(max.x)}, y ${f(min.y)} … ${f(max.y)}, z ${f(min.z)} … ${f(max.z)} (origin ≥ ${EDGE} m inside the edges, face in front)`);
  // Both faces are modelled: the board is seen from behind on the arm, so front- and back-facing area each carry a fifth or more.
  let front = 0, back = 0, total = 0;
  for (const [a, b, c] of triangles) {
    const n = positions[b].clone().sub(positions[a]).cross(positions[c].clone().sub(positions[a])), area = n.length() / 2; total += area;
    if (area > 0) { const z = n.z / (2 * area); if (z > .3) front += area; else if (z < -.3) back += area; }
  }
  add('back face modelled', total > 0 && front / total >= .2 && back / total >= .2, `front-facing ${(100 * front / (total || 1)).toFixed(0)} %, back-facing ${(100 * back / (total || 1)).toFixed(0)} % of the surface`);
  add('triangles', triangles.length <= TRIS, `${triangles.length} (cap ${TRIS})`);
  const ratio = vertices / unique;
  add('verts ÷ unique positions', ratio <= RATIO, `${ratio.toFixed(2)} (${vertices} / ${unique}; cap ${RATIO})`);
  const big = images.filter(([iw, ih]) => !(iw <= 1024 && ih <= 1024));
  add('maps ≤ 3 at ≤ 1024', images.length <= 3 && !big.length, `${images.length} image(s): ${images.map(([iw, ih]) => `${iw}×${ih}`).join(', ') || 'none'}`);
  add('one node, one mesh, one material', meshNodes === 1 && meshes === 1 && materials === 1, `${meshNodes} mesh node(s), ${meshes} mesh(es), ${materials} material(s)`);
  const gz = gzipSync(bytes, { level: 9 }).length;
  add('≤ 0.9 MB gzip', gz <= GZIP, `${gz} B gzip (cap ${GZIP}; a character's three files total ≤ 2.7 MB, check-budget)`);
  return out;
}

const nameOf = (file) => /^(?<carrier>[a-z]+)-(?<band>plain|crafted|ornate)\.glb$/.exec(basename(file))?.groups;
if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, ...flags] = process.argv.slice(2), opt = Object.fromEntries(flags.map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
  if (!file) { console.error('usage: node scripts/shield-fit-check.mjs <file.glb> [--carrier=<id>] [--band=plain|crafted|ornate]'); process.exit(2); }
  const named = nameOf(file), carrier = opt.carrier ?? named?.carrier, band = opt.band ?? named?.band;
  if (!carrier || !band) { console.error(`${file}: name it <carrier>-<band>.glb or pass --carrier and --band`); process.exit(2); }
  const results = fitCheck(readFileSync(file), { carrier, band });
  console.log(`${basename(file)} — ${carrier} ${band}`);
  for (const { rule, status, detail } of results) console.log(`  ${status.padEnd(4)}  ${rule}: ${detail}`);
  const failed = results.some((r) => r.status === 'FAIL');
  console.log(failed ? 'FAIL' : 'PASS'); process.exit(failed ? 1 : 0);
}

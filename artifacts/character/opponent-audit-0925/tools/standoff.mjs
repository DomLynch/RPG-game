// Closest-point standoff of the tunic over the body's back/front, by height band. Usage: node standoff.mjs <body.glb> <kit.glb> <bodyMesh> <tunicMesh|material>
import fs from 'node:fs';
const [bodyFile, kitFile, bodySel, tunicSel] = process.argv.slice(2);
const rd = f => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return { j: JSON.parse(b.slice(20, 20 + n)), bin: b.slice(20 + n + 8) }; };
const acc = (G, i) => { const a = G.j.accessors[i], bv = G.j.bufferViews[a.bufferView], off = (bv.byteOffset || 0) + (a.byteOffset || 0), nc = a.type === 'VEC3' ? 3 : 1, cs = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5123 ? 2 : 1, st = bv.byteStride || nc * cs, r = [];
  const rdv = o => a.componentType === 5126 ? G.bin.readFloatLE(o) : a.componentType === 5125 ? G.bin.readUInt32LE(o) : a.componentType === 5123 ? G.bin.readUInt16LE(o) : G.bin[o];
  for (let k = 0; k < a.count; k++) { const v = []; for (let c = 0; c < nc; c++) v.push(rdv(off + k * st + c * cs)); r.push(nc === 1 ? v[0] : v); } return r; };
const grab = (G, sel) => { const P = [], T = []; for (const nd of G.j.nodes) { if (nd.mesh == null) continue; for (const p of G.j.meshes[nd.mesh].primitives) { const m = p.material != null && G.j.materials ? G.j.materials[p.material].name : '';
  if (nd.name !== sel && m !== sel) continue; const base = P.length, pos = acc(G, p.attributes.POSITION); P.push(...pos); const I = p.indices != null ? acc(G, p.indices) : pos.map((_, i) => i); for (let t = 0; t < I.length; t += 3) T.push([base + I[t], base + I[t + 1], base + I[t + 2]]); } } return { P, T }; };
const body = grab(rd(bodyFile), bodySel), tunic = grab(rd(kitFile), tunicSel);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], add = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
function closest(p, a, b, c) { // Ericson, Real-Time Collision Detection 5.1.5
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b; const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, ab, d1 / (d1 - d3));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c; const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, ac, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
  const den = 1 / (va + vb + vc); return add(add(a, ab, vb * den), ac, vc * den); }
const tris = tunic.T.map(t => t.map(i => tunic.P[i]));
for (const [side, sel] of [['FRONT', z => z > 0.11], ['BACK', z => z < 0.03]]) for (const [lo, hi] of [[0.95, 1.1], [1.1, 1.25], [1.25, 1.35], [1.35, 1.5]]) {
  const d = [];
  for (const v of body.P) { if (v[1] < lo || v[1] >= hi || Math.abs(v[0]) > 0.2 || !sel(v[2])) continue;
    let best = null, bd = 1e9; for (const t of tris) { const q = closest(v, ...t), dd = dot(sub(q, v), sub(q, v)); if (dd < bd) { bd = dd; best = q; } }
    if (Math.sqrt(bd) > 0.05) continue;   // uncovered skin (neckline, armholes): not this check's business
    const axis = [0, v[1], 0.07], out = Math.hypot(best[0] - axis[0], best[2] - axis[2]) - Math.hypot(v[0] - axis[0], v[2] - axis[2]); d.push(out); }
  d.sort((a, b) => a - b); const q = p => d.length ? (d[Math.floor(p * (d.length - 1))] * 1000).toFixed(1) : '-';
  console.log(`${side.padEnd(5)} y ${lo.toFixed(2)}–${hi.toFixed(2)}  n ${String(d.length).padStart(3)}  standoff mm p10 ${q(.1)} median ${q(.5)}  inside ${d.filter(x => x < 0).length}`); }

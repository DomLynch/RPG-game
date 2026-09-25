import fs from 'node:fs';
const [file, sel] = process.argv.slice(2);
const b = fs.readFileSync(file), n = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + n)), bin = b.slice(20 + n + 8);
const acc = i => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], off = (bv.byteOffset || 0) + (a.byteOffset || 0), nc = a.type === 'VEC3' ? 3 : 1, cs = a.componentType === 5123 ? 2 : 4, st = bv.byteStride || nc * cs, r = [];
  for (let k = 0; k < a.count; k++) { const v = []; for (let c = 0; c < nc; c++) { const o = off + k * st + c * cs; v.push(a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5125 ? bin.readUInt32LE(o) : bin.readUInt16LE(o)); } r.push(nc === 1 ? v[0] : v); } return r; };
for (const nd of j.nodes) { if (nd.mesh == null || nd.name !== sel) continue; for (const p of j.meshes[nd.mesh].primitives) {
  const P = acc(p.attributes.POSITION), N = p.attributes.NORMAL != null ? acc(p.attributes.NORMAL) : null, I = acc(p.indices);
  for (const [lo, hi, side] of [[0.95, 1.25, 'back'], [1.25, 1.5, 'back'], [1.25, 1.5, 'front']]) {
    let tri = 0, triIn = 0, vn = 0, vnIn = 0; const seen = new Set();
    for (let t = 0; t < I.length; t += 3) { const [a, c, d] = [P[I[t]], P[I[t + 1]], P[I[t + 2]]], m = [0, 1, 2].map(k => (a[k] + c[k] + d[k]) / 3);
      if (m[1] < lo || m[1] >= hi || Math.abs(m[0]) > 0.2 || (side === 'back' ? m[2] > 0.03 : m[2] < 0.11)) continue;
      const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]], nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const radial = [m[0], 0, m[2] - 0.07]; tri++; if (nrm[0] * radial[0] + nrm[2] * radial[2] < 0) triIn++;
      if (N) for (const k of [I[t], I[t + 1], I[t + 2]]) if (!seen.has(k)) { seen.add(k); vn++; const q = P[k], w = N[k]; if (w[0] * q[0] + w[2] * (q[2] - 0.07) < 0) vnIn++; } }
    console.log(`${sel} ${side} y ${lo}–${hi}: triangles ${tri}, wound inward ${triIn} | vertex normals ${vn}, inward ${vnIn}`); } } }

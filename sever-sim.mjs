// What sever() does per mesh: triangles averaging >= .5 Head go with the head; the rest stay, and Head scales to ~0,
// so a kept vertex with Head weight w moves by ~ w * |v - headJoint| (bind pose). Report per mesh.
import { readFile } from 'node:fs/promises';
import { MeshoptDecoder } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import { parseGlb } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/scripts/glb-equivalence.mjs';
await MeshoptDecoder.ready;
for (const f of process.argv.slice(2)) {
  const { doc, bin } = parseGlb(await readFile(f));
  const view = (id) => { const v = doc.bufferViews[id], e = v.extensions?.EXT_meshopt_compression;
    if (!e) return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const out = Buffer.alloc(e.count * e.byteStride); MeshoptDecoder.decodeGltfBuffer(out, e.count, e.byteStride, bin.subarray(e.byteOffset || 0, (e.byteOffset || 0) + e.byteLength), e.mode, e.filter || 'NONE'); return out; };
  const acc = (i) => { const a = doc.accessors[i], v = doc.bufferViews[a.bufferView], b = view(a.bufferView), w = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type], sz = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType], st = v.byteStride || w * sz, off = a.byteOffset || 0;
    const norm = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType];
    const rd = (k, c) => { const p = off + k * st + c * sz; const ct = a.componentType; let x = ct === 5126 ? b.readFloatLE(p) : ct === 5125 ? b.readUInt32LE(p) : ct === 5123 ? b.readUInt16LE(p) : ct === 5122 ? b.readInt16LE(p) : ct === 5121 ? b.readUInt8(p) : b.readInt8(p); return a.normalized ? Math.max(x / norm, -1) : x; };
    return { count: a.count, rd }; };
  console.log('==', f.split('/').pop());
  for (const n of doc.nodes) { if (n.mesh == null || n.skin == null) continue;
    const skin = doc.skins[n.skin], hj = skin.joints.findIndex((j) => doc.nodes[j].name === 'Head'); if (hj < 0) continue;
    const ibm = acc(skin.inverseBindMatrices), m = [...Array(16)].map((_, c) => ibm.rd(hj, c));
    // head joint position in mesh bind space = -R^T t of the IBM (column-major)
    const t = [m[12], m[13], m[14]], hp = [0, 1, 2].map((r) => -(m[r * 4] * t[0] + m[r * 4 + 1] * t[1] + m[r * 4 + 2] * t[2]));
    let tris = 0, gone = 0, keptPartial = 0, maxMove = 0, sumMove = 0;
    for (const p of doc.meshes[n.mesh].primitives) {
      const P = acc(p.attributes.POSITION), J = acc(p.attributes.JOINTS_0), W = acc(p.attributes.WEIGHTS_0), I = p.indices != null ? acc(p.indices) : null;
      // positions may be quantized with a node transform (KHR_mesh_quantization): apply the mesh node's matrix/TRS scale+translation
      const s = n.scale || [1, 1, 1], tr = n.translation || [0, 0, 0];
      const pos = (k) => [0, 1, 2].map((c) => P.rd(k, c) * s[c] + tr[c]);
      const hw = (k) => { let w = 0; for (let c = 0; c < 4; c++) if (J.rd(k, c) === hj) w += W.rd(k, c); return w; };
      const count = I ? I.count : P.count;
      for (let i = 0; i < count; i += 3) { tris++;
        const vs = [0, 1, 2].map((k) => (I ? I.rd(i + k, 0) : i + k)), avg = vs.reduce((a, k) => a + hw(k), 0) / 3;
        if (avg >= .5) { gone++; continue; }
        for (const k of vs) { const w = hw(k); if (w <= 0) continue; keptPartial++; const q = pos(k), d = Math.hypot(q[0] - hp[0], q[1] - hp[1], q[2] - hp[2]) * w; maxMove = Math.max(maxMove, d); sumMove += d; } } }
    if (gone || keptPartial) console.log(`  ${n.name}: tris ${tris}, with head ${gone} (${(100 * gone / tris).toFixed(1)}%), kept verts w/ Head>0 ${keptPartial}, collapse move max ${(maxMove * 100).toFixed(1)} cm mean ${(keptPartial ? sumMove / keptPartial * 100 : 0).toFixed(1)} cm`);
  }
}

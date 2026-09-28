import { readFile } from 'node:fs/promises';
import { MeshoptDecoder } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import { parseGlb } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/scripts/glb-equivalence.mjs';
await MeshoptDecoder.ready;
for (const f of process.argv.slice(2)) {
  const { doc, bin } = parseGlb(await readFile(f));
  const view = (id) => { const v = doc.bufferViews[id], e = v.extensions?.EXT_meshopt_compression;
    if (!e) return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const out = Buffer.alloc(e.count * e.byteStride); MeshoptDecoder.decodeGltfBuffer(out, e.count, e.byteStride, bin.subarray(e.byteOffset || 0, (e.byteOffset || 0) + e.byteLength), e.mode, e.filter || 'NONE'); return out; };
  const acc = (i) => { const a = doc.accessors[i], v = doc.bufferViews[a.bufferView], b = view(a.bufferView), w = { SCALAR: 1, VEC4: 4 }[a.type], sz = { 5121: 1, 5123: 2, 5126: 4 }[a.componentType], st = v.byteStride || w * sz, off = a.byteOffset || 0;
    const rd = (k, c) => { const p = off + k * st + c * sz; return a.componentType === 5126 ? b.readFloatLE(p) : a.componentType === 5123 ? b.readUInt16LE(p) / (a.normalized ? 65535 : 1) : b.readUInt8(p) / (a.normalized ? 255 : 1); };
    return { count: a.count, rd }; };
  const out = [];
  for (const n of doc.nodes) { if (n.mesh == null || n.skin == null) continue;
    const joints = doc.skins[n.skin].joints.map((j) => doc.nodes[j].name); const tally = {}; let tot = 0;
    for (const p of doc.meshes[n.mesh].primitives) { const J = acc(p.attributes.JOINTS_0), W = acc(p.attributes.WEIGHTS_0);
      for (let k = 0; k < J.count; k++) for (let c = 0; c < 4; c++) { const w = W.rd(k, c); if (w > 0) { const name = joints[Math.round(J.rd(k, c) * (doc.accessors[p.attributes.JOINTS_0].normalized ? 255 : 1))] ; tally[name] = (tally[name] || 0) + w; tot += w; } } }
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(1)}%`).join(', ');
    out.push(`  ${n.name}: ${top}`); }
  console.log(f.split('/').pop()); console.log(out.join('\n'));
}

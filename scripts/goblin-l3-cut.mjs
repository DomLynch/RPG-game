// Goblin L3 (Dom's GPT mid-tier study, 2026-09-27): cut the generated armour primitives of a whole-body creature GLB to a triangle
// budget IN PLACE at the GLB level — meshopt simplify (LockBorder) on each target primitive's index buffer, new index accessors
// appended to the binary chunk; vertices, skins, weights, animations, images and materials are untouched (the file stays a
// drop-in for src/assets/goblin.glb). Usage:
//   node scripts/goblin-l3-cut.mjs --in <glb> --out <glb> [--match geometry_] [--tris 20000] [--error 0.05]
import fs from 'node:fs/promises';
import { MeshoptSimplifier } from 'meshoptimizer';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const IN = arg('--in'), OUT = arg('--out'), MATCH = arg('--match', 'geometry_'), TRIS = Number(arg('--tris', 20000)), ERR = Number(arg('--error', 0.05));
const glb = await fs.readFile(IN);
const jsonLen = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString()), binLen = glb.readUInt32LE(20 + jsonLen), bin = glb.subarray(28 + jsonLen, 28 + jsonLen + binLen);
const acc = json.accessors, bvs = json.bufferViews;
const read = (ai) => { const a = acc[ai], bv = bvs[a.bufferView], off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0); const C = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType]; const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]; if (bv.byteStride && bv.byteStride !== n * C.BYTES_PER_ELEMENT) throw new Error('strided accessor'); return new C(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * n * C.BYTES_PER_ELEMENT)); };
const targets = []; let total = 0;
for (const m of json.meshes) if (m.name?.includes(MATCH)) for (const p of m.primitives) { const t = acc[p.indices].count / 3; targets.push({ m, p, t }); total += t; }
await MeshoptSimplifier.ready;
const chunks = [bin]; let binOff = binLen; const cut = [];
for (const { m, p, t } of targets) {
  const target = Math.max(3, Math.round(TRIS * t / total)) * 3; if (t * 3 <= target) continue;
  const idx = Uint32Array.from(read(p.indices)), pos = read(p.attributes.POSITION);
  const [out, err] = MeshoptSimplifier.simplify(idx, pos, 3, target, ERR, ['LockBorder']);
  // Compaction: only the vertices the cut still references are written (the simplify keeps every original vertex otherwise, and the
  // bytes of a look are mostly vertices); every attribute of the primitive is gathered by the same remap, POSITION keeps its min/max.
  const used = new Map(); const remapped = new Uint32Array(out.length); for (let i = 0; i < out.length; i++) { let r = used.get(out[i]); if (r === undefined) { r = used.size; used.set(out[i], r); } remapped[i] = r; }
  const order = [...used.keys()];
  const append = (arr, target, extra = {}) => { const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - bytes.length % 4) % 4; bvs.push({ buffer: 0, byteOffset: binOff, byteLength: bytes.length, target }); chunks.push(bytes, Buffer.alloc(pad)); binOff += bytes.length + pad; acc.push({ bufferView: bvs.length - 1, ...extra }); return acc.length - 1; };
  for (const [name, ai] of Object.entries(p.attributes)) { const a = acc[ai], src = read(ai), n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], dst = new src.constructor(order.length * n); order.forEach((v, r) => { for (let k = 0; k < n; k++) dst[r * n + k] = src[v * n + k]; }); const extra = { componentType: a.componentType, count: order.length, type: a.type, ...(a.normalized ? { normalized: true } : {}) }; if (name === 'POSITION') { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (let r = 0; r < order.length; r++) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], dst[r * 3 + k]); max[k] = Math.max(max[k], dst[r * 3 + k]); } extra.min = min; extra.max = max; } p.attributes[name] = append(dst, 34962, extra); }
  p.indices = append(remapped, 34963, { componentType: 5125, count: remapped.length, type: 'SCALAR' }); cut.push(`${m.name} ${t}→${out.length / 3} tris, ${pos.length / 3}→${order.length} verts (err ${err.toFixed(3)})`);
}
// GC: the replaced attribute and index accessors and their bufferViews are dropped; only what meshes, skins, animations and images
// still reference is written, accessors and bufferViews renumbered, the binary rebuilt from the live views (aligned to 4).
const fullBin = Buffer.concat(chunks);
const liveAcc = new Set(); for (const m of json.meshes) for (const p of m.primitives) { for (const v of Object.values(p.attributes)) liveAcc.add(v); if (p.indices !== undefined) liveAcc.add(p.indices); for (const t of p.targets ?? []) for (const v of Object.values(t)) liveAcc.add(v); }
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices !== undefined) liveAcc.add(sk.inverseBindMatrices);
for (const an of json.animations ?? []) for (const sm of an.samplers) { liveAcc.add(sm.input); liveAcc.add(sm.output); }
const accMap = new Map([...liveAcc].sort((x, y) => x - y).map((v, i) => [v, i])); const liveBV = new Set();
for (const v of liveAcc) { const a = acc[v]; if (a.bufferView !== undefined) liveBV.add(a.bufferView); if (a.sparse) { liveBV.add(a.sparse.indices.bufferView); liveBV.add(a.sparse.values.bufferView); } }
for (const im of json.images ?? []) if (im.bufferView !== undefined) liveBV.add(im.bufferView);
const bvMap = new Map([...liveBV].sort((x, y) => x - y).map((v, i) => [v, i])); const parts = []; let off = 0; const newBVs = [];
for (const [old] of bvMap) { const bv = bvs[old], bytes = fullBin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength), pad = (4 - bytes.length % 4) % 4; newBVs.push({ ...bv, byteOffset: off }); parts.push(bytes, Buffer.alloc(pad)); off += bytes.length + pad; }
json.bufferViews = newBVs; json.accessors = [...accMap.keys()].map(v => { const a = { ...acc[v] }; if (a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView); if (a.sparse) { a.sparse = { ...a.sparse, indices: { ...a.sparse.indices, bufferView: bvMap.get(a.sparse.indices.bufferView) }, values: { ...a.sparse.values, bufferView: bvMap.get(a.sparse.values.bufferView) } }; } return a; });
for (const m of json.meshes) for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) p.attributes[k] = accMap.get(p.attributes[k]); if (p.indices !== undefined) p.indices = accMap.get(p.indices); for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = accMap.get(t[k]); }
for (const sk of json.skins ?? []) if (sk.inverseBindMatrices !== undefined) sk.inverseBindMatrices = accMap.get(sk.inverseBindMatrices);
for (const an of json.animations ?? []) for (const sm of an.samplers) { sm.input = accMap.get(sm.input); sm.output = accMap.get(sm.output); }
for (const im of json.images ?? []) if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView);
const newBin = Buffer.concat(parts); json.buffers[0].byteLength = newBin.length;
const js = Buffer.from(JSON.stringify(json)); const jpad = (4 - js.length % 4) % 4; const jsP = Buffer.concat([js, Buffer.alloc(jpad, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + jsP.length + newBin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsP.length, 0); jh.write('JSON', 4); const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.write('BIN\0', 4);
await fs.writeFile(OUT, Buffer.concat([head, jh, jsP, bh, newBin]));
const after = json.meshes.reduce((s, m) => s + m.primitives.reduce((q, p) => q + json.accessors[p.indices].count / 3, 0), 0);
console.log(`goblin-l3-cut: ${targets.length} armour primitives ${total} tris → budget ${TRIS}; file tris ${after}; ${(await fs.stat(OUT)).size} bytes\n  ` + cut.join('\n  '));

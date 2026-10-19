// Split a kit GLB into one self-contained GLB per top-level node (World, Test Zone B2b): each building then loads on its own, lazily, and stays under the per-file world cap
// (check-budget.mjs WORLD_FILE). Bit-exact: accessors, buffer views, materials, textures and images are copied untouched into the new file; only the buffer is rebuilt.
//   node scripts/split-glb.mjs <kit.glb> <out-dir>      writes <out-dir>/<node name>.glb for every node of the default scene that has a mesh
// Source must be one embedded buffer and uncompressed (the same contract as optimize-glb.mjs); pack each output with scripts/pack-world-body.mjs afterwards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942, ALIGN = 4;
const pad = (n) => (ALIGN - (n % ALIGN)) % ALIGN;

export function readGlb(raw) {
  assert.equal(raw.readUInt32LE(0), GLB_MAGIC, 'Expected GLB');
  const n = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + n)), bin = raw.subarray(28 + n);
  assert.equal(doc.buffers.length, 1, 'Split requires one embedded buffer');
  return { doc, bin };
}
export function writeGlb(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc)), jp = Buffer.concat([json, Buffer.alloc(pad(json.length), 0x20)]), bp = Buffer.concat([bin, Buffer.alloc(pad(bin.length))]);
  const head = Buffer.alloc(12 + 8), tail = Buffer.alloc(8);
  head.writeUInt32LE(GLB_MAGIC, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8); head.writeUInt32LE(jp.length, 12); head.writeUInt32LE(JSON_CHUNK, 16);
  tail.writeUInt32LE(bp.length, 0); tail.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([head, jp, tail, bp]);
}

/** One node of `doc` as its own { doc, bin }: only the mesh, materials, textures, images, samplers, accessors and buffer views it reaches, renumbered. */
export function extractNode(doc, bin, nodeIndex) {
  const node = doc.nodes[nodeIndex], pick = (map, from, i) => { if (i === undefined) return undefined; if (!map.has(i)) { map.set(i, map.size); out[from].push(structuredClone(doc[from][i])); } return map.get(i); };
  const out = { accessors: [], bufferViews: [], materials: [], textures: [], images: [], samplers: [], meshes: [] };
  const acc = new Map(), bv = new Map(), mat = new Map(), tex = new Map(), img = new Map(), smp = new Map(), mesh = new Map();
  const chunks = [];
  const viewOf = (i) => { if (i === undefined) return undefined; if (!bv.has(i)) { const v = doc.bufferViews[i], at = chunks.reduce((s, c) => s + c.length + pad(c.length), 0); chunks.push(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)); bv.set(i, out.bufferViews.length); out.bufferViews.push({ ...structuredClone(v), buffer: 0, byteOffset: at }); } return bv.get(i); };
  const accessorOf = (i) => { if (i === undefined) return undefined; if (!acc.has(i)) { const a = structuredClone(doc.accessors[i]); assert.ok(!a.sparse, 'sparse accessors are not split'); a.bufferView = viewOf(a.bufferView); acc.set(i, out.accessors.length); out.accessors.push(a); } return acc.get(i); };
  const textureOf = (i) => { if (i === undefined) return undefined; if (!tex.has(i)) { const t = structuredClone(doc.textures[i]); if (t.source !== undefined) { if (!img.has(t.source)) { const im = structuredClone(doc.images[t.source]); im.bufferView = viewOf(im.bufferView); img.set(t.source, out.images.length); out.images.push(im); } t.source = img.get(t.source); } if (t.sampler !== undefined) t.sampler = pick(smp, 'samplers', t.sampler); tex.set(i, out.textures.length); out.textures.push(t); } return tex.get(i); };
  const rewriteTextures = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (k.endsWith('Texture') && v?.index !== undefined) v.index = textureOf(v.index); else rewriteTextures(v); } };
  const materialOf = (i) => { if (i === undefined) return undefined; if (!mat.has(i)) { const m = structuredClone(doc.materials[i]); rewriteTextures(m); mat.set(i, out.materials.length); out.materials.push(m); } return mat.get(i); };
  assert.ok(node.mesh !== undefined && !node.children?.length && node.skin === undefined, `node ${nodeIndex}: only mesh leaves are split`);
  const m = structuredClone(doc.meshes[node.mesh]);
  for (const p of m.primitives) { p.attributes = Object.fromEntries(Object.entries(p.attributes).map(([k, a]) => [k, accessorOf(a)])); p.indices = accessorOf(p.indices); p.material = materialOf(p.material); for (const t of p.targets ?? []) assert.fail('morph targets are not split'); if (p.material === undefined) delete p.material; if (p.indices === undefined) delete p.indices; }
  mesh.set(node.mesh, 0); out.meshes.push(m);
  const bytes = []; let at = 0; for (const c of chunks) { bytes.push(c, Buffer.alloc(pad(c.length))); at += c.length + pad(c.length); }
  const body = Buffer.concat(bytes);
  const next = { asset: doc.asset, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ ...structuredClone(node), mesh: 0 }], meshes: out.meshes, accessors: out.accessors, bufferViews: out.bufferViews, buffers: [{ byteLength: body.length }] };
  for (const k of ['materials', 'textures', 'images', 'samplers']) if (out[k].length) next[k] = out[k];
  const used = (doc.extensionsUsed ?? []).filter((e) => JSON.stringify(next).includes(e)); if (used.length) next.extensionsUsed = used;
  return { doc: next, bin: body, name: node.name };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, outDir] = process.argv.slice(2);
  if (!input || !outDir) throw new Error('usage: node scripts/split-glb.mjs <kit.glb> <out-dir>');
  const { doc, bin } = readGlb(fs.readFileSync(input)); fs.mkdirSync(outDir, { recursive: true });
  const roots = doc.scenes[doc.scene ?? 0].nodes;
  for (const i of roots) { const { doc: d, bin: b, name } = extractNode(doc, bin, i), file = path.join(outDir, `${name}.glb`), buf = writeGlb(d, b); fs.writeFileSync(file, buf); console.log(`${name}: ${buf.length} bytes`); }
}

// Put the HERO'S OWN sword (the two rigid meshes under SwordDrawn / SwordSheathed in src/assets/warrior.glb) into a candidate hero GLB whose sword meshes are placeholders
// (OpenTrident's hero-mixamo-exo-mx.glb: its SwordDrawn / SwordSheathed nodes are already placed for its hand and pelvis, the placeholder blades have the hero's extents).
// Only the children of those two nodes change: `WeaponDrawn_1` (blade, WeaponLongsword) and `WeaponDrawn_2` (grip, WeaponLongswordShaft) as in the hero, mesh data and textures copied.
//   node scripts/character/graft-hero-sword.mjs <candidate.glb> <out.glb> [hero.glb = src/assets/warrior.glb on trunk, via git show]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const [candFile, outFile, heroFile] = process.argv.slice(2);
assert.ok(candFile && outFile, 'usage: graft-hero-sword.mjs <candidate.glb> <out.glb> [hero.glb]');
const parse = (buf) => { const n = buf.readUInt32LE(12); return { j: JSON.parse(buf.subarray(20, 20 + n)), bin: Buffer.from(buf.subarray(28 + n)) }; };
const C = parse(fs.readFileSync(candFile));
const H = parse(heroFile ? fs.readFileSync(heroFile) : execFileSync('git', ['show', 'origin/codex/01a09a76/task-1:src/assets/warrior.glb'], { maxBuffer: 1 << 28 }));
const j = C.j; let bin = C.bin;
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
bin = pad4(bin);
const addView = (bytes, extra = {}) => { j.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length, ...extra }); bin = Buffer.concat([bin, pad4(bytes)]); return j.bufferViews.length - 1; };
const viewCache = new Map(), accCache = new Map(), imgCache = new Map(), texCache = new Map(), matCache = new Map();
const copyView = (i) => { if (!viewCache.has(i)) { const v = H.j.bufferViews[i]; viewCache.set(i, addView(Buffer.from(H.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)), { ...(v.byteStride ? { byteStride: v.byteStride } : {}), ...(v.target ? { target: v.target } : {}) })); } return viewCache.get(i); };
const copyAcc = (i) => { if (!accCache.has(i)) { const a = { ...H.j.accessors[i] }; assert.ok(a.bufferView !== undefined && !a.sparse); a.bufferView = copyView(a.bufferView); j.accessors.push(a); accCache.set(i, j.accessors.length - 1); } return accCache.get(i); };
const copyTex = (t) => {
  if (!t) return t;
  if (!texCache.has(t.index)) {
    const src = H.j.textures[t.index], im = H.j.images[src.source];
    if (!imgCache.has(src.source)) { (j.images ??= []).push({ name: im.name, mimeType: im.mimeType, bufferView: copyView(im.bufferView) }); imgCache.set(src.source, j.images.length - 1); }
    const tex = { source: imgCache.get(src.source) }; if (src.sampler !== undefined) { (j.samplers ??= []).push({ ...H.j.samplers[src.sampler] }); tex.sampler = j.samplers.length - 1; }
    (j.textures ??= []).push(tex); texCache.set(t.index, j.textures.length - 1);
  }
  return { ...t, index: texCache.get(t.index) };
};
const copyMat = (mi) => {
  if (!matCache.has(mi)) {
    const m = JSON.parse(JSON.stringify(H.j.materials[mi])), p = m.pbrMetallicRoughness;
    if (p) { p.baseColorTexture = copyTex(p.baseColorTexture); p.metallicRoughnessTexture = copyTex(p.metallicRoughnessTexture); }
    for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (m[k]) m[k] = copyTex(m[k]);
    assert.ok(!m.extensions, `hero sword material ${m.name} carries extensions`);
    j.materials.push(m); matCache.set(mi, j.materials.length - 1);
  }
  return matCache.get(mi);
};
const heroNode = (name) => H.j.nodes.findIndex((n) => n.name === name);
const meshOf = new Map();   // hero mesh index -> candidate mesh index
const copyMesh = (mi) => {
  if (!meshOf.has(mi)) {
    const m = JSON.parse(JSON.stringify(H.j.meshes[mi]));
    for (const p of m.primitives) { for (const [k, v] of Object.entries(p.attributes)) p.attributes[k] = copyAcc(v); if (p.indices !== undefined) p.indices = copyAcc(p.indices); if (p.material !== undefined) p.material = copyMat(p.material); }
    j.meshes.push(m); meshOf.set(mi, j.meshes.length - 1);
  }
  return meshOf.get(mi);
};
for (const carrier of ['SwordDrawn', 'SwordSheathed']) {
  const hi = heroNode(carrier), ci = j.nodes.findIndex((n) => n.name === carrier);
  assert.ok(hi >= 0 && ci >= 0, `${carrier} missing in hero or candidate`);
  const kids = H.j.nodes[hi].children.map((k) => ({ name: H.j.nodes[k].name, mesh: copyMesh(H.j.nodes[k].mesh), ...(H.j.nodes[k].translation ? { translation: H.j.nodes[k].translation } : {}), ...(H.j.nodes[k].rotation ? { rotation: H.j.nodes[k].rotation } : {}), ...(H.j.nodes[k].scale ? { scale: H.j.nodes[k].scale } : {}) }));
  j.nodes[ci].children = kids.map((n) => { j.nodes.push(n); return j.nodes.length - 1; });
}
j.buffers[0].byteLength = bin.length;
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
head.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
fs.writeFileSync(outFile, Buffer.concat([head, jh, jp, bh, bin]));
console.log(outFile, fs.statSync(outFile).size, 'bytes: hero sword on SwordDrawn and SwordSheathed, placeholders unreferenced');

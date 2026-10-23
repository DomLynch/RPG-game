// usage: node kach-split.mjs <kachujin.glb> <diffuse_body.rgb raw 512x512x3> <out.glb> <kimono material name>
// Splits the red cloth (kimono) of primitive 0 into its own primitive + material (a copy of material 0 with the given name). Geometry, skin, clips untouched: triangles move between two index lists.
import fs from 'node:fs';
const [input, rawFile, output, name] = process.argv.slice(2);
const b = fs.readFileSync(input), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n));
let bin = b.subarray(28 + n);
const rgb = fs.readFileSync(rawFile), SIDE = Math.round(Math.sqrt(rgb.length / 3));
const prim = j.meshes[0].primitives[0];
const view = (a) => { const v = j.bufferViews[a.bufferView]; return (v.byteOffset || 0) + (a.byteOffset || 0); };
const ia = j.accessors[prim.indices], ta = j.accessors[prim.attributes.TEXCOORD_0], tv = j.bufferViews[ta.bufferView];
const idx = new Uint16Array(bin.buffer.slice(bin.byteOffset + view(ia), bin.byteOffset + view(ia) + ia.count * 2));
const stride = tv.byteStride || 4, uvBase = bin.byteOffset + view(ta);
const uv = (i) => [new DataView(bin.buffer).getUint16(uvBase + i * stride, true) / 65535, new DataView(bin.buffer).getUint16(uvBase + i * stride + 2, true) / 65535];
const rest = [], cloth = [];
for (let t = 0; t < idx.length; t += 3) {
  let u = 0, v = 0; for (let k = 0; k < 3; k++) { const [a, c] = uv(idx[t + k]); u += a / 3; v += c / 3; }
  const x = Math.min(SIDE - 1, Math.max(0, Math.floor((u % 1) * SIDE))), y = Math.min(SIDE - 1, Math.max(0, Math.floor((v % 1) * SIDE)));   // glTF uv origin is top-left: the raw is top-down too
  const r = rgb[(y * SIDE + x) * 3], g = rgb[(y * SIDE + x) * 3 + 1], bl = rgb[(y * SIDE + x) * 3 + 2];
  const red = r > 30 && r > 2.1 * g && r > 2.1 * bl;
  (red ? cloth : rest).push(idx[t], idx[t + 1], idx[t + 2]);
}
console.log('kimono triangles', cloth.length / 3, 'of', idx.length / 3);
const pad = (x) => Buffer.concat([x, Buffer.alloc((4 - (x.length % 4)) % 4)]);
bin = pad(Buffer.from(bin));
const add = (arr) => { const bytes = Buffer.from(new Uint16Array(arr).buffer); j.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length, target: 34963 }); bin = Buffer.concat([bin, pad(bytes)]); j.accessors.push({ bufferView: j.bufferViews.length - 1, componentType: 5123, count: arr.length, type: 'SCALAR' }); return j.accessors.length - 1; };
prim.indices = add(rest);
const mat = JSON.parse(JSON.stringify(j.materials[prim.material])); mat.name = name; j.materials.push(mat);
j.meshes[0].primitives.push({ attributes: { ...prim.attributes }, indices: add(cloth), material: j.materials.length - 1 });
j.buffers[0].byteLength = bin.length;
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
head.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
fs.writeFileSync(output, Buffer.concat([head, jh, jp, bh, bin]));
console.log(output, fs.statSync(output).size, 'bytes; material', name);

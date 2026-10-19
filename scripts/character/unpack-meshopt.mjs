// Unpack a meshopt-packed GLB into a plain one (every EXT_meshopt_compression view decoded, the fallback buffer dropped) so Blender's glTF importer can read
// it: Blender 5.2 cannot decode the packed inverse-bind accessor ("scripts/character/world_body.py" fails on public/beasts/cave-troll.glb as shipped).
// Everything else (JSON, images, animation, plain views) is carried over unchanged.
//   node scripts/character/unpack-meshopt.mjs <packed.glb> <plain.glb>
import fs from 'node:fs';
import { MeshoptDecoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: node scripts/character/unpack-meshopt.mjs <packed.glb> <plain.glb>');
const raw = fs.readFileSync(input), n = raw.readUInt32LE(12), d = JSON.parse(raw.subarray(20, 20 + n)), bin = raw.subarray(28 + n);
await MeshoptDecoder.ready;
const chunks = []; let offset = 0;
const push = (bytes) => { const at = offset; chunks.push(Buffer.from(bytes)); offset += bytes.length; const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; } return at; };
for (const v of d.bufferViews) {
  const mo = v.extensions?.EXT_meshopt_compression;
  let bytes;
  if (mo) {
    bytes = new Uint8Array(mo.count * mo.byteStride);
    MeshoptDecoder.decodeGltfBuffer(bytes, mo.count, mo.byteStride, bin.subarray(mo.byteOffset || 0, (mo.byteOffset || 0) + mo.byteLength), mo.mode, mo.filter || 'NONE');
    v.byteLength = bytes.length; if (v.target === 34962 && (mo.byteStride > 4 || v.byteStride)) v.byteStride = mo.byteStride; else delete v.byteStride;   // strides belong to vertex attribute views only
    delete v.extensions.EXT_meshopt_compression; if (!Object.keys(v.extensions).length) delete v.extensions;
  } else bytes = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  v.buffer = 0; v.byteOffset = push(bytes);
}
d.buffers = [{ byteLength: offset }];
for (const key of ['extensionsUsed', 'extensionsRequired']) if (d[key]) { d[key] = d[key].filter((x) => x !== 'EXT_meshopt_compression'); if (!d[key].length) delete d[key]; }
let json = Buffer.from(JSON.stringify(d)); json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const body = Buffer.concat(chunks), head = Buffer.alloc(12 + 8), tail = Buffer.alloc(8);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8); head.writeUInt32LE(json.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
tail.writeUInt32LE(body.length, 0); tail.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(output, Buffer.concat([head, json, tail, body]));
console.log(`${input} -> ${output}: ${raw.length} -> ${12 + 8 + json.length + 8 + body.length} bytes`);

// Kit LOD vertex colour (Characters, 2026-10-22). The full kit pieces carry a COLOR_0 attribute, so three's GLTFLoader turns `vertexColors` on in their material, and the zone's
// instanced kit draws a far body with that material: a LOD with NO colour attribute reads (0,0,0) in every vertex and renders BLACK ("invisible, only the shadow shows", Web's T4 still
// of the remesh hut, 10-22). The voxel remesh in kit_lod.py drops colour attributes. This adds a neutral white COLOR_0 (unsigned byte, normalized, 255 x4) to every primitive that lacks one,
// so the LOD renders the same with its own material or the full piece's: the baked atlas already holds the colour, white multiplies it by 1.
//   node scripts/character/kit-lod-color.mjs <in.glb> <out.glb>   (raw Blender export in, still uncompressed; then node scripts/pack-world-body.mjs)
import fs from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output || input === output) throw new Error('usage: node scripts/character/kit-lod-color.mjs <in.glb> <out.glb> (a new path)');
const raw = fs.readFileSync(input);
if (raw.readUInt32LE(0) !== 0x46546c67 || raw.readUInt32LE(4) !== 2) throw new Error('Expected GLB v2');
const jsonLen = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8, binLen = raw.readUInt32LE(20 + jsonLen), bin = raw.subarray(binStart, binStart + binLen);
if (doc.buffers?.length !== 1) throw new Error('Expected one embedded buffer');
const chunks = [bin]; let size = bin.length, added = 0;
const pad4 = (n) => (4 - (n % 4)) % 4;
for (const mesh of doc.meshes ?? []) for (const prim of mesh.primitives) {
  if (prim.attributes.COLOR_0 !== undefined) continue;
  const count = doc.accessors[prim.attributes.POSITION].count, gap = pad4(size);
  if (gap) { chunks.push(Buffer.alloc(gap)); size += gap; }
  chunks.push(Buffer.alloc(count * 4, 255));
  doc.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: count * 4, target: 34962 });
  doc.accessors.push({ bufferView: doc.bufferViews.length - 1, componentType: 5121, normalized: true, count, type: 'VEC4' });
  prim.attributes.COLOR_0 = doc.accessors.length - 1; size += count * 4; added++;
}
const body = Buffer.concat(chunks), binPad = Buffer.alloc(pad4(body.length));
doc.buffers[0].byteLength = body.length;
const json = Buffer.from(JSON.stringify(doc)), jsonPad = Buffer.alloc(pad4(json.length), 0x20);
const jsonChunk = Buffer.concat([json, jsonPad]), binChunk = Buffer.concat([body, binPad]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(output, Buffer.concat([head, jh, jsonChunk, bh, binChunk]));
console.log(`${input}: ${added} primitive(s) got a white COLOR_0 -> ${output}`);

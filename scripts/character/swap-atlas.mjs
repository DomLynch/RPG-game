// usage: node swap-atlas.mjs <in.glb> <atlas.webp> <out.glb>   replaces image 0 of a GLB (buffer view only; geometry, clips and the rest are carried untouched)
import fs from 'node:fs';
const [input, atlas, output] = process.argv.slice(2);
const raw = fs.readFileSync(input), n = raw.readUInt32LE(12), j = JSON.parse(raw.subarray(20, 20 + n)), bin = raw.subarray(28 + n);
const img = fs.readFileSync(atlas), vi = j.images[0].bufferView;
const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
// rebuild the buffer: every view in order, the image view replaced
let at = 0; const parts = [];
j.bufferViews.forEach((v, i) => {
  const bytes = i === vi ? img : bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  v.byteOffset = at; v.byteLength = bytes.length; const p = pad(bytes); parts.push(p); at += p.length;
});
j.buffers[0].byteLength = at;
const body = Buffer.concat(parts), json = pad(Buffer.from(JSON.stringify(j))).fill(0x20, Buffer.from(JSON.stringify(j)).length);
const jsonPadded = Buffer.concat([Buffer.from(JSON.stringify(j)), Buffer.alloc((4 - (Buffer.from(JSON.stringify(j)).length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonPadded.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(body.length, 0); bh.write('BIN\0', 4);
head.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + body.length, 8);
fs.writeFileSync(output, Buffer.concat([head, jh, jsonPadded, bh, body]));
console.log(output, fs.statSync(output).size, 'bytes; atlas', img.length);

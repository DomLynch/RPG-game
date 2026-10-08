// Embed a GLB's external images (uri -> bufferView) so it no longer depends on the build's shared-texture dedupe (vite.config.mjs externalises an image
// only while 2+ src/assets GLBs hold it; shrinking one holder makes it inline, and a prebuilt look GLB that still names the hashed file 404s).
//   node scripts/glb-embed-external.mjs <in.glb> <textures-dir> <out.glb>      (textures-dir holds the <sha256>.<ext> files the uris name)
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';

const [src, texDir, dst] = process.argv.slice(2);
const raw = readFileSync(src), jsonLen = raw.readUInt32LE(12), json = JSON.parse(raw.subarray(20, 20 + jsonLen).toString());
const binLen = raw.readUInt32LE(20 + jsonLen), bin = raw.subarray(28 + jsonLen, 28 + jsonLen + binLen);
const parts = [bin];
let size = bin.length;
for (const im of json.images ?? []) {
  if (!im.uri || im.uri.startsWith('data:')) continue;
  const name = basename(im.uri), bytes = readFileSync(join(texDir, name));
  const want = name.replace(/\.[a-z]+$/, '');
  if (createHash('sha256').update(bytes).digest('hex') !== want) throw new Error(`${name}: content does not match its hash name`);
  const pad = Buffer.alloc((4 - (size % 4)) % 4);
  parts.push(pad); size += pad.length;
  json.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: bytes.length });
  im.bufferView = json.bufferViews.length - 1;
  im.mimeType = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[name.split('.').pop()];
  delete im.uri;
  parts.push(bytes); size += bytes.length;
  console.log(`embedded ${name} (${bytes.length} B) as bufferView ${im.bufferView}`);
}
const body = Buffer.concat(parts), padded = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4)]);
json.buffers[0].byteLength = padded.length;
const j = Buffer.from(JSON.stringify(json)), jp = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0, 'latin1'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + padded.length, 8);
const h1 = Buffer.alloc(8); h1.writeUInt32LE(jp.length, 0); h1.write('JSON', 4, 'latin1');
const h2 = Buffer.alloc(8); h2.writeUInt32LE(padded.length, 0); h2.write('BIN\0', 4, 'latin1');
writeFileSync(dst, Buffer.concat([head, h1, jp, h2, padded]));

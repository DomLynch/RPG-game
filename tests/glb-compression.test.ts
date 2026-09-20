import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { losslessJpeg } from '../scripts/lossless-jpeg.mjs';
import { jpegFingerprint } from '../scripts/jpeg-equivalence.mjs';
import { optimizeGlb } from '../scripts/optimize-glb.mjs';
import { assertGlbEquivalent, parseGlb, sha256 } from '../scripts/glb-equivalence.mjs';

test('production packing preserves the real Skeleton buffers, materials and clips; the judge rejects corruption [slow]', async () => {
  const source = readFileSync(new URL('../src/assets/skeleton.glb', import.meta.url)), hash = sha256(source);
  const packed = await optimizeGlb(source);
  const result = await assertGlbEquivalent(source, packed);
  assert.equal(result.clips, 38);
  assert.equal(sha256(source), hash, 'source file bytes are untouched');
  assert.ok(gzipSync(packed).length < gzipSync(source).length);
  const damaged = Buffer.from(packed), { doc } = parseGlb(damaged);
  const ext = doc.bufferViews.find(v => v.extensions?.EXT_meshopt_compression).extensions.EXT_meshopt_compression;
  damaged[28 + damaged.readUInt32LE(12) + ext.byteOffset] ^= 255;
  await assert.rejects(assertGlbEquivalent(source, damaged), 'corrupted geometry/animation must fail');
  function rewrite(edit) {
    const { doc, bin } = parseGlb(packed); edit(doc);
    let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
    const out = Buffer.alloc(28 + json.length + bin.length);
    packed.copy(out, 0, 0, 20); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(json.length, 12); json.copy(out, 20);
    out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(out, 28 + json.length); return out;
  }
  await assert.rejects(assertGlbEquivalent(source, rewrite(doc => { doc.animations[0].name += '-wrong'; })), /animations changed/);
  await assert.rejects(assertGlbEquivalent(source, rewrite(doc => {
    const index = doc.meshes.flatMap(m => m.primitives).find(p => p.material !== undefined).material;
    doc.materials[index].pbrMetallicRoughness ??= {};
    doc.materials[index].pbrMetallicRoughness.baseColorFactor = [.123, .456, .789, .5];
  })), /material\/texture changed/);
});


test('JPEG packing preserves decoded pixels and metadata; a valid coefficient change is rejected', () => {
  const { doc, bin } = parseGlb(readFileSync(new URL('../src/assets/skeleton.glb', import.meta.url)));
  const view = doc.images.filter(i => i.mimeType === 'image/jpeg').map(i => doc.bufferViews[i.bufferView]).sort((a,b) => b.byteLength-a.byteLength)[0];
  const original = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  const packed = losslessJpeg(original), expected = jpegFingerprint(original);
  assert.deepEqual(jpegFingerprint(packed), expected);
  const changed = Buffer.from(packed), table = changed.indexOf(Buffer.from([0xff, 0xdb]));
  assert.ok(table >= 0); assert.equal(changed[table + 4] >> 4, 0);
  changed[table + 5] += changed[table + 5] === 255 ? -1 : 1;
  assert.notDeepEqual(jpegFingerprint(changed), expected, 'pixel changes must not pass as lossless packing');
});

test('shared external textures preserve the real rig and reject missing or corrupted image bytes', async () => {
  const source = readFileSync(new URL('../src/assets/skeleton.glb', import.meta.url));
  const images = new Map();
  const packed = await optimizeGlb(source, (bytes, mime) => {
    const uri = `textures/${sha256(bytes)}.${mime === 'image/jpeg' ? 'jpg' : 'webp'}`;
    images.set(uri, bytes); return uri;
  });
  await assertGlbEquivalent(source, packed, async uri => images.get(uri));
  await assert.rejects(assertGlbEquivalent(source, packed, async () => { throw new Error('Missing texture'); }), /Missing texture/);
  const webp = [...images.keys()].find(uri => uri.endsWith('.webp'));
  const damaged = Buffer.from(images.get(webp)); damaged[damaged.length - 1] ^= 1;
  await assert.rejects(assertGlbEquivalent(source, packed, async uri => uri === webp ? damaged : images.get(uri)), /material\/texture changed/);
});

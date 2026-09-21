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
  const ext = doc.bufferViews.find((v: any) => v.extensions?.EXT_meshopt_compression).extensions.EXT_meshopt_compression;
  damaged[28 + damaged.readUInt32LE(12) + ext.byteOffset] ^= 255;
  await assert.rejects(assertGlbEquivalent(source, damaged), 'corrupted geometry/animation must fail');
  function rewrite(edit: (doc: any) => void) {
    const { doc, bin } = parseGlb(packed); edit(doc);
    let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
    const out = Buffer.alloc(28 + json.length + bin.length);
    packed.copy(out, 0, 0, 20); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(json.length, 12); json.copy(out, 20);
    out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(out, 28 + json.length); return out;
  }
  await assert.rejects(assertGlbEquivalent(source, rewrite(doc => { doc.animations[0].name += '-wrong'; })), /animations changed/);
  await assert.rejects(assertGlbEquivalent(source, rewrite(doc => {
    const index = doc.meshes.flatMap((m: any) => m.primitives).find((p: any) => p.material !== undefined).material;
    doc.materials[index].pbrMetallicRoughness ??= {};
    doc.materials[index].pbrMetallicRoughness.baseColorFactor = [.123, .456, .789, .5];
  })), /material\/texture changed/);
});


test('JPEG packing preserves decoded pixels and metadata; a valid coefficient change is rejected', () => {
  const { doc, bin } = parseGlb(readFileSync(new URL('../src/assets/skeleton.glb', import.meta.url)));
  const view = doc.images.filter((i: any) => i.mimeType === 'image/jpeg').map((i: any) => doc.bufferViews[i.bufferView]).sort((a: any, b: any) => b.byteLength-a.byteLength)[0];
  const original = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  const packed = losslessJpeg(original), expected = jpegFingerprint(original);
  assert.deepEqual(jpegFingerprint(packed), expected);
  const changed = Buffer.from(packed), table = changed.indexOf(Buffer.from([0xff, 0xdb]));
  assert.ok(table >= 0); assert.equal(changed[table + 4] >> 4, 0);
  changed[table + 5] += changed[table + 5] === 255 ? -1 : 1;
  assert.notDeepEqual(jpegFingerprint(changed), expected, 'pixel changes must not pass as lossless packing');
});

test('shared external textures preserve the real rig and reject missing or corrupted image bytes [slow]', async () => {
  const source = readFileSync(new URL('../src/assets/skeleton.glb', import.meta.url));
  const images = new Map();
  const packed = await optimizeGlb(source, (bytes: Uint8Array, mime: string) => {
    const uri = `textures/${sha256(bytes)}.${mime === 'image/jpeg' ? 'jpg' : 'webp'}`;
    images.set(uri, bytes); return uri;
  });
  await assertGlbEquivalent(source, packed, async uri => images.get(uri));
  await assert.rejects(assertGlbEquivalent(source, packed, async () => { throw new Error('Missing texture'); }), /Missing texture/);
  const webp = [...images.keys()].find(uri => uri.endsWith('.webp'));
  const damaged = Buffer.from(images.get(webp)); damaged[damaged.length - 1] ^= 1;
  await assert.rejects(assertGlbEquivalent(source, packed, async uri => uri === webp ? damaged : images.get(uri)), /material\/texture changed/);
});

test('build quantization: int8 normals and uint8 weights summing to 255 pass the judge within one step; a drifted normal or weight row is rejected; lossless packing is still bit-exact [slow]', async () => {
  const source = readFileSync(new URL('../src/assets/warrior.glb', import.meta.url));
  const exact = await optimizeGlb(source, undefined, { quantize: false }), packed = await optimizeGlb(source);
  await assertGlbEquivalent(source, exact);
  const { doc } = parseGlb(exact);
  assert.ok(!doc.extensionsRequired.includes('KHR_mesh_quantization') && doc.accessors.every((a: any) => a.componentType !== 5120), 'quantize:false leaves every accessor as the source typed it');
  const result = await assertGlbEquivalent(source, packed), quant = parseGlb(packed);
  assert.ok(quant.doc.extensionsRequired.includes('KHR_mesh_quantization'));
  const semantics = new Map();
  for (const m of quant.doc.meshes) for (const p of m.primitives) for (const [s, ai] of Object.entries(p.attributes)) semantics.set(ai, s.replace(/_\d+$/, ''));
  const normals = [...semantics].filter(([, s]) => s === 'NORMAL').map(([i]) => quant.doc.accessors[i]), weights = [...semantics].filter(([, s]) => s === 'WEIGHTS').map(([i]) => quant.doc.accessors[i]);
  assert.ok(normals.length > 0 && normals.every(a => a.componentType === 5120 && a.normalized && a.min === undefined), 'every normal accessor is int8 normalized');
  assert.ok(weights.length > 0 && weights.every(a => a.componentType === 5121 && a.normalized), 'every weight accessor is uint8 normalized');
  assert.ok(gzipSync(packed).length < gzipSync(exact).length * 0.92, `quantized build is at least 8% smaller gzipped (${gzipSync(packed).length} vs ${gzipSync(exact).length})`);
  assert.equal(result.accessors, doc.accessors.length);
  // Decode the emitted weights: every vertex's four bytes sum to exactly 255 (skinning never scales the mesh).
  const { MeshoptDecoder } = await import('meshoptimizer'); await MeshoptDecoder.ready;
  const decoded = (view: number) => { const v = quant.doc.bufferViews[view], ext = v.extensions?.EXT_meshopt_compression; if (!ext) return quant.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); const out = Buffer.alloc(v.byteLength); MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, quant.bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter); return out; };
  let rows = 0;
  for (const a of weights) { const bytes = decoded(a.bufferView); for (let i = 0; i < a.count; i++) { assert.equal(bytes[i * 4] + bytes[i * 4 + 1] + bytes[i * 4 + 2] + bytes[i * 4 + 3], 255, `weights row ${i} sums to 255`); rows++; } }
  assert.ok(rows > 10000, `checked ${rows} vertices`);
  // The judge's tolerance is one quantization step: nudge one SOURCE normal component by two steps (float, uncompressed view) and one
  // source weight by four steps, and the untouched packed build must no longer match either.
  const src = parseGlb(source), sourceSemantics = new Map();
  for (const m of src.doc.meshes) for (const p of m.primitives) for (const [s, ai] of Object.entries(p.attributes)) sourceSemantics.set(ai, s.replace(/_\d+$/, ''));
  const nudge = (semantic: string, delta: number) => {
    const index = [...sourceSemantics].find(([, s]) => s === semantic)![0], a = src.doc.accessors[index], v = src.doc.bufferViews[a.bufferView];
    const out = Buffer.from(source), at = 28 + out.readUInt32LE(12) + (v.byteOffset || 0) + (a.byteOffset || 0);
    out.writeFloatLE(out.readFloatLE(at) + delta, at); return out;
  };
  await assert.rejects(assertGlbEquivalent(nudge('NORMAL', 2 / 127), packed), /Normal .* drifted/);
  await assert.rejects(assertGlbEquivalent(nudge('WEIGHTS', 4 / 255), packed), /Weight/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { optimizeGlb } from '../scripts/optimize-glb.mjs';
import { assertGlbEquivalent, parseGlb, sha256 } from '../scripts/glb-equivalence.mjs';

test('production packing preserves the real Skeleton buffers, materials and clips; the judge rejects corruption', async () => {
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
    doc.materials[index].name += '-wrong';
  })), /material\/texture changed/);
});

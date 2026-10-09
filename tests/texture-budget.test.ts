import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// scripts/character/texture_budget.py (the duel cost pass) needs Pillow; where python3 or Pillow is missing the test is skipped, not passed.
const hasPillow = spawnSync('python3', ['-c', 'import PIL']).status === 0;

function readGlb(path: string) {
  const bytes = readFileSync(path), size = bytes.readUInt32LE(12);
  return { json: JSON.parse(bytes.subarray(20, 20 + size).toString()), bin: bytes.subarray(28 + size) };
}
function webpSize(b: Buffer): [number, number] {   // VP8 / VP8L / VP8X pixel size
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const k = b.toString('ascii', 12, 16);
  if (k === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  const x = b.readUInt32LE(21);
  return [1 + (x & 0x3fff), 1 + ((x >> 14) & 0x3fff)];
}

test('texture_budget.py: a WebP texture (EXT_texture_webp source) resolves to its material slot and is re-encoded as WebP at the slot cap', { skip: !hasPillow && 'python3 with Pillow is not available' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'texture-budget-'));
  try {
    const webp = Buffer.from(execFileSync('python3', ['-c', 'import io,sys;from PIL import Image;b=io.BytesIO();Image.new("RGB",(64,64),(200,40,40)).save(b,"WEBP",lossless=True);sys.stdout.buffer.write(b.getvalue())'], { maxBuffer: 1 << 20 }));
    const pad = Buffer.alloc((4 - (webp.length % 4)) % 4);
    const json = Buffer.from(JSON.stringify({
      asset: { version: '2.0' }, buffers: [{ byteLength: webp.length + pad.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: webp.length }],
      images: [{ bufferView: 0, mimeType: 'image/webp' }], textures: [{ extensions: { EXT_texture_webp: { source: 0 } } }],
      materials: [{ name: 'Wall', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    }));
    const j = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]), bin = Buffer.concat([webp, pad]);
    const head = Buffer.alloc(20);
    head.write('glTF', 0, 'latin1'); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + j.length + bin.length, 8); head.writeUInt32LE(j.length, 12); head.write('JSON', 16, 'latin1');
    const binHead = Buffer.alloc(8); binHead.writeUInt32LE(bin.length, 0); binHead.write('BIN\0', 4, 'latin1');
    writeFileSync(join(dir, 'in.glb'), Buffer.concat([head, j, binHead, bin]));
    const out = execFileSync('python3', ['scripts/character/texture_budget.py', join(dir, 'in.glb'), join(dir, 'out.glb'), JSON.stringify({ 'Wall.map': 16 })]).toString();
    assert.match(out, /Wall\.map\s+64x64 -> 16x16/, 'the WebP slot resolves to Wall.map and is capped at 16');
    const result = readGlb(join(dir, 'out.glb')), view = result.json.bufferViews[result.json.images[0].bufferView];
    assert.deepEqual(webpSize(result.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)), [16, 16], 'the stored image is a 16x16 WebP');
    assert.equal(result.json.images[0].mimeType, 'image/webp');
    assert.ok(result.json.textures[0].extensions.EXT_texture_webp, 'the texture still names its WebP source');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('texture_budget.py: a meshopt GLB keeps its fallback buffer and every non-image byte in place', { skip: !hasPillow && 'python3 with Pillow is not available' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'texture-budget-'));
  try {
    const webp = Buffer.from(execFileSync('python3', ['-c', 'import io,sys;from PIL import Image;b=io.BytesIO();Image.new("RGB",(64,64),(200,40,40)).save(b,"WEBP",lossless=True);sys.stdout.buffer.write(b.getvalue())'], { maxBuffer: 1 << 20 }));
    const pad = Buffer.alloc((4 - (webp.length % 4)) % 4), mesh = Buffer.from('0123456789abcdef');
    const json = Buffer.from(JSON.stringify({
      asset: { version: '2.0' }, extensionsUsed: ['EXT_meshopt_compression'],
      buffers: [{ byteLength: webp.length + pad.length + mesh.length }, { byteLength: 32, extensions: { EXT_meshopt_compression: { fallback: true } } }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: webp.length }, { buffer: 1, byteOffset: 0, byteLength: 32, extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: webp.length + pad.length, byteLength: 16, count: 4, byteStride: 4, mode: 'ATTRIBUTES' } } }],
      images: [{ bufferView: 0, mimeType: 'image/webp' }], textures: [{ extensions: { EXT_texture_webp: { source: 0 } } }],
      materials: [{ name: 'Wall', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    }));
    const j = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]), bin = Buffer.concat([webp, pad, mesh]);
    const head = Buffer.alloc(20);
    head.write('glTF', 0, 'latin1'); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + j.length + bin.length, 8); head.writeUInt32LE(j.length, 12); head.write('JSON', 16, 'latin1');
    const binHead = Buffer.alloc(8); binHead.writeUInt32LE(bin.length, 0); binHead.write('BIN\0', 4, 'latin1');
    writeFileSync(join(dir, 'in.glb'), Buffer.concat([head, j, binHead, bin]));
    execFileSync('python3', ['scripts/character/texture_budget.py', join(dir, 'in.glb'), join(dir, 'out.glb'), JSON.stringify({ 'Wall.map': 16 })]);
    const result = readGlb(join(dir, 'out.glb')), ext = result.json.bufferViews[1].extensions.EXT_meshopt_compression;
    assert.equal(result.json.buffers.length, 2, 'the fallback buffer entry survives');
    assert.deepEqual(result.json.bufferViews[1].buffer, 1);
    assert.equal(result.bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength).toString(), mesh.toString(), 'the compressed bytes stay at their offset');
    const view = result.json.bufferViews[0];
    assert.deepEqual(webpSize(result.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)), [16, 16]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Independent check of emitted assets: decode with the game's decoder, never the encoder.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { jpegFingerprint } from './jpeg-equivalence.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function parseGlb(raw) {
  assert.equal(raw.readUInt32LE(0), 0x46546c67);
  assert.equal(raw.readUInt32LE(4), 2);
  assert.equal(raw.readUInt32LE(8), raw.length);
  const length = raw.readUInt32LE(12);
  assert.equal(raw.readUInt32LE(16), 0x4e4f534a);
  assert.equal(raw.readUInt32LE(24 + length), 0x004e4942);
  return { doc: JSON.parse(raw.subarray(20, 20 + length)), bin: raw.subarray(28 + length) };
}
export async function builtRig(name) {
  const files = (await readdir('dist/assets')).filter(f => f.startsWith(`${name}-`) && f.slice(name.length + 1).match(/^[\w-]{8}\.glb$/));
  assert.equal(files.length, 1, `Exactly one content-hashed build for ${name}`);
  return `dist/assets/${files[0]}`;
}
export async function assertGlbEquivalent(original, emitted, loadImage = uri => {
  assert.match(uri, /^textures\/[a-f0-9]{64}\.(jpg|png|webp)$/);
  return readFile(`dist/assets/${uri}`);
}) {
  await MeshoptDecoder.ready;
  const source = parseGlb(original), output = parseGlb(emitted);
  assert.ok(output.doc.extensionsRequired.includes('EXT_meshopt_compression'));
  for (const key of ['extensionsUsed', 'extensionsRequired']) assert.deepEqual(output.doc[key].filter(x => x !== 'EXT_meshopt_compression'), source.doc[key] || []);
  const extras = asset => { const value = structuredClone(asset.doc.extras); if (value) delete value.creatureWeaponBase; return value; };
  assert.deepEqual(extras(output), extras(source), 'Runtime provenance changed');
  function reader(asset) {
    const cache = new Map();
    return id => {
      if (cache.has(id)) return cache.get(id);
      const view = asset.doc.bufferViews[id], ext = view.extensions?.EXT_meshopt_compression;
      let bytes;
      if (ext) {
        assert.equal(ext.buffer, 0); assert.equal(ext.filter, 'NONE');
        assert.equal(view.byteLength, ext.count * ext.byteStride);
        bytes = Buffer.alloc(view.byteLength);
        MeshoptDecoder.decodeGltfBuffer(bytes, ext.count, ext.byteStride, asset.bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter);
      } else {
        assert.equal(view.buffer, 0);
        bytes = asset.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      }
      cache.set(id, bytes); return bytes;
    };
  }
  const left = reader(source), right = reader(output);
  assert.equal(source.doc.accessors.length, output.doc.accessors.length);
  function accessor(a, b) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (key === 'bufferView') {
        assert.deepEqual(right(b[key]), left(a[key]), 'Decoded accessor bytes changed');
        assert.equal(output.doc.bufferViews[b[key]].byteStride, source.doc.bufferViews[a[key]].byteStride);
      } else if (a[key] && typeof a[key] === 'object' && !Array.isArray(a[key])) accessor(a[key], b[key]);
      else assert.deepEqual(b[key], a[key], `Accessor ${key} changed`);
    }
  }
  source.doc.accessors.forEach((a, i) => accessor(a, output.doc.accessors[i]));
  for (const key of ['asset', 'nodes', 'skins', 'animations', 'scenes', 'scene', 'cameras', 'samplers', 'extensions']) {
    assert.deepEqual(output.doc[key], source.doc[key], `${key} changed`);
  }
  const external = new Map();
  for (const img of output.doc.images) if (img.uri) external.set(img.uri, await loadImage(img.uri));
  function material(asset, read, index) {
    if (index === undefined) return undefined;
    const image = id => {
      const { bufferView, uri, ...metadata } = asset.doc.images[id];
      const bytes = uri ? external.get(uri) : read(bufferView);
      return { ...metadata, content: metadata.mimeType === 'image/jpeg' ? jpegFingerprint(bytes) : sha256(bytes) };
    };
    const texture = id => {
      const result = structuredClone(asset.doc.textures[id]);
      if (result.source !== undefined) result.source = image(result.source);
      for (const extension of Object.values(result.extensions || {})) if (extension.source !== undefined) extension.source = image(extension.source);
      return result;
    };
    const result = structuredClone(asset.doc.materials[index]);
    function expand(object) {
      for (const [key, value] of Object.entries(object)) {
        if (key.endsWith('Texture') && value?.index !== undefined) value.index = texture(value.index);
        else if (value && typeof value === 'object') expand(value);
      }
    }
    expand(result); return result;
  }
  const normalizeMeshes = (asset, read) => asset.doc.meshes.map(mesh => ({ ...mesh, primitives: mesh.primitives.map(p => ({ ...p, material: material(asset, read, p.material) })) }));
  assert.deepEqual(normalizeMeshes(output, right), normalizeMeshes(source, left), 'Geometry or used material/texture changed');
  return { accessors: source.doc.accessors.length, clips: source.doc.animations.length, sourceSha256: sha256(original), emittedSha256: sha256(emitted) };
}

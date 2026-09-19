// CPU asset contract: source provenance, unchanged clips/weapons, valid fitted skin.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, Vector3 } from 'three';

const digest = b => createHash('sha256').update(b).digest('hex');
const generator = digest(Buffer.concat(await Promise.all(['scripts/character/creatures.py', 'scripts/character/creature_pack.py'].map(p => fs.readFile(p)))));
function glb(raw) {
  const n = raw.readUInt32LE(12);
  return { doc: JSON.parse(raw.subarray(20, 20 + n)), bin: raw.subarray(28 + n) };
}
function values({ doc, bin }, id) {
  const a = doc.accessors[id], v = doc.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const [size, read] = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] }[a.componentType];
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, c) => bin[read]((v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || size * width) + c * size)));
}
function animation(a, clip) {
  return { ...clip, samplers: clip.samplers.map(s => ({ ...s, input: values(a, s.input), output: values(a, s.output) })) };
}
async function geometryOnly({ doc, bin }) {
  doc = structuredClone(doc);
  for (const mesh of doc.meshes) for (const p of mesh.primitives) delete p.material;
  for (const key of ['materials', 'textures', 'images', 'samplers', 'extensionsRequired', 'extensionsUsed']) delete doc[key];
  doc.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(doc), '');
}
const receipts = [];
for (const [family, base] of [['minotaur', 'pitborn'], ['wraith', 'nightborn']]) {
  const [raw, baseRaw, sourceRaw] = await Promise.all([`src/assets/${family}.glb`, `src/assets/${base}.glb`, `src/assets/source/creatures/${family}.glb`].map(p => fs.readFile(p)));
  const output = glb(raw), original = glb(baseRaw), source = glb(sourceRaw), { doc } = output;
  assert.deepEqual(doc.extras.creatureSource, { family, stage: 'in-game-playtest', baseSha256: digest(baseRaw), generatorSha256: generator, sourceSha256: digest(sourceRaw) }, 'Stale creature: rebuild with build-creatures.mjs');
  assert.deepEqual(doc.animations.map(c => animation(output, c)), original.doc.animations.map(c => animation(original, c)), 'Combat clips changed');
  for (const [i, before] of original.doc.nodes.entries()) {
    const after = structuredClone(doc.nodes[i]), expected = structuredClone(before);
    // The surface replaces inherited art; joint transforms and weapon hierarchy are unchanged.
    if (before.mesh !== undefined && after.mesh !== undefined) {
      const a = original.doc.meshes[before.mesh], b = doc.meshes[after.mesh];
      assert.equal(a.primitives.length, b.primitives.length);
      for (let k = 0; k < a.primitives.length; k++) {
        for (const key of Object.keys(a.primitives[k].attributes)) assert.deepEqual(values(original, a.primitives[k].attributes[key]), values(output, b.primitives[k].attributes[key]), `${before.name}: ${key}`);
        assert.deepEqual(values(original, a.primitives[k].indices), values(output, b.primitives[k].indices), `${before.name}: weapon indices`);
      }
    }
    for (const n of [after, expected]) { delete n.mesh; delete n.skin; if (n.children) n.children = n.children.filter(c => c < original.doc.nodes.length); }
    assert.deepEqual(after, expected, `Joint/attachment changed: ${before.name}`);
  }
  const imageBytes = a => a.doc.images.map(img => { const v = a.doc.bufferViews[img.bufferView]; return digest(a.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); });
  for (const hash of imageBytes(source)) assert(imageBytes(output).includes(hash), 'Original compressed map lost');
  const asset = await geometryOnly(output), body = asset.scene.getObjectByName('CreatureBody');
  assert(body?.isSkinnedMesh && body.userData.creature === family);
  const g = body.geometry, weights = g.attributes.skinWeight, joints = g.attributes.skinIndex;
  assert.equal(g.index.count / 3, 45000);
  for (let i = 0; i < weights.count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights.getComponent(i, k), j = joints.getComponent(i, k);
      assert(Number.isFinite(w) && w >= 0 && w <= 1 && Number.isInteger(j) && j < body.skeleton.bones.length);
      sum += w;
    }
    assert(Math.abs(sum - 1) < 1e-5, 'Unnormalised skin');
  }
  let triangles = 0;
  asset.scene.traverse(o => { if (o.isMesh) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; });
  assert(triangles < 60000, 'Existing 60k character ceiling');
  const mixer = new AnimationMixer(asset.scene), point = new Vector3();
  let poses = 0;
  for (const clip of asset.animations) for (const fraction of [0, .25, .5, .75, .999]) {
    mixer.stopAllAction(); const action = mixer.clipAction(clip).play(); action.time = clip.duration * fraction; mixer.update(0);
    asset.scene.updateMatrixWorld(true); body.skeleton.update();
    for (let i = 0; i < g.attributes.position.count; i++) {
      body.applyBoneTransform(i, point.fromBufferAttribute(g.attributes.position, i));
      assert(point.toArray().every(Number.isFinite), `${clip.name}: nonfinite posed vertex`);
      assert(point.length() < 6, `${clip.name}: runaway skin vertex`);
    }
    poses++;
  }
  receipts.push({ family, sha256: digest(raw), triangles, clipsPreserved: asset.animations.length, finitePoses: poses, mapsPreserved: imageBytes(source).length });
}
await fs.mkdir('artifacts/character/creatures', { recursive: true });
await fs.writeFile('artifacts/character/creatures/integrity.json', JSON.stringify(receipts, null, 2));
console.log(JSON.stringify(receipts));

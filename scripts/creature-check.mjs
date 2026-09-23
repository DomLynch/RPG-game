// CPU asset contract: source provenance, unchanged clips/weapons, valid fitted skin.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, Vector3 } from 'three';
import { clipFor } from '../src/characters.ts';
import { ROSTER } from '../src/roster.ts';

const digest = b => createHash('sha256').update(b).digest('hex');
const generator = digest(Buffer.concat(await Promise.all(['scripts/character/creatures.py', 'scripts/character/creature_pack.py'].map(p => fs.readFile(p)))));
function glb(raw) {
  const n = raw.readUInt32LE(12);
  return { doc: JSON.parse(raw.subarray(20, 20 + n)), bin: raw.subarray(28 + n) };
}
function values({ doc, bin }, id) {
  if (id === undefined) return null;
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
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const raw = Buffer.alloc(28 + json.length + bin.length);
  raw.writeUInt32LE(0x46546c67, 0); raw.writeUInt32LE(2, 4); raw.writeUInt32LE(raw.length, 8);
  raw.writeUInt32LE(json.length, 12); raw.writeUInt32LE(0x4e4f534a, 16); json.copy(raw, 20);
  raw.writeUInt32LE(bin.length, 20 + json.length); raw.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(raw, 28 + json.length);
  return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}
const receipts = [];
for (const [family, base] of [['minotaur', 'pitborn'], ['wraith', 'nightborn'], ['werewolf', 'pitborn'], ['skeleton', 'source/backups/veteran-v1'], ['dwarf', 'source/creatures/dwarf-donor'], ['executioner', 'source/backups/executioner-v5'], ['veteran', 'source/backups/veteran-v1'], ['plaguedoctor', 'warrior']].filter(([id]) => !ROSTER[id].hold).filter(([id]) => process.argv.length < 3 || process.argv.slice(2).includes(id))) {
  const [raw, baseRaw, sourceRaw] = await Promise.all([`src/assets/${family}.glb`, `src/assets/${base}.glb`, `src/assets/source/creatures/${family}.glb`].map(p => fs.readFile(p)));
  const output = glb(raw), original = glb(baseRaw), source = glb(sourceRaw), { doc } = output;
  const weaponKind = ROSTER[family].weapon;
  if (['maul', 'reaper'].includes(weaponKind)) assert.equal(doc.extras.creatureWeapon?.generator, digest(await fs.readFile('scripts/build-creature-weapons.mjs')), 'Stale creature weapon generator');
  const { skinMatched } = doc.extras.creatureSource ?? {};   // set when the fitter colour-matched the base colour map to the donor's skin (the Veteran)
  assert.deepEqual(doc.extras.creatureSource, { family, stage: 'in-game-playtest', baseSha256: digest(baseRaw), generatorSha256: generator, sourceSha256: digest(sourceRaw), ...(skinMatched ? { skinMatched } : {}) }, 'Stale creature: rebuild with build-creatures.mjs');
  // Death_QuietOne is authored per body on its own skin envelope (build-quiet-one.mjs), so it is the one clip not inherited verbatim.
  const inherited = a => a.doc.animations.filter(c => c.name !== 'Death_QuietOne');
  assert.deepEqual(inherited(output).slice(0, inherited(original).length).map(c => animation(output, c)), inherited(original).map(c => animation(original, c)), 'Combat clips changed');
  if (!doc.extras.creatureWeapon) assert.equal(doc.animations.length, original.doc.animations.length, 'No unauthored clips');
  for (const [i, before] of original.doc.nodes.entries()) {
    const after = structuredClone(doc.nodes[i]), expected = structuredClone(before);
    if (doc.extras.creatureWeapon && ['WeaponDrawn'].includes(before.name)) {
      assert.equal(after.extras.weapon, weaponKind);
      continue; // New authored equipment is checked by the creature weapon contract.
    }
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
  const outImages = imageBytes(output), lost = imageBytes(source).filter(hash => !outImages.includes(hash));
  if (skinMatched) { // exactly the stamped source images are replaced, each by the matched WebP the pack recorded
    const srcImages = imageBytes(source), swapped = Object.keys(skinMatched).map(Number);
    assert.deepEqual(lost, swapped.map(i => srcImages[i]), 'Only the colour-matched maps may be replaced');
    for (const hash of Object.values(skinMatched)) assert(outImages.includes(hash), 'Matched map lost');
  } else assert.deepEqual(lost, [], 'Original compressed map lost');
  const asset = await geometryOnly(output), body = asset.scene.getObjectByName('CreatureBody');
  assert(body?.isSkinnedMesh && body.userData.creature === family);
  const g = body.geometry, weights = g.attributes.skinWeight, joints = g.attributes.skinIndex;
  assert(g.index.count > 0 && g.index.count / 3 <= 45000, '45k surface ceiling');
  // A hand is the hand joint and everything under it: a human-handed reconstruction keeps finger weights, so its palm and
  // fingers follow the grip through the finger joints, not hand_r directly.
  const under = name => { const root = body.skeleton.bones.find(b => b.name === name), ids = new Set(); root?.traverse(b => { const i = body.skeleton.bones.indexOf(b); if (i >= 0) ids.add(i); }); return ids; };
  const hand = under('hand_r'), handVertices = new Set();
  const support = under('hand_l'), supportVertices = new Set();
  for (let i = 0; i < weights.count; i++) {
    let sum = 0, inHand = 0, inSupport = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights.getComponent(i, k), j = joints.getComponent(i, k);
      assert(Number.isFinite(w) && w >= 0 && w <= 1 && Number.isInteger(j) && j < body.skeleton.bones.length);
      if (hand.has(j)) inHand += w;
      if (support.has(j)) inSupport += w;
      sum += w;
    }
    if (inHand > .5) handVertices.add(i);
    if (inSupport > .5) supportVertices.add(i);
    assert(Math.abs(sum - 1) < 1e-5, 'Unnormalised skin');
  }
  let triangles = 0;
  asset.scene.traverse(o => { if (o.isMesh) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; });
  assert(triangles < 60000, 'Existing 60k character ceiling');
  const mixer = new AnimationMixer(asset.scene), point = new Vector3();
  const weapon = asset.scene.getObjectByName('WeaponDrawn') ?? asset.scene.getObjectByName('SwordDrawn'), grip = new Vector3();
  assert(weapon && handVertices.size, 'The reconstructed hand must follow the grip joint');
  const gripClips = new Set(['Armed', 'Attack', 'Heavy', 'Guard', 'Thrust'].map(role => clipFor(weaponKind, role)));
  let poses = 0;
  for (const clip of asset.animations) for (const fraction of [0, .25, .5, .75, .999]) {
    mixer.stopAllAction(); const action = mixer.clipAction(clip).play(); action.time = clip.duration * fraction; mixer.update(0);
    asset.scene.updateMatrixWorld(true); body.skeleton.update();
    weapon.getWorldPosition(grip); let handGap = Infinity, supportGap = Infinity;
    const supportGrip = body.skeleton.bones.find(b => b.name === 'hand_l').getWorldPosition(new Vector3());
    for (let i = 0; i < g.attributes.position.count; i++) {
      body.applyBoneTransform(i, point.fromBufferAttribute(g.attributes.position, i));
      assert(point.toArray().every(Number.isFinite), `${clip.name}: nonfinite posed vertex`);
      assert(point.length() < 6, `${clip.name}: runaway skin vertex`);
      if (handVertices.has(i) || (['skeleton', 'dwarf', 'veteran'].includes(family) && supportVertices.has(i))) {
        const world = body.localToWorld(point);
        if (handVertices.has(i)) handGap = Math.min(handGap, world.distanceTo(grip));
        if (supportVertices.has(i)) supportGap = Math.min(supportGap, world.distanceTo(supportGrip));
      }
    }
    if (gripClips.has(clip.name) && process.env.GRIP_DEBUG) console.log('gripgap', family, clip.name, fraction, handGap.toFixed(4));
    if (gripClips.has(clip.name) && !process.env.GRIP_DEBUG) assert(handGap < .08, `${family} ${clip.name}: hand detached from weapon (${handGap}m)`);
    if (['skeleton', 'dwarf', 'veteran'].includes(family) && gripClips.has(clip.name)) assert(supportGap < .08, `${family} ${clip.name}: supporting hand detached (${supportGap}m)`);
    poses++;
  }
  receipts.push({ family, sha256: digest(raw), triangles, clipsPreserved: original.doc.animations.length, totalClips: asset.animations.length, finitePoses: poses, mapsPreserved: imageBytes(source).length });
}
await fs.mkdir('artifacts/character/creatures', { recursive: true });
await fs.writeFile('artifacts/character/creatures/integrity.json', JSON.stringify(receipts, null, 2));
console.log(JSON.stringify(receipts));

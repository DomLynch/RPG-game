// The Sand Legionary as OPPONENT armour (Dom 2026-09-27 10:4x via Strategy/Lead): the Centurion's bronze set, tier 5 Champion. Hero Look's
// fitted rig (public/herolook/legionary.glb: the GPT model on the hero's skeleton, v9b) is not sliced: the GPT set came as one mesh per
// piece and creature_pack.py kept them as separate draws, so each draw IS a loot piece. This script picks those draws, names them by
// player slot, tags them with the loot contract (extras.slot, extras.material) and writes them as a parts file the loot build reads:
//   node scripts/loot-legionary.mjs [--in artifacts/herolook/legionary-v9b-raw.glb] [--out src/assets/source/loot/legionary.glb]
// Contract (build-warrior.mjs "Authored parts"): coordinates in the hero rig's UNSCALED rest space, real skin weights, bones by name. The
// fitted rig carries the hero's root ('Ashcourt warrior', scale .9/.97/.97, y .025) with the draws under it, so the draws' own coordinates
// are already that space: they are re-parented under an identity root here, with the skeleton, so no root transform reaches the build's
// applyMatrix4(matrixWorld). Materials: every piece wears `LegionaryIron`, the family bake src/assets/source/loot/legionary_iron_{color,orm}.jpg
// (extracted from the same GLB by the Armour lane, 1024, occlusion channel set to 1). The input must be the RAW fit (before
// optimize-glb.mjs): the shipped public/ copy is meshopt-compressed and three's loader here has no decoder. Images are stripped before
// parsing (three's loader cannot decode them under Node); the parts file carries no images by design.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import fs from 'node:fs/promises';
import { MeshoptSimplifier } from 'meshoptimizer';
// three's exporter reads its blobs through a browser FileReader; the same shim the build uses (build-warrior.mjs).
globalThis.ProgressEvent ??= class { constructor(_, fields) { Object.assign(this, fields); } };
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const IN = arg('--in', 'artifacts/herolook/legionary-v9b-raw.glb'), OUT = arg('--out', 'src/assets/source/loot/legionary.glb'), HERO = arg('--hero', 'src/assets/warrior.glb'), TRIS = Number(arg('--tris', '30000')), ERR = Number(arg('--error', '0.05'));   // --error: meshopt's relative error bound for the cut   // --tris: the set's fight budget (Dom 2026-09-26: an automatic sub-30k LOD at the fight camera); 0 = uncut
// The fitted rig's draws, as creature_pack.py wrote them from the GPT review set's meshes (vertex counts matched draw by draw):
// CreatureBody = body (cuirass, pteruges, belt), Part1 = arms (pauldrons + sleeves), Part2 = base-body (the generated skin: NOT a piece),
// Part3 = gloves, Part4 = helmet, Part5 = greaves, Part6 = boots, Part7 = crest fan (horsehair), Part8 = the crest's cut top.
const DRAWS = { CreatureBody: 'Body', CreaturePart1: 'Arms', CreaturePart3: 'Gloves', CreaturePart4: 'Helmet', CreaturePart5: 'Greaves', CreaturePart6: 'Boots', CreaturePart7: 'Crest', CreaturePart8: 'Crest' };
const MATERIAL = 'LegionaryIron';

// A GLB with its images, textures and texture references removed: the JSON chunk rewritten, the binary chunk kept.
export const withoutImages = (raw) => {
  const n = raw.readUInt32LE(12), d = JSON.parse(raw.subarray(20, 20 + n).toString()), bin = raw.subarray(28 + n);
  delete d.images; delete d.textures; delete d.samplers;
  for (const m of d.materials ?? []) { for (const k of Object.keys(m)) if (k.endsWith('Texture')) delete m[k]; for (const k of Object.keys(m.pbrMetallicRoughness ?? {})) if (k.endsWith('Texture')) delete m.pbrMetallicRoughness[k]; delete m.extensions; }
  d.extensionsUsed = (d.extensionsUsed ?? []).filter(e => !/texture|webp/i.test(e)); d.extensionsRequired = (d.extensionsRequired ?? []).filter(e => !/texture|webp/i.test(e));
  let json = Buffer.from(JSON.stringify(d)); if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - json.length % 4, 0x20)]);
  const head = Buffer.alloc(20); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + json.length + bin.length, 8); head.writeUInt32LE(json.length, 12); head.write('JSON', 16);
  const binHead = Buffer.alloc(8); binHead.writeUInt32LE(bin.length, 0); binHead.write('BIN\0', 4);
  return Buffer.concat([head, json, binHead, bin]);
};

const raw = withoutImages(await fs.readFile(IN));
const asset = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
asset.scene.updateMatrixWorld(true);
const draws = []; asset.scene.traverse(o => { if (o.isSkinnedMesh && DRAWS[o.name]) draws.push(o); });
const missing = Object.keys(DRAWS).filter(n => !draws.some(d => d.name === n)); if (missing.length) throw new Error(`loot-legionary: ${IN} has no draw ${missing.join(', ')}`);

// One skeleton for every piece: the fitted rig's bones re-rooted under an identity node, so no root scale reaches the export. Bone local
// transforms are kept (the exporter wants a consistent hierarchy); the loot build ignores them and binds each vertex by bone NAME.
const skeleton = draws[0].skeleton, rootBone = skeleton.bones.find(b => !skeleton.bones.includes(b.parent));
const out = new T.Scene(); out.name = 'legionary loot';
rootBone.parent?.remove(rootBone); out.add(rootBone);
const material = new T.MeshStandardMaterial({ name: MATERIAL, roughness: 1, metalness: .35 });
// REBIND (the loot_dwarf.py --repose trap): the fitted rig binds its surface in the pose the fit left it in (an A-pose from CREATURE_ARM),
// while every loot piece binds to the PLAYER's rest, a T. Each vertex is carried from the legionary's bind to the hero's through its own
// weights: v' = Σ w_i (Bhero_i · Bleg_i⁻¹) v, the plain linear-blend change of bind pose; identical binds make it the identity.
const heroRaw = withoutImages(await fs.readFile(HERO)), hero = await new GLTFLoader().parseAsync(heroRaw.buffer.slice(heroRaw.byteOffset, heroRaw.byteOffset + heroRaw.byteLength), '');
let heroSkeleton; hero.scene.traverse(o => { if (o.isSkinnedMesh && !heroSkeleton) heroSkeleton = o.skeleton; });
const rebind = draws[0].skeleton.bones.map((b, i) => {
  const j = heroSkeleton.bones.findIndex(x => x.name === b.name); if (j < 0) throw new Error(`loot-legionary: hero rig has no bone ${b.name}`);
  return new T.Matrix4().copy(heroSkeleton.boneInverses[j]).invert().multiply(draws[0].skeleton.boneInverses[i]);
});
const at = (sk, name) => new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(sk.boneInverses[sk.bones.findIndex(b => b.name === name)]).invert());
for (const n of ['hand_l', 'upperarm_l', 'Head']) console.log(`bind ${n}: legionary`, at(draws[0].skeleton, n).toArray().map(v => +v.toFixed(3)), 'hero', at(heroSkeleton, n).toArray().map(v => +v.toFixed(3)));
const counts = {}, cut = {}, totalTris = draws.reduce((n, d) => n + (d.geometry.index ? d.geometry.index.count : d.geometry.getAttribute('position').count) / 3, 0);
console.log(`loot-legionary: ${Math.round(totalTris)} tris in, budget ${TRIS || 'uncut'}`);
for (const d of draws) {
  const slot = DRAWS[d.name];
  const g = d.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  { const p = g.getAttribute('position'), nrm = g.getAttribute('normal'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), v = new T.Vector3(), M = new T.Matrix4(), acc = new T.Matrix4(), N = new T.Matrix3();
    for (let k = 0; k < p.count; k++) {
      acc.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      for (let q = 0; q < 4; q++) { const w = sw.getComponent(k, q); if (!w) continue; M.copy(rebind[si.getComponent(k, q)]).multiplyScalar(w); for (let e = 0; e < 16; e++) acc.elements[e] += M.elements[e]; }
      v.fromBufferAttribute(p, k).applyMatrix4(acc); p.setXYZ(k, v.x, v.y, v.z);
      if (nrm) { v.fromBufferAttribute(nrm, k).applyMatrix3(N.getNormalMatrix(acc)).normalize(); nrm.setXYZ(k, v.x, v.y, v.z); }
    } }
  // Fit-side reduction (Dom 2026-09-27: generation at max, the cut to budget is a fit step with its own still): each piece keeps its share of
  // --tris by its own triangle count. meshopt's simplifier returns a subset of the original vertices, so every attribute (weights, UVs) stays valid.
  let welded = g;
  if (TRIS > 0) {
    // The fit exports unindexed draws (three corners per face): weld the corners that share every attribute first, or nothing can collapse.
    const gi = g.index ? g : mergeVertices(g, 1e-6); welded = gi;
    const before = gi.index.count / 3, target = Math.max(200, Math.round(before * TRIS / totalTris)) * 3;
    // After the cut the piece is re-welded from its kept faces, so the vertices the simplifier dropped leave the buffers.
    if (before * 3 > target) { await MeshoptSimplifier.ready; const [idx, err] = MeshoptSimplifier.simplify(new Uint32Array(gi.index.array), gi.getAttribute('position').array, 3, target, ERR, ['LockBorder']); gi.setIndex(new T.BufferAttribute(idx, 1)); welded = mergeVertices(gi.toNonIndexed(), 1e-6); cut[slot] = (cut[slot] ?? 0) + before - idx.length / 3; }
  }
  const geometry = TRIS > 0 && !g.index ? welded : g;
  const m = new T.SkinnedMesh(geometry, material); m.name = `legionary_${slot}_${d.name}`; m.userData = { slot, material: MATERIAL };
  m.bind(new T.Skeleton(skeleton.bones, skeleton.bones.map(b => heroSkeleton.boneInverses[heroSkeleton.bones.findIndex(x => x.name === b.name)])), new T.Matrix4());
  out.add(m); counts[slot] = (counts[slot] ?? 0) + Math.round((geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3);
}
const glb = Buffer.from(await new GLTFExporter().parseAsync(out, { binary: true, animations: [] }));
await fs.writeFile(OUT, glb);
console.log(`loot-legionary: ${OUT} ${(glb.byteLength / 1e6).toFixed(2)} MB; ${Object.values(counts).reduce((a, b) => a + b, 0)} tris out; per slot`, JSON.stringify(counts), 'cut', JSON.stringify(cut));

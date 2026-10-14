// Widen the Witch's capelet on the player (Characters 2026-10-10, Lead's option A: wider, down to the mid upper arm, hood and robe kept). The capelet shares the
// witch.Helmet.WitchCloth draw with the hood. The loot build's sources (artifacts/source archives, animations2) are not in every checkout and a rebuild is not
// byte-identical, so this patches the committed loot.glb in place, the way scripts/loot-refit-necklace.mjs did the goblin's cord: the capelet keeps its topology
// (8 rings x 33, same UVs, same draw); its positions, normals and skin are rewritten from loot-fit.mjs witchCapelet with the new hem and flare; the hood never moves.
//   node scripts/loot-refit-witch-capelet.mjs           check: replays the OLD capelet against the file (proves this is the build's capelet), then the new one's numbers
//   node scripts/loot-refit-witch-capelet.mjs --write   patch src/assets/loot.glb, THEN node scripts/split-loot.mjs (carriers-witch.glb) and node scripts/loot-layers.mjs
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { jointOf, triGrid, witchCapelet } from './loot-fit.mjs';

globalThis.ProgressEvent ??= class {};
const FILE = 'src/assets/loot.glb', NODE = 'witch.Helmet.WitchCloth', write = process.argv.includes('--write');
const OLD = { low: -.07, scale: t => 1.25 - .17 * t, reach: Infinity, armBand: true };   // the shipped capelet; the new one is witchCapelet's defaults (what build-warrior.mjs builds)
const bytes = fs.readFileSync(FILE), jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8, bin = Buffer.from(bytes.subarray(binStart, binStart + json.buffers[0].byteLength));
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// What the build fits against (build-warrior.mjs playerWorn): the loot build's player body and level-1 kit, rest space.
const worn = [];
for (const file of ['body_realistic.glb', 'level1_realistic.glb']) {
  const glb = fs.readFileSync(`src/assets/source/parts/${file}`), asset = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  asset.scene.updateMatrixWorld(true); asset.scene.traverse((o) => { if (o.isMesh) worn.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
}
const grid = triGrid(worn);
// The rig from the draw's own skin: joint indices in the file index this skeleton's bones.
const lootJson = JSON.parse(JSON.stringify(json)); lootJson.images = []; lootJson.textures = []; lootJson.samplers = []; lootJson.materials = (json.materials ?? []).map((m) => ({ name: m.name }));
lootJson.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
const loot = await loader.parseAsync(JSON.stringify(lootJson), '');
let mesh = null; loot.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === T.PropertyBinding.sanitizeNodeName(NODE)) mesh = o; });
if (!mesh) throw new Error(`${NODE}: no skinned draw`);
const boneIndex = (name) => { const i = mesh.skeleton.bones.findIndex((b) => b.name === name); if (i < 0) throw new Error(`no bone ${name}`); return i; };
const at = jointOf(mesh.skeleton, boneIndex);

const node = json.nodes.find((n) => n.name === NODE), prim = json.meshes[node.mesh].primitives[0];
const accessor = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; return { a, offset: (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride: v.byteStride }; };
const POS = accessor(prim.attributes.POSITION), UV = accessor(prim.attributes.TEXCOORD_0), NOR = accessor(prim.attributes.NORMAL), JNT = accessor(prim.attributes.JOINTS_0), WGT = accessor(prim.attributes.WEIGHTS_0);
const readF = (acc, i, n) => Array.from({ length: n }, (_, c) => bin.readFloatLE(acc.offset + i * acc.stride + c * 4));
const readJ = (i) => [0, 1, 2, 3].map((c) => bin.readUInt16LE(JNT.offset + i * JNT.stride + c * 2));

// Each capelet vertex in the file is the OLD ring vertex with the same position and UV (seam pairs share a position, not a UV).
const matchOf = (g) => {   // file vertex -> ring vertex of g
  const op = g.getAttribute('position'), ouv = g.getAttribute('uv'), map = new Map();
  for (let i = 0; i < POS.a.count; i++) {
    const p = readF(POS, i, 3), uv = readF(UV, i, 2);
    for (let k = 0; k < op.count; k++) if (Math.hypot(op.getX(k) - p[0], op.getY(k) - p[1], op.getZ(k) - p[2]) < 1e-4 && Math.hypot(ouv.getX(k) - uv[0], ouv.getY(k) - uv[1]) < 1e-4) { map.set(i, k); break; }
  }
  return map.size === op.count ? map : null;
};
const old = witchCapelet(grid, at, boneIndex, OLD).geometry, next = witchCapelet(grid, at, boneIndex);
if (!matchOf(old) && matchOf(next.geometry)) { console.log(`${FILE} already carries the new capelet (all ${next.geometry.getAttribute('position').count} ring vertices in place)`); process.exit(0); }
const map = matchOf(old);
if (!map) throw new Error(`the replayed capelet is not in ${NODE}: the file is not the build's capelet (or a rebuild moved it)`);
const deviation = (g) => {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'); let pos = 0, nor = 0, skin = 0;
  for (const [i, k] of map) {
    const fp = readF(POS, i, 3), fn = readF(NOR, i, 3), fj = readJ(i), fw = readF(WGT, i, 4);
    pos = Math.max(pos, Math.hypot(p.getX(k) - fp[0], p.getY(k) - fp[1], p.getZ(k) - fp[2])); nor = Math.max(nor, Math.hypot(n.getX(k) - fn[0], n.getY(k) - fn[1], n.getZ(k) - fn[2]));
    const want = new Map(); for (let c = 0; c < 4; c++) want.set(si.getComponent(k, c), (want.get(si.getComponent(k, c)) ?? 0) + sw.getComponent(k, c));
    const have = new Map(); for (let c = 0; c < 4; c++) have.set(fj[c], (have.get(fj[c]) ?? 0) + fw[c]);
    for (const b of new Set([...want.keys(), ...have.keys()])) skin = Math.max(skin, Math.abs((want.get(b) ?? 0) - (have.get(b) ?? 0)));
  }
  return `positions ${(pos * 1000).toFixed(2)} mm, normals ${nor.toFixed(4)}, skin weight ${skin.toFixed(4)}`;
};
const ringsOf = (r) => r.map((x) => (x.radii.reduce((n, v) => n + v, 0) / x.radii.length).toFixed(3)).join(' ');
const box = (g) => { const b = new T.Box3().setFromBufferAttribute(g.getAttribute('position')); return `x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)} y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)} z ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)}`; };
console.log(`replay of the shipped capelet against the file (${map.size} of ${POS.a.count} draw vertices): worst ${deviation(old)}`);
console.log(`new capelet against the file: worst ${deviation(next.geometry)} (0 once patched)`);
console.log(`old: rings ${ringsOf(witchCapelet(grid, at, boneIndex, OLD).rings)}  ${box(old)}`);
console.log(`new: rings ${ringsOf(next.rings)}  ${box(next.geometry)}  (upper arm joints at y ${at('upperarm_l').y.toFixed(3)}, elbow ${at('lowerarm_l').y.toFixed(3)} in the T rest)`);
if (!write) process.exit(0);

const g = next.geometry, p = g.getAttribute('position'), n = g.getAttribute('normal'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
for (const [i, k] of map) for (let c = 0; c < 4; c++) {
  if (c < 3) { bin.writeFloatLE(p.getComponent(k, c), POS.offset + i * POS.stride + c * 4); bin.writeFloatLE(n.getComponent(k, c), NOR.offset + i * NOR.stride + c * 4); }
  bin.writeUInt16LE(si.getComponent(k, c), JNT.offset + i * JNT.stride + c * 2); bin.writeFloatLE(sw.getComponent(k, c), WGT.offset + i * WGT.stride + c * 4);
}
const all = new T.Box3(); for (let i = 0; i < POS.a.count; i++) all.expandByPoint(new T.Vector3(...readF(POS, i, 3)));
POS.a.min = all.min.toArray(); POS.a.max = all.max.toArray();
const newJson = Buffer.from(JSON.stringify(json), 'utf8'), jsonChunk = Buffer.concat([newJson, Buffer.alloc((4 - (newJson.length % 4)) % 4, 0x20)]);
const binChunk = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const head = Buffer.alloc(12); bytes.copy(head, 0, 0, 12); head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(FILE, Buffer.concat([head, jh, jsonChunk, bh, binChunk]));
console.log(`wrote ${FILE}`);

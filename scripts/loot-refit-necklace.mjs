// Refit the goblin's trophy necklace cord on the player (Characters 2026-10-09; the gear-fit check found it floating as a ring round the shoulders).
// build-warrior.mjs fits the cord by a ray from the neck axis at 36 azimuths and takes the OUTERMOST hit, which on the hero is the shoulder: the cord went out to
// x +-0.29 m, above the deltoids. The fit that hugs the collar is the FIRST LAYER (skin plus whatever lies within 3 cm: loot-fit.mjs surfaceAlong, the rule every
// other loot piece uses). The loot build's sources (artifacts/source archives, animations2) are not in every checkout, so this patches the committed loot.glb in place:
// the cord is ONE tube of 679 vertices (same topology), rewritten from the same 36-point ring, same radius, same bone; nothing else in the file moves.
//   node scripts/loot-refit-necklace.mjs            check: rebuilds the ring with the OLD rule and compares it with what is in the file (proves this replays the build), then the new rule's numbers
//   node scripts/loot-refit-necklace.mjs --write    patch src/assets/loot.glb, THEN run node scripts/split-loot.mjs (carriers-goblin.glb is its cut) and node scripts/loot-layers.mjs (the journal layers + style.css stamp)
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { heroGeometries, necklaceRing, triGrid, surfaceAlong } from './loot-fit.mjs';

globalThis.ProgressEvent ??= class {};
const FILE = 'src/assets/loot.glb', NODE = 'goblin.Body.Leather', FIRST = 354, COUNT = 679, write = process.argv.includes('--write');
const bytes = fs.readFileSync(FILE), jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8, bin = Buffer.from(bytes.subarray(binStart, binStart + json.buffers[0].byteLength));
const parse = (buffer, plain = true) => { const j = plain ? buffer : null; return new GLTFLoader().parseAsync(j, ''); };
const toBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const worn = await heroGeometries();
const grid = triGrid(worn);
// The neck's own axis: the rig's neck_01 joint (from the loot file's own skin), nudged .03 m forward as the build does.
const lootJson = JSON.parse(JSON.stringify(json)); lootJson.images = []; lootJson.textures = []; lootJson.materials = (json.materials ?? []).map((m) => ({ name: m.name }));
lootJson.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`;
const loot = await new GLTFLoader().parseAsync(JSON.stringify(lootJson), '');
let skinned = null; loot.scene.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
const neck = skinned.skeleton.bones.findIndex((b) => b.name === 'neck_01');
const axis = new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(skinned.skeleton.boneInverses[neck]).invert()).add(new T.Vector3(0, 0, 0.03));

const ringBy = (rule) => {
  if (rule !== 'outermost') return necklaceRing(grid, axis);   // the build's own rule (loot-fit.mjs)
  const nape = axis.y + 0.012, front = nape - 0.065, GAP = 0.007;
  return Array.from({ length: 36 }, (_, k) => {
    const a = (k / 36) * Math.PI * 2, y = nape - ((nape - front) * (1 + Math.cos(a))) / 2, out = new T.Vector3(Math.sin(a), 0, Math.cos(a)), origin = new T.Vector3(axis.x, y, axis.z);
    const hits = grid.hits(origin, out, 0.35); if (!hits.length) throw new Error(`no body at azimuth ${a.toFixed(2)}`);
    return origin.addScaledVector(out, Math.max(...hits) + GAP);
  });
};
const tubeOf = (ring) => new T.TubeGeometry(new T.CatmullRomCurve3(ring, true), 96, 0.0035, 6, true);

const node = json.nodes.find((n) => n.name === NODE), prim = json.meshes[node.mesh].primitives[0];
const accessor = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; return { a, offset: (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride: v.byteStride ?? 12 }; };
const pos = accessor(prim.attributes.POSITION), nor = accessor(prim.attributes.NORMAL);
const read = (acc, i) => [0, 1, 2].map((c) => bin.readFloatLE(acc.offset + i * acc.stride + c * 4));
const deviation = (tube) => { let worst = 0; const p = tube.attributes.position; for (let i = 0; i < COUNT; i++) { const f = read(pos, FIRST + i); worst = Math.max(worst, Math.hypot(p.getX(i) - f[0], p.getY(i) - f[1], p.getZ(i) - f[2])); } return worst; };

const old = tubeOf(ringBy('outermost'));
if (old.attributes.position.count !== COUNT) throw new Error(`tube has ${old.attributes.position.count} vertices, expected ${COUNT}`);
console.log(`replay of the build's outermost rule against the file: worst vertex ${(deviation(old) * 1000).toFixed(2)} mm (the build's TubeGeometry order, ${COUNT} vertices from #${FIRST})`);
const ring = ringBy('first-layer'), tube = tubeOf(ring);
console.log(`new rule against the file: worst vertex ${(deviation(tube) * 1000).toFixed(2)} mm (0 once patched, or once a loot rebuild has run the same rule)`);
const box = new T.Box3().setFromBufferAttribute(tube.attributes.position);
console.log(`new cord: x ${box.min.x.toFixed(3)}..${box.max.x.toFixed(3)}  y ${box.min.y.toFixed(3)}..${box.max.y.toFixed(3)}  z ${box.min.z.toFixed(3)}..${box.max.z.toFixed(3)} (was x +-0.289, y 1.464..1.536)`);
if (!write) process.exit(0);

const p = tube.attributes.position, n = tube.attributes.normal;
for (let i = 0; i < COUNT; i++) for (let c = 0; c < 3; c++) { bin.writeFloatLE(p.array[i * 3 + c], pos.offset + (FIRST + i) * pos.stride + c * 4); bin.writeFloatLE(n.array[i * 3 + c], nor.offset + (FIRST + i) * nor.stride + c * 4); }
const all = new T.Box3(); for (let i = 0; i < pos.a.count; i++) all.expandByPoint(new T.Vector3(...read(pos, i)));
pos.a.min = all.min.toArray(); pos.a.max = all.max.toArray();
const newJson = Buffer.from(JSON.stringify(json), 'utf8'), pad = (4 - (newJson.length % 4)) % 4, jsonChunk = Buffer.concat([newJson, Buffer.alloc(pad, 0x20)]);
const binPad = (4 - (bin.length % 4)) % 4, binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);
const head = Buffer.alloc(12); bytes.copy(head, 0, 0, 12); head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(FILE, Buffer.concat([head, jh, jsonChunk, bh, binChunk]));
console.log(`wrote ${FILE}`);

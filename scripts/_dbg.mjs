import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { triGrid, surfaceAlong } from './loot-fit.mjs';
globalThis.ProgressEvent ??= class {};
const raw = fs.readFileSync('src/assets/warrior.glb'), jl = raw.readUInt32LE(12), hj = JSON.parse(raw.subarray(20, 20 + jl).toString('utf8'));
hj.images = []; hj.textures = []; hj.materials = (hj.materials ?? []).map((m) => ({ name: m.name }));
hj.buffers[0].uri = `data:application/octet-stream;base64,${raw.subarray(28 + jl, 28 + jl + hj.buffers[0].byteLength).toString('base64')}`;
const asset = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(hj), '');
asset.scene.updateMatrixWorld(true);
const worn = [];
asset.scene.traverse((o) => { if (o.isSkinnedMesh) { const g = o.geometry.clone().applyMatrix4(o.bindMatrix); g.computeBoundingBox(); console.log(o.name, o.userData.slot, g.attributes.position.count, g.boundingBox.min.toArray().map((x) => x.toFixed(2)).join(','), g.boundingBox.max.toArray().map((x) => x.toFixed(2)).join(',')); worn.push(g); } });
const grid = triGrid(worn);
const sk = []; asset.scene.traverse((o) => { if (o.isSkinnedMesh && !sk.length) sk.push(o); });
const s = sk[0].skeleton, i = s.bones.findIndex((b) => b.name === 'neck_01');
const axis = new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(s.boneInverses[i]).invert()).add(new T.Vector3(0, 0, .03));
console.log('axis', axis.toArray().map((x) => x.toFixed(3)));
for (const [az, name] of [[0, 'front'], [Math.PI / 2, 'side'], [Math.PI, 'back']]) {
  const out = new T.Vector3(Math.sin(az), 0, Math.cos(az)), o = new T.Vector3(axis.x, axis.y + .012, axis.z);
  console.log(name, 'hits', grid.hits(o, out, .35).map((d) => d.toFixed(3)).join(' '), 'first-layer', surfaceAlong(grid, o, out, { layer: .03, far: .35 }));
}
const base = axis.y;   // 1.52
for (const [nape, pw] of [[.012, 'old'], [.03, 2], [.04, 2], [.04, 4], [.05, 4]]) {
  const front = base + .012 - .065, N = base + nape;
  const pts = Array.from({ length: 36 }, (_, k) => {
    const a = k / 36 * Math.PI * 2, y = pw === 'old' ? N - (N - front) * (1 + Math.cos(a)) / 2 : N - (N - front) * Math.pow(Math.max(0, Math.cos(a)), pw);
    const out = new T.Vector3(Math.sin(a), 0, Math.cos(a)), o = new T.Vector3(axis.x, y, axis.z), d = surfaceAlong(grid, o, out, { layer: .03, far: .35 });
    return { a: Math.round(a * 57.3), y: +y.toFixed(3), r: +(d + .007).toFixed(3), x: +(o.x + out.x * (d + .007)).toFixed(3) };
  });
  console.log(nape, pw, 'maxR', Math.max(...pts.map((p) => p.r)), 'xrange', Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), 'r@0,45,90,135,180', [0, 5, 9, 14, 18].map((i) => pts[i].r + '@' + pts[i].y).join(' '));
}

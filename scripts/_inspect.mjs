import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent ??= class {};
const load = async (p) => { const b = readFileSync(p), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); const bin = b.subarray(28 + b.readUInt32LE(12)); j.images = []; j.textures = []; j.materials = (j.materials ?? []).map((m) => ({ name: m.name })); j.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64'); return new GLTFLoader().parseAsync(JSON.stringify(j), ''); };
const loot = await load('src/assets/loot.glb');
loot.scene.updateMatrixWorld(true);
loot.scene.traverse((o) => {
  if (o.isSkinnedMesh && o.userData.opponent === 'goblin' && o.userData.slot === 'Body') {
    const g = o.geometry; g.computeBoundingBox();
    console.log(o.name, 'verts', g.attributes.position.count, 'idx', g.index?.count, 'box', g.boundingBox.min.toArray().map((n) => n.toFixed(3)).join(','), '|', g.boundingBox.max.toArray().map((n) => n.toFixed(3)).join(','), 'bones', o.skeleton.bones.length);
  }
});
loot.scene.traverse((o) => {
  if (o.isSkinnedMesh && o.userData.opponent === 'goblin' && o.userData.slot === 'Body' && /Leather|Bone/.test(o.name)) {
    const g = o.geometry, n = g.attributes.position.count, idx = g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i);
    const parent = Array.from({ length: n }, (_, i) => i); const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]); parent[b] = a; parent[c] = a; }
    const comps = new Map(); for (let i = 0; i < n; i++) { const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); }
    console.log(o.name, 'components', comps.size);
    const p = g.attributes.position;
    for (const [r, vs] of [...comps].sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
      const box = new T.Box3(); for (const v of vs) box.expandByPoint(new T.Vector3().fromBufferAttribute(p, v));
      console.log('  comp', vs.length, 'first', Math.min(...vs), 'last', Math.max(...vs), 'box', box.min.toArray().map((x) => x.toFixed(3)).join(','), '|', box.max.toArray().map((x) => x.toFixed(3)).join(','));
    }
  }
});

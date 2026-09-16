// Standing/clip heights and foot grounding of a fighter GLB, as tests/characters.test.ts measures them.
import fs from 'node:fs/promises'; import { AnimationMixer, Box3, Vector3, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent = class { constructor(_, f) { Object.assign(this, f); } };
async function read(file) { const bytes = await fs.readFile(file); const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString()); json.images = []; json.textures = []; json.materials = json.materials.map(m => ({ name: m.name })); json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64'); return new GLTFLoader().parseAsync(JSON.stringify(json), ''); }
for (const file of process.argv.slice(2)) {
  const asset = await read(file), mixer = new AnimationMixer(asset.scene), point = new Vector3();
  const box = (clip, t) => { const a = mixer.clipAction(clip); a.play(); mixer.setTime(t); asset.scene.updateMatrixWorld(true); const b = new Box3(); asset.scene.traverse(o => { if (!(o instanceof SkinnedMesh)) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { point.fromBufferAttribute(p, i); o.applyBoneTransform(i, point); point.applyMatrix4(o.matrixWorld); b.expandByPoint(point); } }); a.stop(); return b; };
  const rows = [];
  for (const clip of asset.animations) { let minY = 9, maxY = 0, top0 = 0, floatMax = 0; for (let f = 0; f <= 8; f++) { const b = box(clip, clip.duration * f / 8 * .999); if (f === 0) top0 = b.max.y; minY = Math.min(minY, b.min.y); floatMax = Math.max(floatMax, b.min.y); maxY = Math.max(maxY, b.max.y); } rows.push(`${clip.name.padEnd(12)} top@0 ${top0.toFixed(3)} max ${maxY.toFixed(3)} min ${minY.toFixed(3)} minmax ${floatMax.toFixed(3)}`); }
  console.log(file); console.log(rows.join('\n'));
}

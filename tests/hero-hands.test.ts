import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The player's hands (owner, 2026-09-20: "spider fingers"). Two things must hold in the shipped warrior.glb, in the bind pose:
// each finger's skin belongs to its own bone chain (a finger pulled by two chains stretches and splays when a clip curls it),
// and each finger lies straight along the rig's finger (the clips' curl is authored on top of a straight rest; a curled bind
// pose curls twice). Measured on the rest geometry, so no clip needs to play.
async function skin() {
  const bytes = readFileSync(new URL('../src/assets/warrior.glb', import.meta.url));
  const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  const asset = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const mesh = asset.scene.getObjectByName('Skin') as SkinnedMesh;
  assert.ok(mesh?.isSkinnedMesh, 'the body is a skinned mesh named Skin');
  return mesh;
}
const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;

test('hero hands: every finger is skinned to its own chain and lies straight along the rig in the bind pose', async () => {
  const mesh = await skin(), skeleton = mesh.skeleton, names = skeleton.bones.map(b => b.name);
  const joint = (name: string) => { const i = names.indexOf(name); assert.ok(i >= 0, name); return new Vector3().setFromMatrixPosition(new Matrix4().copy(skeleton.boneInverses[i]).invert()); };
  const g = mesh.geometry, pos = g.getAttribute('position'), idx = g.getAttribute('skinIndex'), wgt = g.getAttribute('skinWeight');
  for (const side of ['l', 'r'] as const) for (const finger of FINGERS) {
    const chain = ['01', '02', '03', '04_leaf'].map(seg => names.indexOf(`${finger}_${seg}_${side}`));
    const mcp = joint(`${finger}_01_${side}`), u = joint(`${finger}_03_${side}`).sub(mcp).normalize();   // the rig's straight finger
    const others = new Set(FINGERS.filter(f => f !== finger).flatMap(f => ['01', '02', '03', '04_leaf'].map(seg => names.indexOf(`${f}_${seg}_${side}`))));
    const centroid = [new Vector3(), new Vector3(), new Vector3()], count = [0, 0, 0];
    let own = 0, foreign = 0, n = 0;
    const v = new Vector3();
    for (let k = 0; k < pos.count; k++) {
      let best = -1, bestW = 0;
      for (let c = 0; c < 4; c++) { const w = wgt.getComponent(k, c); if (w > bestW) { bestW = w; best = idx.getComponent(k, c); } }
      const seg = chain.indexOf(best);
      if (seg < 0 || bestW < .45) continue;
      v.fromBufferAttribute(pos, k);
      if (v.clone().sub(mcp).dot(u) < .004) continue;   // the finger proper, not the palm skin bone 01 also owns
      n++;
      for (let c = 0; c < 4; c++) { const w = wgt.getComponent(k, c), b = idx.getComponent(k, c); if (chain.includes(b)) own += w; else if (others.has(b)) foreign += w; }
      if (seg < 3) { centroid[seg].add(v); count[seg]++; }
    }
    assert.ok(n > 150, `${finger}_${side}: ${n} finger vertices found`);
    assert.ok(foreign / (own + foreign) < .05, `${finger}_${side}: ${(100 * foreign / (own + foreign)).toFixed(1)} % of its skin weight belongs to other fingers' chains`);
    assert.ok(count.every(c => c > 20), `${finger}_${side}: phalanx vertex counts ${count}`);
    const c = centroid.map((s, i) => s.divideScalar(count[i]));
    const phalanx = [c[1].clone().sub(c[0]).normalize(), c[2].clone().sub(c[1]).normalize()];
    for (const [i, d] of phalanx.entries()) {
      const off = Math.acos(Math.min(1, Math.max(-1, d.dot(u)))) * 180 / Math.PI;
      assert.ok(off < 18, `${finger}_${side}: phalanx ${i + 1}→${i + 2} runs ${off.toFixed(0)}° off the rig's straight finger in the bind pose`);
    }
  }
});

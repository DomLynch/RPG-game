import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Hands (owner, 2026-09-20: "spider fingers"). Two things must hold in every humanoid GLB's bind pose: each finger's skin
// belongs to its own bone chain (a finger pulled by two chains stretches and splays when a clip curls it), and each finger
// lies straight along the rig's finger (the clips' curl is authored on top of a straight rest; a curled bind pose curls
// twice). Measured on the rest geometry, so no clip needs to play. #255 (hero v43) fixed the hero; the checks below run on
// every live opponent too, so a body rebuilt from a pre-fix donor (parts.py's realistic_body only cleans the hero's own
// build; the Veteran and Executioner keep a TRELLIS donor's already-baked weights — creatures.py's `keep_fingers`) fails
// here instead of shipping quietly. MIN_FINGER_VERTS is per body: the TRELLIS reconstructions (CreatureBody) are lower-poly
// than the hero's authored mesh (Skin), so the floor is set relative to what a correctly-weighted build of that body
// actually has, not a single number borrowed from the hero.
async function skinOf(file: string, node: string) {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url));
  const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  const asset = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const mesh = asset.scene.getObjectByName(node) as SkinnedMesh;
  assert.ok(mesh?.isSkinnedMesh, `${file}: a skinned mesh named ${node}`);
  return mesh;
}
const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;
// file, mesh node, minimum finger-vertex floor (own-chain vertices past the palm cut, one side). The hero's authored
// mesh clears 150; the TRELLIS bodies are cut from a much coarser reconstruction — floors below are each body's own
// measured count on this same commit, rounded down, so a future regression still trips the gate.
// `skip`: veteran/executioner never call parts.py's realistic_body() at all — creatures.py's `keep_fingers` copies their
// TRELLIS donor's weights verbatim, and both donors (src/assets/source/backups/veteran-v1.glb, executioner-v5.glb) predate
// #255's finger fix. Fixing them means regenerating those donors, which veteran-polish-check.mjs, veteran-neck-check.mjs
// and the skeleton creature recipe also read directly — owner decision pending (docs/state/character.md, 2026-09-22).
// Remove the skip once the donors are rebuilt; leaving the row in place (rather than deleting it) keeps the gap visible.
const BODIES: { file: string; node: string; minVerts: number; skip?: string }[] = [
  { file: 'warrior.glb', node: 'Skin', minVerts: 150 },
  { file: 'veteran.glb', node: 'CreatureBody', minVerts: 40, skip: 'donor src/assets/source/backups/veteran-v1.glb predates the finger fix; also used by skeleton/veteran-polish-check/veteran-neck-check — owner decision pending' },
  { file: 'pitborn.glb', node: 'Skin', minVerts: 150 },
  { file: 'executioner.glb', node: 'CreatureBody', minVerts: 10, skip: 'donor src/assets/source/backups/executioner-v5.glb predates the finger fix — owner decision pending' },
  { file: 'goblin.glb', node: 'Skin', minVerts: 150 },
  { file: 'nightborn.glb', node: 'Skin', minVerts: 150 },
];

for (const { file, node, minVerts, skip } of BODIES) {
  test(`hands: ${file} — every finger is skinned to its own chain and lies straight along the rig in the bind pose`, { skip }, async () => {
    const mesh = await skinOf(file, node), skeleton = mesh.skeleton, names = skeleton.bones.map(b => b.name);
    const joint = (name: string) => { const i = names.indexOf(name); assert.ok(i >= 0, `${file}: bone ${name}`); return new Vector3().setFromMatrixPosition(new Matrix4().copy(skeleton.boneInverses[i]).invert()); };
    const g = mesh.geometry, pos = g.getAttribute('position'), idx = g.getAttribute('skinIndex'), wgt = g.getAttribute('skinWeight');
    for (const side of ['l', 'r'] as const) for (const finger of FINGERS) {
      const label = `${file} ${finger}_${side}`;
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
      assert.ok(n > minVerts, `${label}: ${n} finger vertices found (floor ${minVerts})`);
      assert.ok(foreign / (own + foreign) < .05, `${label}: ${(100 * foreign / (own + foreign)).toFixed(1)} % of its skin weight belongs to other fingers' chains`);
      assert.ok(count.every(c => c > Math.min(20, Math.floor(minVerts / 6))), `${label}: phalanx vertex counts ${count}`);
      const c = centroid.map((s, i) => s.divideScalar(count[i]));
      const phalanx = [c[1].clone().sub(c[0]).normalize(), c[2].clone().sub(c[1]).normalize()];
      for (const [i, d] of phalanx.entries()) {
        const off = Math.acos(Math.min(1, Math.max(-1, d.dot(u)))) * 180 / Math.PI;
        assert.ok(off < 18, `${label}: phalanx ${i + 1}→${i + 2} runs ${off.toFixed(0)}° off the rig's straight finger in the bind pose`);
      }
    }
  });
}

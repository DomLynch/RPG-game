// The Exo Gray release hero's clips (Dom 2026-10-23: "make this real hero for everyone", with Mixamo's own clips).
// The target is scripts/character/hero-exo.mjs's rig: the classic hero's 65 joints with the classic hero's REST ROTATIONS (so every clip authored against the classic rig - the execution and hamstring JSON, the weapon-pack
// clips, the sheathed/drawn sword nodes - keeps working) and Exo Gray's joint positions and mesh. It starts out carrying the classic hero's own 27 clips.
// This script replaces all 27 with MIXAMO's clips, taken from OpenTrident's hero-mixamo-exo-mx.glb (the Mixamo animation on Exo's own rest rotations, under the game's clip names). Four of them are Mixamo's NEAREST match,
// not the exact animation (Death_QuietOne, Skill_WitchArm, Skill_Pommel, Fin_RunThrough); STAND_INS below can name clips to keep as the classic hero's own instead (empty on Dom's ruling).
// The two rigs share joint names but not rest rotations (37 of 65 joints differ, up to 180 degrees), so a track cannot be copied: per key, each bone keeps its WORLD rotation delta from rest,
//   worldB_anim = (worldA_anim * worldA_rest^-1) * worldB_rest, then back to a local rotation under B's animated parent.
// IN PLACE: Mixamo's walks, strafes, rolls and lunges carry the body through the pelvis (Walk 1.5 m, Run 2.2 m, Attack 2.2 m); the game moves the actor itself, so that travel makes the feet skate. The pelvis keeps its
// VERTICAL delta from rest (the bob, scaled by the hip heights) and no horizontal travel, except in the Death_* falls, which keep theirs (a fall travelling backward reads right).
//   node scripts/character/exo-hero-clips.mjs <target rig.glb (hero-exo.mjs output)> <mixamo clips exo-mx.glb> <out.glb>
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [targetFile, sourceFile, outFile] = process.argv.slice(2);
assert.ok(targetFile && sourceFile && outFile, 'usage: exo-hero-clips.mjs <target rig.glb> <mixamo clips.glb> <out.glb>');
const STAND_INS = new Set(['Fin_RunThrough']);   // Dom 2026-10-23: Mixamo's own clip for every one of the 27, the four nearest-match ones (Death_QuietOne, Skill_WitchArm, Skill_Pommel, Fin_RunThrough) included, EXCEPT Fin_RunThrough: Mixamo's is a 2.4 s stand-still loop (blade tip never leaves guard), so the Run Through finisher's held drive lets go of the victim (release row 1, finisher-preview runThrough); the classic clip, authored against Death_RunThrough, keeps the blade through the chest. A name here keeps the classic hero's clip instead.
const KEEP_TRAVEL = /^Death/;
const read = (f) => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + n)), bin: Buffer.from(b.subarray(28 + n)) }; };
const B = read(targetFile), A = read(sourceFile);

const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((x) => x / l); };
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q)); return [r[0], r[1], r[2]]; };
const restQ = (n) => qnorm(n.rotation ?? [0, 0, 0, 1]);
const parentsOf = (j) => { const p = new Array(j.nodes.length).fill(-1); j.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => { p[c] = i; })); return p; };
const worldRestQ = (j, parent) => { const w = new Array(j.nodes.length); const get = (i) => (w[i] ??= parent[i] < 0 ? restQ(j.nodes[i]) : qnorm(qmul(get(parent[i]), restQ(j.nodes[i])))); j.nodes.forEach((_, i) => get(i)); return w; };
const SIZE = { 5126: 4, 5122: 2, 5123: 2, 5120: 1, 5121: 1 };
const readAcc = (S, ai) => {
  const a = S.j.accessors[ai], v = S.j.bufferViews[a.bufferView], w = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type], base = S.bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * w), dv = new DataView(S.bin.buffer, base), stride = v.byteStride ?? w * SIZE[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < w; k++) {
    const o = i * stride + k * SIZE[a.componentType];
    out[i * w + k] = a.componentType === 5126 ? dv.getFloat32(o, true) : a.componentType === 5122 ? Math.max(dv.getInt16(o, true) / 32767, -1) : a.componentType === 5123 ? dv.getUint16(o, true) / 65535 : a.componentType === 5120 ? Math.max(dv.getInt8(o) / 127, -1) : dv.getUint8(o) / 255;
  }
  return out;
};

const j = B.j; let bin = Buffer.concat([B.bin, Buffer.alloc((4 - (B.bin.length % 4)) % 4)]);
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
const addAcc = (f32, type, extra = {}) => {
  const bytes = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
  j.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length }); bin = Buffer.concat([bin, pad4(bytes)]);
  const w = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type]; j.accessors.push({ bufferView: j.bufferViews.length - 1, componentType: 5126, count: f32.length / w, type, ...extra }); return j.accessors.length - 1;
};
const nodeIndex = new Map(j.nodes.map((n, i) => [n.name, i]));
const aIndex = new Map(A.j.nodes.map((n, i) => [n.name, i]));
const pB = parentsOf(j), pA = parentsOf(A.j), wB = worldRestQ(j, pB), wA = worldRestQ(A.j, pA);
const jointsB = j.skins[0].joints.map((i) => j.nodes[i].name);
const pelvisB = nodeIndex.get('pelvis'), pelvisA = aIndex.get('pelvis');
const parentRotB = pB[pelvisB] < 0 ? [0, 0, 0, 1] : wB[pB[pelvisB]], parentRotA = pA[pelvisA] < 0 ? [0, 0, 0, 1] : wA[pA[pelvisA]];
const hipRatio = Math.hypot(...(j.nodes[pelvisB].translation ?? [0, 0, 0])) / Math.hypot(...(A.j.nodes[pelvisA].translation ?? [0, 0, 0]));
const restTA = A.j.nodes[pelvisA].translation, restTB = j.nodes[pelvisB].translation;

const done = [], kept = [];
for (const [ib, an] of j.animations.entries()) {
  const name = an.name, ca = A.j.animations.find((a) => a.name === name);
  if (STAND_INS.has(name) || !ca) { kept.push(name); continue; }
  const track = new Map();   // source joint -> rotation keys; 'pelvis.t' -> pelvis translation keys
  let times;
  for (const c of ca.channels) {
    const nm = A.j.nodes[c.target.node].name, s = ca.samplers[c.sampler];
    if (c.target.path === 'rotation') track.set(nm, readAcc(A, s.output)); else if (nm === 'pelvis' && c.target.path === 'translation') track.set('pelvis.t', readAcc(A, s.output));
    if (nm === 'pelvis' && c.target.path === 'rotation') times = readAcc(A, s.input);
  }
  const nk = times.length;
  for (const [k, v] of track) assert.ok(v.length / (k === 'pelvis.t' ? 3 : 4) === nk, `${name}: track ${k} has ${v.length} values for ${nk} keys (the Mixamo clips are sampled together)`);
  const outQ = new Map(jointsB.map((nm) => [nm, new Float32Array(nk * 4)]));
  for (let key = 0; key < nk; key++) {
    const animA = new Map(), animB = new Map();
    const wa = (i) => { if (animA.has(i)) return animA.get(i); const nm = A.j.nodes[i].name, tr = track.get(nm), q = tr ? qnorm([tr[key * 4], tr[key * 4 + 1], tr[key * 4 + 2], tr[key * 4 + 3]]) : restQ(A.j.nodes[i]); const w = pA[i] < 0 ? q : qnorm(qmul(wa(pA[i]), q)); animA.set(i, w); return w; };
    const wb = (i) => {
      if (animB.has(i)) return animB.get(i);
      const nm = j.nodes[i].name, ai = aIndex.get(nm);
      const world = ai === undefined || !track.has(nm) ? (pB[i] < 0 ? restQ(j.nodes[i]) : qnorm(qmul(wb(pB[i])[0], restQ(j.nodes[i])))) : qnorm(qmul(qmul(wa(ai), qinv(wA[ai])), wB[i]));
      const local = qnorm(qmul(qinv(pB[i] < 0 ? [0, 0, 0, 1] : wb(pB[i])[0]), world));
      animB.set(i, [world, local]); return [world, local];
    };
    for (const nm of jointsB) outQ.get(nm).set(wb(nodeIndex.get(nm))[1], key * 4);
  }
  const pv = track.get('pelvis.t'), outT = new Float32Array(nk * 3), travel = KEEP_TRAVEL.test(name);
  for (let key = 0; key < nk; key++) {
    const dw = qrot(parentRotA, [pv[key * 3] - restTA[0], pv[key * 3 + 1] - restTA[1], pv[key * 3 + 2] - restTA[2]]);
    const lb = qrot(qinv(parentRotB), [(travel ? dw[0] : 0) * hipRatio, dw[1] * hipRatio, (travel ? dw[2] : 0) * hipRatio]);
    outT.set([restTB[0] + lb[0], restTB[1] + lb[1], restTB[2] + lb[2]], key * 3);
  }
  const tAcc = addAcc(new Float32Array(times), 'SCALAR', { min: [times[0]], max: [times[nk - 1]] });
  const samplers = [], channels = [];
  for (const nm of jointsB) { samplers.push({ input: tAcc, output: addAcc(outQ.get(nm), 'VEC4') }); channels.push({ sampler: samplers.length - 1, target: { node: nodeIndex.get(nm), path: 'rotation' } }); }
  samplers.push({ input: tAcc, output: addAcc(outT, 'VEC3') }); channels.push({ sampler: samplers.length - 1, target: { node: pelvisB, path: 'translation' } });
  j.animations[ib] = { name, samplers, channels };
  done.push(`${name} (${(times[nk - 1]).toFixed(2)} s${travel ? ', travel kept' : ''})`);
}
console.log(`hip ratio ${hipRatio.toFixed(3)}; Mixamo clips on the classic-rest rig:`, done.join(', '));
console.log('classic hero clips kept:', kept.join(', '));

j.buffers[0].byteLength = bin.length;
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
head.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
fs.writeFileSync(outFile, Buffer.concat([head, jh, jp, bh, bin]));
console.log(outFile, fs.statSync(outFile).size, 'bytes');

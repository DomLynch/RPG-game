// The Exo Gray release hero's clips (Dom 2026-10-23: "make this real hero for everyone"). Two jobs on a hero GLB that carries OpenTrident's Mixamo clips on the hero's 65 joint names:
//   1. IN PLACE: Mixamo's walks, strafes, rolls and lunges carry the body forward through the pelvis (Walk 1.5 m, Run 2.2 m, Attack 2.2 m). The game moves the actor itself, so the same travel on
//      top makes the feet skate and the hero drift off his own collider. The classic hero's clips are in place (<= 0.5 m, mostly 0). The pelvis's horizontal travel (world x/z) is set to its first key in every
//      clip except the Death_* falls (a fall travelling backward reads right; the sim fixes where he lies). Vertical bob and everything else stay.
//   2. STAND-INS REPLACED: Death_QuietOne, Skill_WitchArm, Skill_Pommel and Fin_RunThrough were Mixamo's nearest, not the right animation. They are replaced by the CLASSIC hero's own clips, RETARGETED: the two rigs share
//      joint names but not rest rotations (37 of 65 joints differ, up to 180 degrees), so a track cannot be copied. Per key, each bone keeps its world rotation delta from rest:
//      worldB_anim = (worldA_anim * worldA_rest^-1) * worldB_rest, then back to a local rotation under B's animated parent. The pelvis keeps the classic's vertical bob (scaled by the hip heights), no horizontal travel.
//   node scripts/character/exo-hero-clips.mjs <exo-hero.glb> <classic-hero.glb> <out.glb>
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [exoFile, classicFile, outFile] = process.argv.slice(2);
assert.ok(exoFile && classicFile && outFile, 'usage: exo-hero-clips.mjs <exo-hero.glb> <classic-hero.glb> <out.glb>');
const REPLACE = ['Death_QuietOne', 'Skill_WitchArm', 'Skill_Pommel', 'Fin_RunThrough'];
const KEEP_TRAVEL = /^Death/;   // a fall may travel
const read = (f) => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + n)), bin: Buffer.from(b.subarray(28 + n)) }; };
const B = read(exoFile), A = read(classicFile);

// ---- quaternions [x y z w] and the few matrix helpers this needs ------------------------------------------------------------------------------------------------------------------
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];   // unit quaternions
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((x) => x / l); };
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q)); return [r[0], r[1], r[2]]; };
const restQ = (n) => qnorm(n.rotation ?? [0, 0, 0, 1]);
const parentsOf = (j) => { const p = new Array(j.nodes.length).fill(-1); j.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => { p[c] = i; })); return p; };
const worldRestQ = (j, parent) => { const w = new Array(j.nodes.length); const get = (i) => (w[i] ??= parent[i] < 0 ? restQ(j.nodes[i]) : qnorm(qmul(get(parent[i]), restQ(j.nodes[i])))); j.nodes.forEach((_, i) => get(i)); return w; };
const readAcc = (S, ai) => { const a = S.j.accessors[ai], v = S.j.bufferViews[a.bufferView], w = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type], base = S.bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * w); const dv = new DataView(S.bin.buffer, base);
  const stride = v.byteStride ?? w * { 5126: 4, 5122: 2, 5123: 2, 5120: 1, 5121: 1 }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < w; k++) {
    const o = i * stride + k * { 5126: 4, 5122: 2, 5123: 2, 5120: 1, 5121: 1 }[a.componentType];
    out[i * w + k] = a.componentType === 5126 ? dv.getFloat32(o, true) : a.componentType === 5122 ? Math.max(dv.getInt16(o, true) / 32767, -1) : a.componentType === 5123 ? dv.getUint16(o, true) / 65535 : a.componentType === 5120 ? Math.max(dv.getInt8(o) / 127, -1) : dv.getUint8(o) / 255;
  }
  return { f: out, w, n: a.count }; };

// ---- output buffer: B's bytes, new accessors appended -----------------------------------------------------------------------------------------------------------------------------------
const j = B.j; let bin = B.bin;
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
bin = pad4(bin);
const addAcc = (f32, type, extra = {}) => {
  const bytes = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
  j.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length }); bin = Buffer.concat([bin, pad4(bytes)]);
  const w = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type]; j.accessors.push({ bufferView: j.bufferViews.length - 1, componentType: 5126, count: f32.length / w, type, ...extra }); return j.accessors.length - 1;
};
const nodeIndex = new Map(j.nodes.map((n, i) => [n.name, i]));
const pB = parentsOf(j), pA = parentsOf(A.j), wB = worldRestQ(j, pB), wA = worldRestQ(A.j, pA);
const jointsB = j.skins[0].joints.map((i) => j.nodes[i].name);
const aIndex = new Map(A.j.nodes.map((n, i) => [n.name, i]));
const pelvisB = nodeIndex.get('pelvis'), pelvisA = aIndex.get('pelvis');

// ---- 1. in place ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the pelvis's parent frame: horizontal = world x/z (y up) after the parent chain's rotation
const parentRotB = pB[pelvisB] < 0 ? [0, 0, 0, 1] : wB[pB[pelvisB]];
let stripped = [];
for (const an of j.animations) {
  if (KEEP_TRAVEL.test(an.name) || REPLACE.includes(an.name)) continue;
  const ch = an.channels.find((c) => c.target.node === pelvisB && c.target.path === 'translation'); if (!ch) continue;
  const s = an.samplers[ch.sampler], { f, n } = readAcc(B, s.output);
  const out = new Float32Array(f.length);
  const first = qrot(parentRotB, [f[0], f[1], f[2]]);
  let travel = 0;
  for (let i = 0; i < n; i++) {
    const w = qrot(parentRotB, [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]]);
    if (i === n - 1) travel = Math.hypot(w[0] - first[0], w[2] - first[2]);
    const local = qrot(qinv(parentRotB), [first[0], w[1], first[2]]);   // y (up) stays, x/z held at the first key
    out.set(local, i * 3);
  }
  s.output = addAcc(out, 'VEC3'); stripped.push(`${an.name} ${travel.toFixed(2)} m`);
}
console.log('in place:', stripped.join(', '));

// ---- 2. stand-ins from the classic hero, retargeted ---------------------------------------------------------------------------------------------------------------------------
const hipA = (() => { let y = 0, i = pelvisA; const t = A.j.nodes[i].translation ?? [0, 0, 0]; return Math.hypot(...t); })(), hipB = Math.hypot(...(j.nodes[pelvisB].translation ?? [0, 0, 0]));
const hipRatio = hipB / hipA;
const parentRotA = pA[pelvisA] < 0 ? [0, 0, 0, 1] : wA[pA[pelvisA]];
const replaced = [];
for (const name of REPLACE) {
  const ca = A.j.animations.find((a) => a.name === name), ib = j.animations.findIndex((a) => a.name === name);
  assert.ok(ca && ib >= 0, `${name} missing in classic or exo file`);
  const track = new Map();   // joint name -> { times, values }
  for (const c of ca.channels) { const nm = A.j.nodes[c.target.node].name, s = ca.samplers[c.sampler]; if (c.target.path === 'rotation') track.set(nm, { t: readAcc(A, s.input).f, q: readAcc(A, s.output).f }); else if (nm === 'pelvis' && c.target.path === 'translation') track.set('pelvis.t', { t: readAcc(A, s.input).f, v: readAcc(A, s.output).f }); }
  const ref = track.get('pelvis'), times = ref.t, nk = times.length;
  for (const [k, tr] of track) assert.ok(tr.t.length === nk && tr.t.every((x, i) => Math.abs(x - times[i]) < 1e-5), `${name}: track ${k} has different key times (the classic clips are sampled together)`);
  // per key, B's local rotation of every joint
  const outQ = new Map(jointsB.map((nm) => [nm, new Float32Array(nk * 4)]));
  for (let key = 0; key < nk; key++) {
    const wanimA = new Map(), wanimB = new Map();
    const animA = (i) => { if (wanimA.has(i)) return wanimA.get(i); const nm = A.j.nodes[i].name, tr = track.get(nm), q = tr ? qnorm([tr.q[key * 4], tr.q[key * 4 + 1], tr.q[key * 4 + 2], tr.q[key * 4 + 3]]) : restQ(A.j.nodes[i]); const w = pA[i] < 0 ? q : qnorm(qmul(animA(pA[i]), q)); wanimA.set(i, w); return w; };
    const animB = (i) => {   // returns [worldAnim, local]
      if (wanimB.has(i)) return wanimB.get(i);
      const nm = j.nodes[i].name, ai = aIndex.get(nm);
      let world;
      if (ai === undefined || !track.has(nm)) world = pB[i] < 0 ? restQ(j.nodes[i]) : qnorm(qmul(animB(pB[i])[0], restQ(j.nodes[i])));   // not animated by the classic clip: stays at rest under its animated parent
      else world = qnorm(qmul(qmul(animA(ai), qinv(wA[ai])), wB[i]));   // the classic bone's world delta from rest, applied to B's rest orientation
      const parentW = pB[i] < 0 ? [0, 0, 0, 1] : animB(pB[i])[0];
      const local = qnorm(qmul(qinv(parentW), world));
      wanimB.set(i, [world, local]); return [world, local];
    };
    for (const nm of jointsB) { const l = animB(nodeIndex.get(nm))[1]; outQ.get(nm).set(l, key * 4); }
  }
  // pelvis translation: the classic's VERTICAL delta from its rest height, scaled to B's hips; no horizontal travel
  const pv = track.get('pelvis.t'), restTA = A.j.nodes[pelvisA].translation, restTB = j.nodes[pelvisB].translation;
  const outT = new Float32Array(nk * 3);
  for (let key = 0; key < nk; key++) {
    const d = [pv.v[key * 3] - restTA[0], pv.v[key * 3 + 1] - restTA[1], pv.v[key * 3 + 2] - restTA[2]];
    const dw = qrot(parentRotA, d), up = [0, dw[1] * hipRatio, 0];
    const lb = qrot(qinv(parentRotB), up); outT.set([restTB[0] + lb[0], restTB[1] + lb[1], restTB[2] + lb[2]], key * 3);
  }
  const tAcc = addAcc(new Float32Array(times), 'SCALAR', { min: [times[0]], max: [times[nk - 1]] });
  const samplers = [], channels = [];
  for (const nm of jointsB) { samplers.push({ input: tAcc, output: addAcc(outQ.get(nm), 'VEC4') }); channels.push({ sampler: samplers.length - 1, target: { node: nodeIndex.get(nm), path: 'rotation' } }); }
  samplers.push({ input: tAcc, output: addAcc(outT, 'VEC3') }); channels.push({ sampler: samplers.length - 1, target: { node: pelvisB, path: 'translation' } });
  j.animations[ib] = { name, samplers, channels };
  replaced.push(`${name} (${nk} keys, ${(times[nk - 1]).toFixed(2)} s)`);
}
console.log('replaced from the classic hero:', replaced.join(', '));

j.buffers[0].byteLength = bin.length;
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
head.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
fs.writeFileSync(outFile, Buffer.concat([head, jh, jp, bh, bin]));
console.log(outFile, fs.statSync(outFile).size, 'bytes');

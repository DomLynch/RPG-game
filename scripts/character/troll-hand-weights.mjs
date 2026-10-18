// Cave Troll hand skin weights (Characters & Art, 2026-10-18).
//
// The shipped troll (public/beasts/cave-troll.glb, built by scripts/character/creatures.py + creature_pack.py) carries NO skin weight on any finger bone
// and almost none on hand_l/hand_r. Worse, its fists ride the thighs and the pelvis (the creatures.py nearest-body transfer grabbed them: the fist hangs
// beside the hip) while the forearms ride lowerarm. Anything bound to a hand bone (a weapon, a glove) therefore floats off the claw. This patch
// re-weights the hand region only.
//
// It edits ONLY the two uncompressed skin attribute views (JOINTS_0, WEIGHTS_0) in place: same byte lengths, same offsets, so the geometry, the
// meshopt-packed views, the 27 clips, the 65-bone skeleton, the materials and the topology stay byte-identical. (A Blender round trip would re-export
// all of those and drift the packing.) uint8 weights keep the build's invariant: each vertex's four weights sum to exactly 255. The generator hash in
// the file's extras (creatureSource.generatorSha256) is untouched because creatures.py is untouched: a fresh `build-creatures cave-troll` would
// produce the old weights again, so run this after it (or fold the idea into creatures.py).
//
// Method, per side (bone origins are the bind pose recovered from the skin's inverse bind matrices; the mesh is in that same bind space):
//   1. hand region: vertices within HAND_REACH of a hand bone's bind segment (palm, fingers, thumb), outboard of the thigh/hip (|x| > ARM_EDGE) and not
//      more than WRIST_BAND above the wrist, with a soft membership 0..1 at each of those edges;
//   2. new weights: along the forearm->hand axis a smoothstep through the wrist (WRIST_BAND) hands weight from lowerarm to the hand chain; the hand
//      chain share is split between hand, finger and thumb bones by distance to each bone's bind segment (softmax, FINGER_TAU; the palm bone is favoured
//      by HAND_BIAS because a giant's fist is a solid mass around the palm);
//   3. blend old -> new by the membership, smooth the member vertices SMOOTH_STEPS times over the welded mesh graph so the wrist and the knuckles do
//      not tear, keep four influences, quantize to uint8 summing to 255.
// Vertices with membership 0 keep their exact bytes.
//
//   node scripts/character/troll-hand-weights.mjs <in.glb> <out.glb>   (in = the ORIGINAL engine body; refuses a body whose fingers are already weighted)
// then regenerate the world body from the result with the repo's own generator and pack it:
//   blender -b -P scripts/character/world_body.py -- <out.glb> <world.glb> 8000 1024 && node scripts/pack-world-body.mjs <world.glb>
import fs from 'node:fs';
import { MeshoptDecoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: node scripts/character/troll-hand-weights.mjs <in.glb> <out.glb>');

// Tuning (metres, bind space of the 1.84 m troll body; the troll is drawn x1.9).
const HAND_REACH = 0.32;      // vertices farther than this from every hand bone segment are not hand (the fist is ~25 cm deep about the bones)
const EDGE_FALLOFF = 0.06;    // membership fades out over the last 6 cm of HAND_REACH
const ARM_EDGE = Number(process.env.TROLL_ARM_EDGE ?? 0.36);       // |x| below this is trunk/leg side (z-slices of the bind pose: thigh and hip surface end at 0.32, the fist ring starts at 0.40, its claw tips reach in to ~0.33)
const WRIST_BAND = 0.07;      // half width of the lowerarm -> hand blend, either side of the hand bone's head along the forearm axis
const FINGER_TAU = 0.03;      // softmax scale for hand/finger/thumb bone shares
// HAND_BIAS: metres taken off the palm bone's distance. 1 = the whole fist rides hand_* and the finger bones carry nothing (the shipped setting): it is a solid
// giant's fist and the hero clips curl the 1.8 m rig's fingers, so finger-weighted variants (TROLL_HAND_BIAS=0.04 and 0.10, tried 2026-10-18) crumpled it and
// tore more edges than the rigid fist (ready pose, edges grown >2.5x: 1,578 at 0.04 vs 1,127 rigid vs 1,228 for the original body). TROLL_HAND_BIAS=0.10 gives fingers/thumb a share.
const HAND_BIAS = Number(process.env.TROLL_HAND_BIAS ?? 1);
const SMOOTH_STEPS = 3;
const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

const raw = fs.readFileSync(input);
const jsonLen = raw.readUInt32LE(12), d = JSON.parse(raw.subarray(20, 20 + jsonLen));
const binStart = 28 + jsonLen, bin = Buffer.from(raw.subarray(binStart));
await MeshoptDecoder.ready;

/** A bufferView's bytes: meshopt views are decoded, plain views are a window into `bin` (writes land in the output). */
function viewBytes(i) {
  const v = d.bufferViews[i], mo = v.extensions?.EXT_meshopt_compression;
  if (!mo) return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const out = new Uint8Array(mo.count * mo.byteStride);
  MeshoptDecoder.decodeGltfBuffer(out, mo.count, mo.byteStride, bin.subarray(mo.byteOffset || 0, (mo.byteOffset || 0) + mo.byteLength), mo.mode, mo.filter || 'NONE');
  return out;
}
const f32 = (u8, n) => new Float32Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + n * 4));

const node = d.nodes.find((n) => n.mesh !== undefined && n.skin !== undefined);
const prim = d.meshes[node.mesh].primitives[0];
const posAcc = d.accessors[prim.attributes.POSITION], count = posAcc.count;
const pos = f32(viewBytes(posAcc.bufferView), count * 3);
const jAcc = d.accessors[prim.attributes.JOINTS_0], wAcc = d.accessors[prim.attributes.WEIGHTS_0];
for (const a of [jAcc, wAcc]) {
  const v = d.bufferViews[a.bufferView];
  if (a.componentType !== 5121 || v.extensions?.EXT_meshopt_compression || (a.byteOffset || 0) !== 0) throw new Error('JOINTS_0/WEIGHTS_0 must be plain uint8 views');
}
const jView = d.bufferViews[jAcc.bufferView], wView = d.bufferViews[wAcc.bufferView];
const J = bin.subarray(jView.byteOffset, jView.byteOffset + count * 4), W = bin.subarray(wView.byteOffset, wView.byteOffset + count * 4);

const skin = d.skins[node.skin], names = skin.joints.map((j) => d.nodes[j].name), idx = new Map(names.map((n, i) => [n, i]));
const ibm = f32(viewBytes(d.accessors[skin.inverseBindMatrices].bufferView), names.length * 16);
function bindHead(name) {   // a bone's bind origin in mesh space: -inverse(linear part of its IBM) * translation (general 3x3 inverse: a bone may carry scale)
  const m = ibm.subarray(idx.get(name) * 16, idx.get(name) * 16 + 16);
  const [a, b, c, d0, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];   // row-major rows of the linear part
  const det = a * (e * i - f * h) - b * (d0 * i - f * g) + c * (d0 * h - e * g);
  const inv = [(e * i - f * h), -(b * i - c * h), (b * f - c * e), -(d0 * i - f * g), (a * i - c * g), -(a * f - c * d0), (d0 * h - e * g), -(a * h - b * g), (a * e - b * d0)].map((x) => x / det);
  const t = [m[12], m[13], m[14]];
  return [-(inv[0] * t[0] + inv[1] * t[1] + inv[2] * t[2]), -(inv[3] * t[0] + inv[4] * t[1] + inv[5] * t[2]), -(inv[6] * t[0] + inv[7] * t[1] + inv[8] * t[2])];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
function segDist(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab), t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return len(sub(p, add(a, mul(ab, t))));
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Fingers already weighted? Then this patch ran (or the body was rebuilt with fingers): refuse rather than blend twice.
{
  const fingerIds = new Set(names.filter((n) => FINGERS.some((f) => n.startsWith(f + '_'))).map((n) => idx.get(n)));
  let n = 0; for (let i = 0; i < count; i++) for (let k = 0; k < 4; k++) if (W[i * 4 + k] > 2 && fingerIds.has(J[i * 4 + k])) n++;
  if (n > 50) throw new Error(`${input}: ${n} finger influences already present; run this on the original engine body`);
}

// Trunk and leg bone segments (the fist hangs beside the hip, and its claw tips curl toward it).
const body = [['pelvis', 'spine_01'], ['spine_01', 'spine_02'], ['spine_02', 'spine_03']].map(([a, b]) => [bindHead(a), bindHead(b)]);
for (const t of ['l', 'r']) body.push([bindHead(`thigh_${t}`), bindHead(`calf_${t}`)], [bindHead(`calf_${t}`), bindHead(`foot_${t}`)]);
// Per-side bone segments: palm (wrist -> mean knuckle) and every finger/thumb phalanx.
const sides = ['l', 'r'].map((s) => {
  const H = (n) => bindHead(`${n}_${s}`);
  const handHead = H('hand'), forearmHead = H('lowerarm'), chains = {};   // chains: bone name -> [a, b]
  const knuckles = FINGERS.filter((f) => f !== 'thumb').map((f) => H(`${f}_01`));
  chains[`hand_${s}`] = [handHead, mul(knuckles.reduce((a, k) => add(a, k), [0, 0, 0]), 1 / knuckles.length)];
  for (const f of FINGERS) {
    const joints = [1, 2, 3].map((i) => H(`${f}_0${i}`)), leaf = H(`${f}_04_leaf`);
    chains[`${f}_01_${s}`] = [joints[0], joints[1]];
    chains[`${f}_02_${s}`] = [joints[1], joints[2]];
    chains[`${f}_03_${s}`] = [joints[2], add(leaf, mul(sub(leaf, joints[2]), 0.5))];   // the tip reaches 50 % past the leaf bone
  }
  const axis = sub(handHead, forearmHead);
  return { s, handHead, axis: mul(axis, 1 / len(axis)), chains, handSet: Object.values(chains), sign: s === 'l' ? 1 : -1 };   // +x is the left side
});

// Membership and the new weights of every hand-region vertex.
const member = new Float32Array(count), target = new Map();   // vertex -> Map(joint index -> new weight)
for (let i = 0; i < count; i++) {
  const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const sd = sides.find((s) => s.sign === Math.sign(p[0]));
  if (!sd) continue;
  let dh = Infinity; for (const [a, b] of sd.handSet) dh = Math.min(dh, segDist(p, a, b));
  if (dh >= HAND_REACH) continue;
  const along = dot(sub(p, sd.handHead), sd.axis);   // metres past the hand bone's head along the forearm axis
  // Forearm vertices more than WRIST_BAND above the wrist are left alone (the region fades in over the 3 cm before the band).
  let db = Infinity; for (const [a, b] of body) db = Math.min(db, segDist(p, a, b));   // nearest trunk/leg bone: a claw tip curling in toward the hip is still the hand's
  const m = smooth(ARM_EDGE - 0.02, ARM_EDGE + 0.02, Math.abs(p[0])) * smooth(-0.03, 0.03, db - dh) * (1 - smooth(HAND_REACH - EDGE_FALLOFF, HAND_REACH, dh)) * smooth(-WRIST_BAND - 0.03, -WRIST_BAND, along);
  if (m < 1e-3) continue;
  member[i] = m;
  const g = smooth(-WRIST_BAND, WRIST_BAND, along);   // 0 = forearm side of the wrist, 1 = hand side
  const ds = Object.entries(sd.chains).map(([n, [a, b]]) => [n, segDist(p, a, b) - (n.startsWith('hand_') ? HAND_BIAS : 0)]);
  const dmin = Math.min(...ds.map(([, x]) => x));
  const ex = ds.map(([n, x]) => [n, Math.exp(-(x - dmin) / FINGER_TAU)]), tot = ex.reduce((a, [, x]) => a + x, 0);
  const w = new Map([[idx.get(`lowerarm_${sd.s}`), 1 - g]]);
  for (const [n, x] of ex) w.set(idx.get(n), (w.get(idx.get(n)) || 0) + g * x / tot);
  target.set(i, w);
}

// Welded mesh graph (UV-seam copies share a position): smoothing and the copies' agreement run over it.
const welded = new Int32Array(count); { const keys = new Map(); for (let i = 0; i < count; i++) { const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`; if (!keys.has(k)) keys.set(k, keys.size); welded[i] = keys.get(k); } }
const nWelded = Math.max(...welded) + 1;
const idxAcc = d.accessors[prim.indices], ib = viewBytes(idxAcc.bufferView);
const tri = idxAcc.componentType === 5125 ? new Uint32Array(ib.buffer.slice(ib.byteOffset, ib.byteOffset + idxAcc.count * 4)) : new Uint16Array(ib.buffer.slice(ib.byteOffset, ib.byteOffset + idxAcc.count * 2));
const nbr = Array.from({ length: nWelded }, () => new Set());
for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) { const a = welded[tri[t + k]], b = welded[tri[t + (k + 1) % 3]]; if (a !== b) { nbr[a].add(b); nbr[b].add(a); } }
const wmem = new Float32Array(nWelded);   // membership of a welded vertex = max over its copies
for (let i = 0; i < count; i++) wmem[welded[i]] = Math.max(wmem[welded[i]], member[i]);

const rowOf = (i) => { const r = new Map(); for (let k = 0; k < 4; k++) if (W[i * 4 + k]) r.set(J[i * 4 + k], (r.get(J[i * 4 + k]) || 0) + W[i * 4 + k] / 255); return r; };
// Blend old -> new per source vertex by its membership, then average the copies of each welded vertex.
const rows = new Array(nWelded), blendCount = new Int32Array(nWelded);
for (let i = 0; i < count; i++) {
  if (!member[i]) continue;
  const out = new Map();
  for (const [j, w] of rowOf(i)) out.set(j, (1 - member[i]) * w);
  for (const [j, w] of target.get(i)) out.set(j, (out.get(j) || 0) + member[i] * w);
  const k = welded[i];
  if (!rows[k]) rows[k] = new Map();
  for (const [j, w] of out) rows[k].set(j, (rows[k].get(j) || 0) + w);
  blendCount[k]++;
}
for (let k = 0; k < nWelded; k++) if (rows[k]) for (const [j, w] of rows[k]) rows[k].set(j, w / blendCount[k]);
// Smoothing: member vertices relax toward the mean of their neighbours (a non-member neighbour contributes its original, fixed weights).
const firstCopy = new Int32Array(nWelded).fill(-1); for (let i = 0; i < count; i++) if (firstCopy[welded[i]] < 0) firstCopy[welded[i]] = i;
const current = (k) => rows[k] || rowOf(firstCopy[k]);
for (let step = 0; step < SMOOTH_STEPS; step++) {
  const next = new Array(nWelded);
  for (let k = 0; k < nWelded; k++) {
    if (!rows[k] || !nbr[k].size) continue;
    const acc = new Map();
    for (const nb of nbr[k]) for (const [j, w] of current(nb)) acc.set(j, (acc.get(j) || 0) + w / nbr[k].size);
    const out = new Map(), a = 0.5 * wmem[k];   // relax strength follows membership so the region edge stays put
    for (const [j, w] of rows[k]) out.set(j, (1 - a) * w);
    for (const [j, w] of acc) out.set(j, (out.get(j) || 0) + a * w);
    next[k] = out;
  }
  for (let k = 0; k < nWelded; k++) if (next[k]) rows[k] = next[k];
}

// Write back: top four influences, uint8 summing to exactly 255 (largest remainder); non-members are untouched.
let changed = 0;
for (let i = 0; i < count; i++) {
  if (!member[i]) continue;
  const top = [...rows[welded[i]]].filter(([, w]) => w > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((a, [, w]) => a + w, 0);
  const parts = top.map(([j, w]) => [j, Math.floor(w / tot * 255), (w / tot * 255) % 1]);
  let rest = 255 - parts.reduce((a, [, f]) => a + f, 0);
  for (const e of [...parts].sort((a, b) => b[2] - a[2])) { if (rest <= 0) break; e[1]++; rest--; }
  for (let k = 0; k < 4; k++) { J[i * 4 + k] = parts[k] ? parts[k][0] : 0; W[i * 4 + k] = parts[k] ? parts[k][1] : 0; }
  changed++;
}
fs.writeFileSync(output, Buffer.concat([raw.subarray(0, binStart), bin]));
console.log(`${input} -> ${output}: re-weighted ${changed} of ${count} vertices (${sides.map((s) => `${s.s}: ${[...member].filter((m, i) => m && Math.sign(pos[i * 3]) === s.sign).length}`).join(', ')})`);

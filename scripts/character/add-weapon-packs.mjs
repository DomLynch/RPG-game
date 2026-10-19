// Append a two-handed weapon's clip pack to a creature body, so fighterClips(asset, weapon, true) stops throwing MissingClip (Characters, 2026-10-18).
// The hero rig's weapon packs (Warhammer_*, Maul_*, Scythe_*, Trident_*) are authored on the 65 bones every creature body shares (same names, same rotations).
// This copies the exact clips fighterClips asks for (src/fight/characters.ts clipFor over ROLES, minus what the body already carries; nothing extra) from a hero-rig
// donor GLB onto the body's existing joint nodes, then re-packs the file with scripts/pack-world-body.mjs (meshopt, animation bit-exact).
// Every list and number (donors, the goblin's hunch and bob, which body carries which weapons) is the row scripts/character/weapon-packs.json; this file holds none.
//
//   node scripts/character/add-weapon-packs.mjs --write-baseline              record the bodies' generic-clip digests (before --all; tests/creature-packs.baseline.json)
//   node scripts/character/add-weapon-packs.mjs --all                         every body the row lists, in place
//   node scripts/character/add-weapon-packs.mjs <body.glb> [--weapons a,b] [--retarget name] [--donor weapon=path] [--out file]   one body (the row supplies what is left out)
//
// retarget "identity" (hero-rig bodies, the troll): the donor's keys are copied verbatim.
// retarget "goblin": the goblin's generic clips are the hero's put through scripts/build-warrior.mjs BUILD.goblin: every key of the hunch bones is post-rotated
//                    about the bone's own rest sideways axis and the pelvis position is rest_goblin + bob * (hero - rest_hero) (shorter legs sway the hips less).
//                    The run prints how closely the same retarget reproduces the body's own generic clips.
// The ground clamp (BUILD.floor) only touches Roll, which no pack carries. A body that already has a pack clip keeps it: rerunning adds nothing.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ROLES, clipFor } from '../../src/fight/characters.ts';

const HERE = import.meta.dirname;
/** The clip-pack row: { donors, retargets, bodies, pelvisTolerance }. */
export const ROW = JSON.parse(fs.readFileSync(path.join(HERE, 'weapon-packs.json'), 'utf8'));
export const DONORS = ROW.donors;
export const RETARGETS = ROW.retargets;
const PACK_PREFIX = new RegExp(`^(${Object.keys(DONORS).map((w) => w[0].toUpperCase() + w.slice(1)).join('|')})_`);
const prefixOf = (weapon) => weapon[0].toUpperCase() + weapon.slice(1) + '_';

/** Read a GLB (meshopt or plain) into { json, bin } with every bufferView decoded, packed back to back in buffer 0. */
export async function readGlb(file) {
  const raw = fs.readFileSync(file), n = raw.readUInt32LE(12), json = JSON.parse(raw.subarray(20, 20 + n)), src = raw.subarray(28 + n);
  await MeshoptDecoder.ready;
  const chunks = []; let offset = 0;
  json.bufferViews = json.bufferViews.map((v) => {
    const ext = v.extensions?.EXT_meshopt_compression;
    let bytes;
    if (ext) {
      const out = new Uint8Array(ext.count * ext.byteStride);
      MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter ?? 'NONE');
      bytes = Buffer.from(out);
    } else bytes = src.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const next = { ...v, buffer: 0, byteOffset: offset, byteLength: bytes.length }; delete next.extensions;
    chunks.push(bytes); offset += bytes.length; const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    return next;
  });
  json.buffers = [{ byteLength: offset }];
  for (const key of ['extensionsUsed', 'extensionsRequired']) if (json[key]) { json[key] = json[key].filter((x) => x !== 'EXT_meshopt_compression'); if (!json[key].length) delete json[key]; }
  return { json, bin: Buffer.concat(chunks) };
}

/** The accessor's numbers as a fresh Float32Array (animation data is float, unsparse, tightly packed). */
export function floats({ json, bin }, index) {
  const a = json.accessors[index], v = json.bufferViews[a.bufferView], width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  if (a.componentType !== 5126 || a.sparse || !width || (v.byteStride && v.byteStride !== width * 4)) throw new Error(`accessor ${index}: not tightly packed float data`);
  const out = new Float32Array(a.count * width), view = new DataView(bin.buffer, bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0));
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

const jointsOf = ({ json }) => new Map(json.skins[0].joints.map((n) => [json.nodes[n].name, n]));

/** A function (boneName, path, values) -> void that turns the donor's keys into this body's (in place). */
export function makeRetarget(spec, body, donor) {
  if (!spec.hunch && spec.bob === undefined) return () => {};
  const { json } = body, skin = json.skins[0], ibm = floats(body, skin.inverseBindMatrices), names = skin.joints.map((n) => json.nodes[n].name);
  const bind = (name) => { const i = names.indexOf(name); if (i < 0) throw new Error(`retarget: no bone ${name}`); return new Matrix4().fromArray(ibm, i * 16).invert(); };
  // build-warrior's hunch: forward bend = rotation about the fighter's left-right axis, taken in each bone's own rest frame
  const facing = new Vector3().subVectors(new Vector3().setFromMatrixPosition(bind('ball_l')), new Vector3().setFromMatrixPosition(bind('foot_l'))).setY(0).normalize();
  const sideways = new Vector3(0, 1, 0).cross(facing).normalize(), delta = new Map();
  for (const [name, degrees] of spec.hunch ?? []) {
    const local = sideways.clone().applyQuaternion(new Quaternion().setFromRotationMatrix(bind(name)).invert()).normalize();
    delta.set(name, new Quaternion().setFromAxisAngle(local, degrees * Math.PI / 180));
  }
  const restOf = (g, name) => g.json.nodes[jointsOf(g).get(name)].translation;
  const mine = restOf(body, 'pelvis'), theirs = restOf(donor, 'pelvis'), q = new Quaternion();
  return (name, pathName, values) => {
    if (pathName === 'rotation' && delta.has(name)) for (let i = 0; i < values.length; i += 4) { q.fromArray(values, i).multiply(delta.get(name)); q.toArray(values, i); }
    if (pathName === 'translation' && spec.bob !== undefined) {
      if (name !== 'pelvis') throw new Error(`retarget: a translation track on ${name} (only the pelvis is retargeted)`);
      for (let i = 0; i < values.length; i += 3) for (let c = 0; c < 3; c++) values[i + c] = mine[c] + spec.bob * (values[i + c] - theirs[c]);
    }
  };
}

/** The clip as { name, duration, tracks: Map 'bone.path' -> { times, values } } with the retarget applied. */
export function readClip(g, name, retarget = () => {}) {
  const anim = g.json.animations?.find((a) => a.name === name);
  if (!anim) return null;
  const tracks = new Map();
  for (const ch of anim.channels) {
    const bone = g.json.nodes[ch.target.node].name, s = anim.samplers[ch.sampler];
    if ((s.interpolation ?? 'LINEAR') !== 'LINEAR') throw new Error(`${name}: ${bone} ${ch.target.path} is ${s.interpolation}, only LINEAR is copied`);
    const times = floats(g, s.input), values = floats(g, s.output);
    retarget(bone, ch.target.path, values);
    tracks.set(`${bone}.${ch.target.path}`, { bone, path: ch.target.path, times, values });
  }
  return { name, tracks };
}

/** Add the clips to the (decoded) body. Returns the raw uncompressed GLB bytes. */
function appendClips(body, clips) {
  const { json } = body, joints = jointsOf(body), extra = [], cache = new Map();
  let offset = body.bin.length;
  const accessor = (data, type) => {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength), key = `${type}:${createHash('sha1').update(bytes).digest('hex')}`;
    if (cache.has(key)) return cache.get(key);
    const view = json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }) - 1, width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type], count = data.length / width, entry = { bufferView: view, componentType: 5126, count, type };
    if (type === 'SCALAR') { entry.min = [Math.min(...data)]; entry.max = [Math.max(...data)]; }
    extra.push(bytes); offset += bytes.length;
    const id = json.accessors.push(entry) - 1; cache.set(key, id); return id;
  };
  json.animations ??= [];
  for (const clip of clips) {
    const anim = { name: clip.name, samplers: [], channels: [] }; let skipped = 0;
    for (const t of clip.tracks.values()) {
      const node = joints.get(t.bone);
      if (node === undefined) { skipped++; continue; }
      anim.samplers.push({ input: accessor(t.times, 'SCALAR'), output: accessor(t.values, t.path === 'rotation' ? 'VEC4' : 'VEC3'), interpolation: 'LINEAR' });
      anim.channels.push({ sampler: anim.samplers.length - 1, target: { node, path: t.path } });
    }
    if (!anim.channels.length) throw new Error(`${clip.name}: no channel lands on a joint of the body`);
    json.animations.push(anim);
    console.log(`  + ${clip.name}: ${anim.channels.length} channels${skipped ? `, ${skipped} off-skeleton channels skipped` : ''}`);
  }
  const bin = Buffer.concat([body.bin, ...extra.flatMap((b) => [b, Buffer.alloc((4 - b.length % 4) % 4)])]);
  json.buffers = [{ byteLength: bin.length }];
  let j = Buffer.from(JSON.stringify(json)); j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 32)]);
  const out = Buffer.alloc(28 + j.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(j.length, 12); out.writeUInt32LE(0x4e4f534a, 16); j.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length); bin.copy(out, 28 + j.length);
  return out;
}

/** How closely the retarget reproduces the body's own generic clips from the donor's (max abs key difference). */
function agreement(body, donor, retarget) {
  const rows = [];
  for (const name of ['Idle', 'Walk', 'StrafeLeft', 'Hit', 'Death']) {
    const own = readClip(body, name), theirs = readClip(donor, name, retarget);
    if (!own || !theirs) continue;
    let rot = 0, pel = 0, rotBone = '';
    for (const [key, t] of theirs.tracks) {
      const o = own.tracks.get(key); if (!o || o.values.length !== t.values.length) continue;
      let d = 0;
      if (t.path === 'rotation') for (let i = 0; i < t.values.length; i += 4) {   // q and -q are the same rotation: take the nearer sign
        let plus = 0, minus = 0; for (let c = 0; c < 4; c++) { plus = Math.max(plus, Math.abs(t.values[i + c] - o.values[i + c])); minus = Math.max(minus, Math.abs(t.values[i + c] + o.values[i + c])); }
        d = Math.max(d, Math.min(plus, minus));
      } else for (let i = 0; i < t.values.length; i++) d = Math.max(d, Math.abs(t.values[i] - o.values[i]));
      if (t.path === 'translation') pel = Math.max(pel, d); else if (d > rot) { rot = d; rotBone = t.bone; }
    }
    rows.push(`${name}: rotation ${rot.toExponential(1)}${rot > 1e-4 ? ` (worst ${rotBone})` : ''}, pelvis ${pel.toExponential(1)}`);
  }
  return rows.join('; ');
}

/** sha1 per clip of every track (key, times, values) for the clips that are NOT a weapon pack: what must stay byte-identical when a pack is added (tests/creature-packs.test.ts). */
export async function digestGeneric(file) {
  const g = await readGlb(file), out = {};
  for (const a of g.json.animations ?? []) {
    if (PACK_PREFIX.test(a.name)) continue;
    const h = createHash('sha1'), clip = readClip(g, a.name);
    for (const key of [...clip.tracks.keys()].sort()) { const t = clip.tracks.get(key); h.update(key).update(Buffer.from(t.times.buffer)).update(Buffer.from(t.values.buffer)); }
    out[a.name] = h.digest('hex');
  }
  return out;
}

/** Add the packs of `weapons` to one body file (written to `out`, in place by default). */
export async function addPacks(file, { weapons, retarget = 'identity', donors = {}, out = file }) {
  const spec = RETARGETS[retarget];
  if (!spec) throw new Error(`unknown retarget ${retarget}`);
  const donorPaths = { ...DONORS, ...donors }, body = await readGlb(file), have = new Set((body.json.animations ?? []).map((a) => a.name)), clips = [];
  for (const weapon of weapons) {
    if (!DONORS[weapon]) throw new Error(`unknown weapon ${weapon}`);
    const names = [...new Set(ROLES.map((r) => clipFor(weapon, r)))].filter((n) => n.startsWith(prefixOf(weapon)) && !have.has(n));
    if (!names.length) { console.log(`${weapon}: ${file} already carries the pack`); continue; }
    const donor = await readGlb(donorPaths[weapon]), fit = makeRetarget(spec, body, donor);
    console.log(`${weapon}: donor ${donorPaths[weapon]}; retarget vs the body's own clips: ${agreement(body, donor, fit)}`);
    for (const name of names) { const clip = readClip(donor, name, fit); if (!clip) throw new Error(`${donorPaths[weapon]} has no ${name}`); clips.push(clip); }
  }
  if (!clips.length) return;
  const before = fs.readFileSync(file);
  fs.writeFileSync(out, appendClips(body, clips));
  execFileSync(process.execPath, [path.join(HERE, '..', 'pack-world-body.mjs'), out], { stdio: 'inherit', timeout: 600_000 });
  console.log(`${file}: ${before.length} B, ${gzipSync(before).length} gzip -> ${out}: ${fs.statSync(out).size} B, ${gzipSync(fs.readFileSync(out)).length} gzip`);
}

async function main() {
  const args = process.argv.slice(2), opt = (name) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
  // --write-baseline: record every listed body's generic-clip digests (run it BEFORE --all; the test then proves the packs changed none of them).
  if (args.includes('--write-baseline')) {
    const baseline = {}; for (const b of ROW.bodies) baseline[b.file] = await digestGeneric(b.file);
    fs.writeFileSync(path.join(HERE, '..', '..', 'tests', 'creature-packs.baseline.json'), JSON.stringify(baseline, null, 1) + '\n'); return;
  }
  if (args.includes('--all')) { for (const b of ROW.bodies) await addPacks(b.file, b); return; }
  const file = args[0], listed = ROW.bodies.find((b) => b.file === file);
  const donors = {}; args.forEach((a, i) => { if (a === '--donor') { const [w, p] = args[i + 1].split('='); donors[w] = p; } });
  const weapons = (opt('weapons') ?? listed?.weapons?.join(',') ?? '').split(',').filter(Boolean), retarget = opt('retarget') ?? listed?.retarget ?? 'identity';
  if (!file || file.startsWith('--') || !weapons.length) throw new Error('usage: node scripts/character/add-weapon-packs.mjs (--all | <body.glb> [--weapons a,b] [--retarget name] [--donor weapon=path] [--out file])');
  await addPacks(file, { weapons, retarget, donors, out: opt('out') ?? file });
}
if (import.meta.main ?? process.argv[1] === import.meta.filename) await main();

// The four beta specials' own animation (Skull Crack, Whirlwind, Ground Slam, Lunge), baked onto the 65-bone hero rig as plain clip JSON beside warrior.glb (the build-hamstrung.mjs
// pattern: adopted at runtime by characters.ts adoptClip, warrior.glb untouched).
//   Lunge ........ CC0 Quaternius UAL2 Sword_Dash, same skeleton as ours: local-rotation correction (build-warrior.mjs retargetClip), no Mixamo content.
//   the other three: Adobe Mixamo (docs/specs/combat/mixamo-plan.md): the FBX never enters the repo; scripts/character/mixamo_dump.py turns each into a private JSON of world
//   bone poses, and this file aims every bone of OUR rig along the source bone's direction (with the source twist), so the T-pose vs A-pose rest difference never matters.
//   Only the baked clip JSON below and the provenance row in src/assets/README.md are committed.
// Run (needs node_modules; the dump dir and the UAL2 glb are private inputs):
//   MIXAMO_DUMP=/srv/dev-jobs/mixamo-drop/dump UAL2_GLB=.../UAL2_Standard.glb node scripts/build-special-clips.mjs
import fs from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import DEFS from '../src/assets/special-clips.json' with { type: 'json' };
const SPECIAL_CLIPS = DEFS.clips;

const DUMP = process.env.MIXAMO_DUMP ?? '/srv/dev-jobs/mixamo-drop/dump';
const UAL2 = process.env.UAL2_GLB ?? `${process.env.HOME}/Downloads/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`;
const WARRIOR = new URL('../src/assets/warrior.glb', import.meta.url);
const round = (a) => Array.from(a, (v) => Math.round(v * 1e5) / 1e5);
globalThis.ProgressEvent ??= class { constructor(_, fields) { Object.assign(this, fields); } };

async function loadGlb(url, strip) {
  const bytes = await fs.readFile(url);
  if (!strip) return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size));
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const hero = await loadGlb(WARRIOR, true), scene = hero.scene;
scene.updateMatrixWorld(true);
const nodes = []; scene.traverse((o) => nodes.push(o));
const bones = nodes.filter((o) => o.isBone && o.name !== 'root');
const saved = nodes.map((o) => [o, o.position.clone(), o.quaternion.clone()]);
const restore = () => { for (const [o, p, q] of saved) { o.position.copy(p); o.quaternion.copy(q); } scene.updateMatrixWorld(true); };
const bone = (n) => scene.getObjectByName(n);
const wpos = (o) => o.getWorldPosition(new T.Vector3()), wquat = (o) => o.getWorldQuaternion(new T.Quaternion());

// ---- UAL2: same skeleton, correct each bone's rest difference (the proven build-warrior.mjs path), horizontal pelvis travel dropped (the sim owns position)
async function ualClip(name, source, { from = 0, to = Infinity } = {}) {
  const lib = await loadGlb(UAL2, false); lib.scene.updateMatrixWorld(true);
  const original = lib.animations.find((a) => a.name === source);
  if (!original) throw Error('UAL2 has no ' + source);
  const end = Math.min(to, original.duration), tracks = [];
  for (const track of original.tracks) {
    const [b, property] = track.name.split('.'), target = bone(b), src = lib.scene.getObjectByName(b);
    if (!target || !src || b === 'root' || (property !== 'quaternion' && !(property === 'position' && b === 'pelvis'))) continue;
    const size = track.getValueSize(), times = [], values = [];
    for (let i = 0; i < track.times.length; i++) if (track.times[i] >= from - 1e-6 && track.times[i] <= end + 1e-6) { times.push(track.times[i] - from); values.push(...track.values.subarray(i * size, (i + 1) * size)); }
    if (!times.length) continue;
    if (property === 'quaternion') {
      const fix = target.quaternion.clone().multiply(src.quaternion.clone().invert());
      for (let i = 0; i < values.length; i += 4) new T.Quaternion().fromArray(values, i).premultiply(fix).normalize().toArray(values, i);
      tracks.push(new T.QuaternionKeyframeTrack(track.name, times, values));
    } else {
      for (let i = 0; i < values.length; i += 3) for (let c = 0; c < 3; c++) values[i + c] = target.position.getComponent(c) + (c === 1 ? values[i + c] - src.position.getComponent(c) : 0) * 1.04;
      tracks.push(new T.VectorKeyframeTrack(track.name, times, values));
    }
  }
  return new T.AnimationClip(name, end - from, tracks);
}

// ---- Mixamo: aim retarget. [our bone, Mixamo bone, our aim child, Mixamo aim child], parents before children; a bone with no aim child follows the source's rotation change.
const M = (n) => 'mixamorig:' + n;
const SPINE = [['pelvis', 'Hips', 'spine_01', 'Spine'], ['spine_01', 'Spine', 'spine_02', 'Spine1'], ['spine_02', 'Spine1', 'spine_03', 'Spine2'], ['spine_03', 'Spine2', 'neck_01', 'Neck'], ['neck_01', 'Neck', 'Head', 'Head'], ['Head', 'Head', null, null]];
const MAP = [...SPINE];
for (const [s, L] of [['l', 'Left'], ['r', 'Right']]) {
  MAP.push([`clavicle_${s}`, `${L}Shoulder`, `upperarm_${s}`, `${L}Arm`], [`upperarm_${s}`, `${L}Arm`, `lowerarm_${s}`, `${L}ForeArm`], [`lowerarm_${s}`, `${L}ForeArm`, `hand_${s}`, `${L}Hand`], [`hand_${s}`, `${L}Hand`, `middle_01_${s}`, `${L}HandMiddle1`]);
  for (const [f, F] of [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) for (const n of [1, 2, 3]) {
    const child = n < 3 ? `${f}_0${n + 1}_${s}` : bone(`${f}_04_leaf_${s}`) ? `${f}_04_leaf_${s}` : null;
    MAP.push([`${f}_0${n}_${s}`, `${L}Hand${F}${n}`, child, child ? `${L}Hand${F}${n + 1}` : null]);
  }
  MAP.push([`thigh_${s}`, `${L}UpLeg`, `calf_${s}`, `${L}Leg`], [`calf_${s}`, `${L}Leg`, `foot_${s}`, `${L}Foot`], [`foot_${s}`, `${L}Foot`, `ball_${s}`, `${L}ToeBase`], [`ball_${s}`, `${L}ToeBase`, null, null]);
}
const MAPPED = MAP.filter(([ours]) => bone(ours));

function mixamoClip(spec, dump) {
  const index = new Map(dump.bones.map((n, i) => [n, i])), at = (frame, name) => dump.frames[frame][index.get(M(name))];
  const q = (a) => new T.Quaternion(a[4], a[5], a[6], a[3]), p = (a) => new T.Vector3(a[0], a[1], a[2]), rest = (name) => dump.rest[M(name)];
  restore();
  // Align the source to our rig: yaw so the hips' left-right axes agree, scale by hip height. The source is read through (p - hips0) * scale + pelvis0, rotations through the yaw.
  const lateral = (a, b) => a.sub(b).setY(0).normalize();
  const yaw = new T.Quaternion().setFromUnitVectors(lateral(p(rest('LeftUpLeg')), p(rest('RightUpLeg'))), lateral(wpos(bone('thigh_l')), wpos(bone('thigh_r'))));
  const hips0 = p(rest('Hips')), pelvis0 = wpos(bone('pelvis')), scale = pelvis0.y / hips0.y;
  const toPoint = (v) => v.clone().sub(hips0).multiplyScalar(scale).applyQuaternion(yaw).add(pelvis0);
  const restWorld = new Map(MAPPED.map(([o]) => [o, { q: wquat(bone(o)), pos: wpos(bone(o)) }]));
  const rows = MAPPED.map(([ours, theirs, aim, theirAim]) => {
    const target = bone(ours), r = restWorld.get(ours), srcRest = q(rest(theirs)).premultiply(yaw);
    const row = { ours, target, theirs, aim: aim && bone(aim), theirAim, rest: r, srcRest };
    if (row.aim) { row.d0 = wpos(row.aim).sub(r.pos).normalize(); row.s0 = p(rest(theirAim)).sub(p(rest(theirs))).applyQuaternion(yaw).normalize(); }
    return row;
  });
  const first = spec.from ?? 0, last = Math.min(spec.to ?? dump.frames.length - 1, dump.frames.length - 1), step = 1 / (dump.fps * (spec.speed ?? 1));
  const times = [], positions = [], rotations = new Map(MAPPED.map(([o]) => [o, []])), hipTravel = new T.Vector3(), wrist = [];
  const hipsFirst = toPoint(p(at(first, 'Hips')));
  for (let f = first; f <= last; f++) {
    restore();
    const hips = toPoint(p(at(f, 'Hips'))).sub(hipsFirst);
    if (f === last) hipTravel.copy(hips);
    const world = (name) => toPoint(p(at(f, name)));
    const pelvis = bone('pelvis');
    const place = pelvis0.clone().add(new T.Vector3(spec.rootMotion === 'keep' ? hips.x : 0, hips.y + (hipsFirst.y - pelvis0.y), spec.rootMotion === 'keep' ? hips.z : 0));
    pelvis.position.copy(pelvis.parent.worldToLocal(place)); scene.updateMatrixWorld(true);
    positions.push(...pelvis.position.toArray());
    for (const row of rows) {
      const { target, rest: r } = row, now = q(at(f, row.theirs)).premultiply(yaw), delta = now.clone().multiply(row.srcRest.clone().invert());
      let world_q;
      if (row.aim) {
        const d = world(row.theirAim).sub(world(row.theirs)).normalize();
        const axis = row.s0, twist = 2 * Math.atan2(delta.x * axis.x + delta.y * axis.y + delta.z * axis.z, delta.w);
        world_q = new T.Quaternion().setFromAxisAngle(d, twist).multiply(new T.Quaternion().setFromUnitVectors(row.d0, d)).multiply(r.q);
      } else world_q = delta.clone().multiply(r.q);
      target.quaternion.copy(target.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world_q)); scene.updateMatrixWorld(true);
      rotations.get(row.ours).push(...target.quaternion.clone().normalize().toArray());
    }
    wrist.push(wpos(bone('hand_r')));
    times.push((f - first) * step);
  }
  restore();
  const tracks = [new T.VectorKeyframeTrack('pelvis.position', times, positions), ...MAPPED.map(([o]) => new T.QuaternionKeyframeTrack(o + '.quaternion', times, rotations.get(o)))];
  // The frame the right hand moves fastest = the swing's strike beat (the sim's contact fraction should sit near it).
  let peak = 0, peakSpeed = 0; for (let i = 1; i < wrist.length; i++) { const v = wrist[i].distanceTo(wrist[i - 1]); if (v > peakSpeed) { peakSpeed = v; peak = i; } }
  return { clip: new T.AnimationClip(spec.role, times.at(-1), tracks), travel: hipTravel, scale, yaw: 2 * Math.acos(Math.abs(yaw.w)) * 180 / Math.PI, peak: times[peak] / times.at(-1) };
}

// ---- Mixamo sequence: several parts of dumped clips played one after another as one clip (the bow specials: the draw, then the loose). Each part is built as a single clip (from/to/speed/rootMotion as above);
// the next part starts one source step after the last, and its pelvis position is shifted so the hips carry on from where the last part ended (no pop). A bow draw uses `blend` extra steps of the next part's first pose.
function seqClip(spec, parts) {
  const built = parts.map((part) => mixamoClip({ ...part, role: spec.role }, JSON.parse(spec.dumps[part.file]))), tracks = new Map();
  let t0 = 0, carry = null;
  for (const [i, b] of built.entries()) {
    const end = b.clip.duration;
    for (const track of b.clip.tracks) {
      const size = track.getValueSize(), values = Array.from(track.values), times = Array.from(track.times, (t) => t + t0);
      if (track.name === 'pelvis.position') {
        const last = tracks.get(track.name), shift = last ? [0, 1, 2].map((c) => last.values[last.values.length - 3 + c] - values[c]) : [0, 0, 0];
        for (let k = 0; k < values.length; k += 3) for (let c = 0; c < 3; c++) values[k + c] += shift[c];
      }
      const acc = tracks.get(track.name) ?? { times: [], values: [], size };
      acc.times.push(...times); acc.values.push(...values); tracks.set(track.name, acc);
    }
    t0 += end + (built[i + 1] ? 1 / 30 : 0);
  }
  const out = [...tracks].map(([name, a]) => name.endsWith('.position') ? new T.VectorKeyframeTrack(name, a.times, a.values) : new T.QuaternionKeyframeTrack(name, a.times, a.values));
  return { clip: new T.AnimationClip(spec.role, t0, out), split: built.map((b) => b.clip.duration) };
}

const report = [];
for (const spec of SPECIAL_CLIPS) {
  let clip, extra = '';
  if (spec.source.kind === 'ual2') clip = await ualClip(spec.role, spec.source.clip, spec.source);
  else if (spec.source.kind === 'mixamo-seq') {
    const dumps = {}; for (const part of spec.source.parts) dumps[part.file] ??= await fs.readFile(`${DUMP}/${part.file}.json`, 'utf8');
    const built = seqClip({ role: spec.role, dumps }, spec.source.parts); clip = built.clip;
    extra = ` parts ${built.split.map((d) => d.toFixed(2)).join('+')}s release@${(built.split[0] / (built.split.reduce((a, b) => a + b, 0))).toFixed(2)}`;
  } else {
    const dump = JSON.parse(await fs.readFile(`${DUMP}/${spec.source.file}.json`, 'utf8')), built = mixamoClip({ ...spec.source, role: spec.role }, dump);
    clip = built.clip; extra = ` hipTravel(${built.travel.x.toFixed(2)},${built.travel.y.toFixed(2)},${built.travel.z.toFixed(2)}) scale ${built.scale.toFixed(3)} yawFix ${built.yaw.toFixed(0)}deg strike@${built.peak.toFixed(2)}`;
  }
  clip = clip.optimize();
  const data = clip.toJSON(); delete data.uuid;
  for (const t of data.tracks) { t.times = round(t.times); t.values = round(t.values); }
  const text = JSON.stringify(data) + '\n', out = new URL(`../src/assets/${spec.file}`, import.meta.url);
  await fs.writeFile(out, text);
  report.push(`${spec.role}: ${clip.duration.toFixed(2)}s ${data.tracks.length} tracks ${text.length} bytes${extra}`);
}
console.log(report.join('\n'));

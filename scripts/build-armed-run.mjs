// The Centurion's armed run (Strategy 2026-10-01, for The Charge). The rig's Run is the CC0 sprint with both hands free, so an armed
// fighter at 4 m/s showed ArmedWalk. ArmedRun is that sprint with the sword arm held low and forward, the blade carried point-forward and
// down, and the body's own bob and lean kept; the shield arm is left to the runtime carry (characters.ts carryShield), which already
// solves it every frame. Additive like Quiet One: appended after every other clip, the original binary chunk untouched, `armedRunBase`
// recorded so a rerun replaces only its own append. Run it AFTER build-quiet-one.mjs (that one refuses to truncate clips that follow it).
//   node scripts/build-armed-run.mjs [file…]   (default: src/assets/veteran.glb). No external art, no GPU: three.js on the CPU.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const point = bone => bone.getWorldPosition(new T.Vector3());
export const ARMED_RUN = 'ArmedRun';
// Sword hand: metres below / ahead of where Armed holds it (rig-scaled), blade direction in the body's frame (+Z forward), bob in metres.
const HAND_DROP = .16, HAND_AHEAD = .07, BLADE = new T.Vector3(.04, -.30, .95).normalize(), BOB = .014;

export function armedRunClip(scene, clips) {
  const bones = []; scene.traverse(o => { if (o.isBone) bones.push(o); });
  const bone = name => scene.getObjectByName(name), pelvis = bone('pelvis'), chest = bone('spine_03');
  const saved = bones.map(b => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  const mixer = new T.AnimationMixer(scene), run = clips.find(c => c.name === 'Run'), armed = clips.find(c => c.name === 'Armed');
  if (!run || !armed) throw Error('ArmedRun needs the rig\'s Run and Armed clips');
  const play = (clip, t) => { mixer.stopAllAction(); mixer.clipAction(clip).play(); mixer.setTime(t); scene.updateMatrixWorld(true); };
  play(armed, 0);
  const scale = point(bone('Head')).y / 1.65, hand = bone('hand_r'), weapon = bone('WeaponDrawn') ?? bone('SwordDrawn');
  const rest = chest.worldToLocal(point(hand)).add(new T.Vector3(0, -HAND_DROP * scale, HAND_AHEAD * scale));
  const frame = (axis, normal) => {
    const y = axis.clone().normalize(), z = normal.clone().addScaledVector(y, -normal.dot(y)).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(y.clone().cross(z), y, z));
  };
  const [upper, lower] = ['upperarm_r', 'lowerarm_r'].map(bone);
  const u0 = point(lower).sub(point(upper)), f0 = point(hand).sub(point(lower)), normal0 = u0.clone().cross(f0).normalize();
  const local = (b, axis) => { const q = b.getWorldQuaternion(new T.Quaternion()).invert(); return frame(axis.clone().applyQuaternion(q), normal0.clone().applyQuaternion(q)).invert(); };
  const arm = { a: u0.length(), b: f0.length(), uf: local(upper, u0), lf: local(lower, f0) };
  const reach = target => {
    scene.updateMatrixWorld(true);
    const start = point(upper), direction = target.clone().sub(start), distance = T.MathUtils.clamp(direction.length(), .02, arm.a + arm.b - .001);
    direction.normalize(); const along = (arm.a * arm.a - arm.b * arm.b + distance * distance) / (2 * distance);
    const bend = new T.Vector3(-.5, -.3, 1); bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    const elbow = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, arm.a * arm.a - along * along)));
    const u = elbow.clone().sub(start), f = start.clone().addScaledVector(direction, distance).sub(elbow), n = u.clone().cross(f).normalize();
    for (const [joint, axis, loc] of [[upper, u, arm.uf], [lower, f, arm.lf]]) {
      joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame(axis, n)).multiply(loc)); scene.updateMatrixWorld(true);
    }
  };
  const count = Math.round(run.duration * 30) + 1, times = Array.from({ length: count }, (_, i) => i / (count - 1) * run.duration);
  const positions = [], rotations = new Map(bones.map(b => [b.name, []]));
  for (const [i, t] of times.entries()) {
    play(run, t === run.duration ? run.duration - 1e-4 : t);
    // Run's cycle holds two strides, so the carried hand rises and falls twice with the body.
    const target = chest.localToWorld(rest.clone().add(new T.Vector3(0, Math.sin(4 * Math.PI * i / (count - 1)) * BOB * scale, 0)));
    reach(target);
    if (weapon) {
      // Face of the body: the pelvis' forward in world space; the blade points that way, tipped down.
      const forward = new T.Vector3(0, 0, 1).applyQuaternion(pelvis.getWorldQuaternion(new T.Quaternion()));
      const facing = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), forward.setY(0).normalize());
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), BLADE.clone().applyQuaternion(facing)).multiply(weapon.quaternion.clone().invert());
      hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));
    }
    scene.updateMatrixWorld(true);
    positions.push(...pelvis.position.toArray());
    for (const b of bones) rotations.get(b.name).push(...b.quaternion.toArray());
  }
  mixer.stopAllAction();
  for (const [b, p, q, s] of saved) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); } scene.updateMatrixWorld(true);
  // Loop seam: the last key repeats the first (the sampled cycle closes on itself, so the pose at 0 and at the end must agree).
  return new T.AnimationClip(ARMED_RUN, run.duration, [new T.VectorKeyframeTrack('pelvis.position', times, positions), ...bones.map(b => new T.QuaternionKeyframeTrack(b.name + '.quaternion', times, rotations.get(b.name)))]);
}

export async function appendArmedRun(file) {
  const bytes = await fs.readFile(file), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size));
  const previous = json.extras?.armedRunBase;
  if (!previous && json.animations.some(a => a.name === ARMED_RUN)) throw Error(`${file}: ${ARMED_RUN} exists without armedRunBase; rebuild from source`);
  if (previous && (json.animations.length !== previous.animations + 1 || json.animations.at(-1).name !== ARMED_RUN)) throw Error('Newer animations follow ArmedRun; rebuild from source instead of truncating them');
  if (previous) { json.accessors.length = previous.accessors; json.bufferViews.length = previous.views; json.animations.length = previous.animations; }
  const binary = bytes.subarray(28 + size, 28 + size + (previous?.bytes ?? json.buffers[0].byteLength));
  const base = { bytes: binary.length, accessors: json.accessors.length, views: json.bufferViews.length, animations: json.animations.length };
  const parsed = structuredClone(json); parsed.images = []; parsed.textures = []; parsed.materials = parsed.materials.map(m => ({ name: m.name }));
  parsed.buffers[0] = { byteLength: binary.length, uri: 'data:application/octet-stream;base64,' + binary.toString('base64') };
  globalThis.ProgressEvent ??= class { constructor(_, fields) { Object.assign(this, fields); } };
  const asset = await new GLTFLoader().parseAsync(JSON.stringify(parsed), ''), clip = armedRunClip(asset.scene, asset.animations);
  const chunks = [binary, Buffer.alloc((4 - binary.length % 4) % 4)]; let offset = chunks.reduce((n, b) => n + b.length, 0);
  const accessor = (array, type) => {
    const raw = Buffer.from(new Float32Array(array).buffer), view = json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: raw.length }) - 1;
    chunks.push(raw); offset += raw.length; const count = array.length / ({ SCALAR: 1, VEC3: 3, VEC4: 4 }[type]);
    return json.accessors.push({ bufferView: view, componentType: 5126, count, type, ...(type === 'SCALAR' ? { min: [Math.min(...array)], max: [Math.max(...array)] } : {}) }) - 1;
  };
  const input = accessor(clip.tracks[0].times, 'SCALAR'), animation = { name: clip.name, samplers: [], channels: [] };
  for (const track of clip.tracks) {
    const [name, property] = track.name.split('.'), node = json.nodes.findIndex(n => n.name === name); if (node < 0) throw Error(name);
    const output = accessor(track.values, property === 'position' ? 'VEC3' : 'VEC4'), sampler = animation.samplers.push({ input, output, interpolation: 'LINEAR' }) - 1;
    animation.channels.push({ sampler, target: { node, path: property === 'position' ? 'translation' : 'rotation' } });
  }
  json.animations.push(animation); json.extras = { ...json.extras, armedRunBase: base }; json.buffers[0].byteLength = offset;
  const raw = Buffer.from(JSON.stringify(json)), js = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]), bin = Buffer.concat(chunks);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + js.length + bin.length, 8); header.writeUInt32LE(js.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
  await fs.writeFile(file, Buffer.concat([header, js, bh, bin])); console.log(`${file}: ${clip.tracks.length} tracks, +${offset - base.bytes} bytes`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const files = process.argv.slice(2);
  for (const file of files.length ? files : ['src/assets/veteran.glb']) await appendArmedRun(file);
}

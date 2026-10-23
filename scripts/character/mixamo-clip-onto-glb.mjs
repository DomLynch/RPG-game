// usage: node kach-idle.mjs <character.glb> <clip.glb> <out.glb> [clipName=Idle]   adds the clip's channels to the character by node NAME (Mixamo bones share names and rest rotations); the Hips translation is scaled by the characters' hips rest heights
import fs from 'node:fs';
const [charIn, clipIn, out, clipName = 'Idle'] = process.argv.slice(2);
const read = (f) => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n) }; };
const C = read(charIn), K = read(clipIn);
const nodeByName = (j) => new Map(j.nodes.map((n, i) => [n.name, i]));
const cn = nodeByName(C.j), kn = nodeByName(K.j);
const hipsC = C.j.nodes[cn.get('mixamorig:Hips')], hipsK = K.j.nodes[kn.get('mixamorig:Hips')];
// Hips rest translation: the clip's up axis is the third component in this (armature-rotated) rig
const ratio = Math.hypot(...hipsC.translation) / Math.hypot(...hipsK.translation);
const clip = K.j.animations[0], pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
let bin = pad(C.bin); const j = C.j;
const addAcc = (accIdx, scale) => {
  const a = K.j.accessors[accIdx], v = K.j.bufferViews[a.bufferView], w = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type], size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const raw = K.bin.subarray((v.byteOffset || 0) + (a.byteOffset || 0), (v.byteOffset || 0) + (a.byteOffset || 0) + a.count * w * size);
  let bytes = Buffer.from(raw);   // a quantised track (normalised int16 rotations) is copied as it is
  if (scale !== 1) {
    if (a.componentType !== 5126) throw new Error('only float tracks can be rescaled');
    const f = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)); for (let i = 0; i < f.length; i++) f[i] *= scale; bytes = Buffer.from(f.buffer);
  }
  j.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: bytes.length }); bin = Buffer.concat([bin, pad(bytes)]);
  const acc = { bufferView: j.bufferViews.length - 1, componentType: a.componentType, count: a.count, type: a.type };
  if (a.normalized) acc.normalized = true;
  if (a.min) { acc.min = a.min.map((x) => x * scale); acc.max = a.max.map((x) => x * scale); }
  j.accessors.push(acc); return j.accessors.length - 1;
};
const times = new Map(), samplers = [], channels = [];
let skipped = 0;
for (const ch of clip.channels) {
  const name = K.j.nodes[ch.target.node].name, target = cn.get(name);
  if (target === undefined) { skipped++; continue; }
  const s = clip.samplers[ch.sampler];
  if (!times.has(s.input)) times.set(s.input, addAcc(s.input, 1));
  samplers.push({ input: times.get(s.input), output: addAcc(s.output, ch.target.path === 'translation' ? ratio : 1), interpolation: s.interpolation ?? 'LINEAR' });
  channels.push({ sampler: samplers.length - 1, target: { node: target, path: ch.target.path } });
}
j.animations = [{ name: clipName, samplers, channels }];
j.buffers[0].byteLength = bin.length;
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
head.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
fs.writeFileSync(out, Buffer.concat([head, jh, jp, bh, bin]));
console.log(out, fs.statSync(out).size, 'bytes; clip', clipName, channels.length, 'channels', skipped, 'skipped; hips translation x', ratio.toFixed(4));

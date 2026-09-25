// Copy named clips from a hero-rig build into a creature donor, in place (node scripts/character/append-donor-clips.mjs <donor.glb> <source.glb> <clip>...).
// The creature pipeline inherits every clip from its frozen donor (creature_pack.py), so a clip authored later on the hero rig
// (Trident_Carry/Trident_Draw, pole Draw B, 2026-09-26) never reaches the Veteran or Witch unless it is written into the donor.
// Channels are matched by node name; the clip's keys are appended to the donor's one buffer. A clip already in the donor is replaced.
import fs from 'node:fs';
const [donorPath, sourcePath, ...names] = process.argv.slice(2);
if (!names.length) throw new Error('usage: append-donor-clips.mjs <donor.glb> <source.glb> <clip>...');
const load = f => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + n).toString()), bin: b.subarray(28 + n, 28 + n + b.readUInt32LE(20 + n)) }; };
const donor = load(donorPath), source = load(sourcePath), SIZE = { SCALAR: 4, VEC3: 12, VEC4: 16 };
if (donor.j.buffers.length !== 1) throw new Error('expected one embedded buffer');
const nodeOf = new Map(donor.j.nodes.map((n, i) => [n.name, i]));
let bin = Buffer.from(donor.bin);
const copyAccessor = i => {
  const a = source.j.accessors[i], v = source.j.bufferViews[a.bufferView], len = a.count * SIZE[a.type];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0), offset = Math.ceil(bin.length / 4) * 4;
  bin = Buffer.concat([bin, Buffer.alloc(offset - bin.length), source.bin.subarray(start, start + len)]);
  donor.j.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: len });
  const { byteOffset, ...rest } = a;
  donor.j.accessors.push({ ...rest, bufferView: donor.j.bufferViews.length - 1 });
  return donor.j.accessors.length - 1;
};
for (const name of names) {
  const clip = source.j.animations.find(a => a.name === name);
  if (!clip) throw new Error(`${sourcePath} has no ${name}`);
  const samplers = [], channels = [];
  for (const c of clip.channels) {
    const node = nodeOf.get(source.j.nodes[c.target.node].name);
    if (node === undefined) throw new Error(`${name}: donor has no node ${source.j.nodes[c.target.node].name}`);
    const s = clip.samplers[c.sampler];
    samplers.push({ input: copyAccessor(s.input), output: copyAccessor(s.output), interpolation: s.interpolation || 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node, path: c.target.path } });
  }
  donor.j.animations = donor.j.animations.filter(a => a.name !== name).concat({ name, channels, samplers });
}
bin = Buffer.concat([bin, Buffer.alloc(Math.ceil(bin.length / 4) * 4 - bin.length)]);
donor.j.buffers[0].byteLength = bin.length;
let json = Buffer.from(JSON.stringify(donor.j));
json = Buffer.concat([json, Buffer.alloc(Math.ceil(json.length / 4) * 4 - json.length, 0x20)]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunk = (data, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
fs.writeFileSync(donorPath, Buffer.concat([header, chunk(json, 0x4E4F534A), chunk(bin, 0x004E4942)]));
console.log(`${donorPath}: ${names.join(', ')} from ${sourcePath}`);

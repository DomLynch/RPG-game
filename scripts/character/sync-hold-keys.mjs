// Bring a creature donor's Fin_RunThrough hold keys in line with its shipped rig, in place.
// cb1ee6a (finishers, 2026-09-21) overwrote the left-arm hold keys inside every shipped rig's binary but not inside the
// donors the creature pipeline rebuilds from, so any rebuild silently regressed the hold. This copies, channel by channel,
// every Fin_RunThrough output that differs between the shipped rig and its donor into the donor (same accessor, same
// byte length); nothing else in the donor changes.   node scripts/character/sync-hold-keys.mjs <donor.glb> <shipped.glb>
import fs from 'node:fs';
const [donorPath, shippedPath] = process.argv.slice(2);
const load = f => { const b = fs.readFileSync(f), n = b.readUInt32LE(12); return { b, n, j: JSON.parse(b.subarray(20, 20 + n).toString()), bin: 28 + n }; };
const outputs = g => { const a = g.j.animations.find(a => a.name === 'Fin_RunThrough'); const m = new Map();
  for (const c of a.channels) { const acc = g.j.accessors[a.samplers[c.sampler].output], v = g.j.bufferViews[acc.bufferView];
    const start = g.bin + (v.byteOffset || 0) + (acc.byteOffset || 0), len = acc.count * { VEC3: 12, VEC4: 16 }[acc.type];
    m.set(`${g.j.nodes[c.target.node].name}.${c.target.path}`, { start, len }); } return m; };
const donor = load(donorPath), shipped = load(shippedPath), d = outputs(donor), s = outputs(shipped), changed = [];
for (const [key, dst] of d) { const src = s.get(key); if (!src || src.len !== dst.len) throw new Error(`${key}: no matching channel`);
  const a = donor.b.subarray(dst.start, dst.start + dst.len), b = shipped.b.subarray(src.start, src.start + src.len);
  if (!a.equals(b)) { b.copy(donor.b, dst.start); changed.push(key); } }
fs.writeFileSync(donorPath, donor.b);
console.log(`${donorPath}: ${changed.length} Fin_RunThrough channels synced from ${shippedPath}${changed.length ? ' — ' + changed.join(', ') : ''}`);

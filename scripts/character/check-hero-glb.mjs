// Does a candidate hero GLB meet what the game asks of src/assets/warrior.glb? A file drop that passes this loads as the hero (no capsule stand-in, no black fight).
//   node scripts/character/check-hero-glb.mjs <candidate.glb> [reference.glb = src/assets/hero-classic.glb]
// Checks: the reference's 65 joint names and the same clip names are present; a node named `Steel` is a skinned mesh whose material has a base map and a normal map
// (characters.ts missingMap); SwordDrawn and SwordSheathed exist; every accessor fits its view; every clip channel targets a node.
import fs from 'node:fs';

const [candidate, reference] = process.argv.slice(2);
if (!candidate) throw new Error('usage: check-hero-glb.mjs <candidate.glb> [reference.glb]');
const parse = (buf) => { const n = buf.readUInt32LE(12); return { j: JSON.parse(buf.subarray(20, 20 + n)), bin: buf.subarray(28 + n) }; };
const C = parse(fs.readFileSync(candidate));
const R = parse(fs.readFileSync(reference ?? new URL('../../src/assets/hero-classic.glb', import.meta.url)));
const problems = [];
const jointNames = (d) => (d.j.skins?.[0]?.joints ?? []).map((i) => d.j.nodes[i].name);
const cj = new Set(jointNames(C)), rj = jointNames(R);
for (const n of rj) if (!cj.has(n)) problems.push(`missing joint ${n}`);
const extra = [...cj].filter((n) => !rj.includes(n));
if (extra.length) problems.push(`${extra.length} extra joints (clips will not touch them): ${extra.slice(0, 8).join(', ')}`);
const clips = new Set((C.j.animations ?? []).map((a) => a.name));
for (const a of R.j.animations) if (!clips.has(a.name)) problems.push(`missing clip ${a.name}`);
const steel = C.j.nodes.find((n) => n.name === 'Steel');
if (!steel || steel.mesh === undefined || steel.skin === undefined) problems.push('no skinned node named Steel');
else {
  const mat = C.j.materials[C.j.meshes[steel.mesh].primitives[0].material];
  if (!mat?.pbrMetallicRoughness?.baseColorTexture) problems.push('Steel has no base colour map');
  if (!mat?.normalTexture) problems.push('Steel has no normal map');
}
for (const name of ['SwordDrawn', 'SwordSheathed']) if (!C.j.nodes.some((n) => n.name === name)) problems.push(`no ${name} node`);
const W = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, S = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
C.j.accessors.forEach((a, i) => { if (a.bufferView === undefined) return; const v = C.j.bufferViews[a.bufferView], need = (a.byteOffset ?? 0) + (v.byteStride ? v.byteStride * (a.count - 1) + W[a.type] * S[a.componentType] : a.count * W[a.type] * S[a.componentType]); if (need > v.byteLength) problems.push(`accessor ${i} overruns its view`); });
for (const an of C.j.animations ?? []) for (const c of an.channels) if (C.j.nodes[c.target.node] === undefined) problems.push(`${an.name}: a channel targets no node`);
const skinned = C.j.nodes.filter((n) => n.skin !== undefined).length;
console.log(`${candidate}: ${rj.length - problems.filter((p) => p.startsWith('missing joint')).length}/${rj.length} hero joints, ${clips.size} clips, ${skinned} skinned draws, size ${fs.statSync(candidate).size}`);
if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exitCode = 1; } else console.log('OK: meets the hero contract');

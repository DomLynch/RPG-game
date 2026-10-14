// World body load check (Lead 2026-10-07): parse a duel GLB and its world body with the game's GLTFLoader (as tests do, Node, images dropped)
// and print tris, file MB, texture count, decoded texture MB (w*h*4, no mips), joints and whether every duel clip name survives.
//   node scripts/world-body-check.mjs src/assets/goblin.glb src/assets/world/goblin.glb [--strict]
import { readFileSync } from 'node:fs';
import { Mesh, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

globalThis.ProgressEvent ??= class { constructor(_type, fields) { Object.assign(this, fields); } };
function imageSize(bytes) {   // PNG (IHDR), JPEG (SOF) or WebP (VP8/VP8L/VP8X) pixel size, no decoder needed
  if (bytes.readUInt32BE(0) === 0x89504e47) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const k = bytes.toString('ascii', 12, 16);
    if (k === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (k === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const b = bytes.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let i = 2; i + 9 < bytes.length;) { if (bytes[i] !== 0xff) { i++; continue; } const m = bytes[i + 1]; if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)]; i += 2 + bytes.readUInt16BE(i + 2); }
  }
  throw new Error('unreadable image size');
}
async function inspect(path) {
  const bytes = readFileSync(path), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  const bin = bytes.subarray(28 + size), views = json.bufferViews ?? [];
  const decoded = (json.images ?? []).reduce((sum, im) => { const v = views[im.bufferView], [w, h] = imageSize(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)); return sum + w * h * 4; }, 0);
  json.images = []; json.textures = []; json.materials = (json.materials ?? []).map((m) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  let tris = 0, joints = 0;
  gltf.scene.traverse((o) => { if (o instanceof Mesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; if (o instanceof SkinnedMesh) joints = Math.max(joints, o.skeleton.bones.length); });
  return { path, mb: bytes.length / 1048576, textures: (JSON.parse(bytes.subarray(20, 20 + size).toString()).images ?? []).length, decodedMb: decoded / 1048576, tris, joints, clips: gltf.animations.map((a) => a.name) };
}
const [duelPath, worldPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const duel = await inspect(duelPath), world = await inspect(worldPath);
const row = (k, d, w) => `| ${k} | ${d} | ${w} |`;
console.log(['| | duel | world |', '|---|---|---|', row('tris', duel.tris, world.tris), row('file MB', duel.mb.toFixed(2), world.mb.toFixed(2)), row('textures', duel.textures, world.textures),
  row('decoded texture MB (no mips)', duel.decodedMb.toFixed(1), world.decodedMb.toFixed(1)), row('joints', duel.joints, world.joints)].join('\n'));
const missing = duel.clips.filter((c) => !world.clips.includes(c));
console.log(`clips: duel ${duel.clips.length}, world ${world.clips.length}, missing from world: ${missing.length ? missing.join(', ') : 'none'}`);
if (process.argv.includes('--strict') && (missing.length || world.joints !== duel.joints || world.textures > 2)) process.exit(1);

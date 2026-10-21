// Per-GLB phone-budget numbers, read from the file alone (no renderer): triangles, vertices, skinned vertices, joints, influences, draw calls (one per primitive and node), materials, textures with size and format, bytes raw and gzipped.
// CLI: node scripts/glb-budget-stats.mjs <file.glb>...   -> one JSON line per file.   Module: import { glbStats } from './glb-budget-stats.mjs' (scripts/check-phone-budget.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

function imageInfo(buf) {   // width, height, format from the first bytes (png, jpeg, webp, ktx2)
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), fmt: 'jpeg' }; i += 2 + len; } }
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') { const k = buf.slice(12, 16).toString(); if (k === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, fmt: 'webp' }; if (k === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, fmt: 'webp' }; } if (k === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), fmt: 'webp' }; }
  if (buf[0] === 0xab && buf.slice(1, 5).toString() === 'KTX ') return { w: buf.readUInt32LE(20), h: buf.readUInt32LE(24), fmt: 'ktx2' };
  return { w: 0, h: 0, fmt: 'unknown' };
}

/** The numbers of one GLB file (see the header). `textures` are { w, h, fmt, bytes? } per distinct image a used material points at. */
export function glbStats(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) return { file: path.basename(file), error: 'not a GLB' };
  const jlen = buf.readUInt32LE(12), json = JSON.parse(buf.slice(20, 20 + jlen).toString()), binAt = 20 + jlen + 8;
  const acc = (i) => json.accessors[i];
  let tris = 0, verts = 0, skinnedVerts = 0, draws = 0, influences = 0;
  const skinOfMesh = new Map(), matsUsed = new Set();
  for (const n of json.nodes ?? []) if (n.mesh !== undefined && n.skin !== undefined) skinOfMesh.set(n.mesh, n.skin);
  (json.meshes ?? []).forEach((m, mi) => {
    const nodeCount = (json.nodes ?? []).filter((n) => n.mesh === mi).length || 1;   // a mesh used by several nodes draws once per node
    for (const p of m.primitives) {
      const count = acc(p.attributes.POSITION).count, idx = p.indices !== undefined ? acc(p.indices).count : count;
      tris += (idx / 3) * nodeCount; verts += count * nodeCount; draws += nodeCount;
      if (p.material !== undefined) matsUsed.add(p.material);
      if (skinOfMesh.has(mi) || p.attributes.JOINTS_0 !== undefined) { skinnedVerts += count * nodeCount; influences = Math.max(influences, p.attributes.JOINTS_1 !== undefined ? 8 : 4); }
    }
  });
  const textures = new Map();
  const texOf = (t) => { if (!t) return; const tex = json.textures?.[t.index]; if (!tex) return; const src = tex.source ?? tex.extensions?.KHR_texture_basisu?.source ?? tex.extensions?.EXT_texture_webp?.source; if (src === undefined || textures.has(src)) return; const img = json.images[src]; let info = { w: 0, h: 0, fmt: img.mimeType ?? 'external' }; if (img.bufferView !== undefined) { const bv = json.bufferViews[img.bufferView], start = binAt + (bv.byteOffset ?? 0); info = imageInfo(buf.slice(start, start + bv.byteLength)); info.bytes = bv.byteLength; } else if (img.uri && !img.uri.startsWith('data:')) { const p = path.join(path.dirname(file), decodeURIComponent(img.uri)); if (fs.existsSync(p)) { const b = fs.readFileSync(p); info = imageInfo(b); info.bytes = b.length; } else info.fmt = 'external:' + path.extname(img.uri); } textures.set(src, info); };
  for (const mi of matsUsed) { const m = json.materials?.[mi] ?? {}; const pb = m.pbrMetallicRoughness ?? {}; [pb.baseColorTexture, pb.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture, m.emissiveTexture].forEach(texOf); }
  const joints = Math.max(0, ...(json.skins ?? []).map((s) => s.joints.length));
  return { file: path.basename(file), bytes: buf.length, kb: Math.round(buf.length / 1024), gzKb: Math.round(zlib.gzipSync(buf).length / 1024), tris: Math.round(tris), verts, skinnedVerts, joints, influences, draws, materials: matsUsed.size, meshopt: !!json.extensionsUsed?.includes('EXT_meshopt_compression'), textures: [...textures.values()] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const file of process.argv.slice(2)) { const s = glbStats(file); console.log(JSON.stringify(s.textures ? { ...s, textures: s.textures.map((t) => `${t.w}x${t.h} ${t.fmt}${t.bytes ? ' ' + Math.round(t.bytes / 1024) + 'KB' : ''}`) } : s)); }
}

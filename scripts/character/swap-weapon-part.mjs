// Swap the weapon PART a packed fighter carries, and nothing else (weapons lane, 2026-09-26: the Witch's mage staff, Dom's pick B).
// A creature's weapon rides in from its frozen donor (creature_pack.py base: the Witch's is veteran-v1, which carries the trident), so a
// look-only variant cannot come through build-warrior. This keeps the WeaponDrawn node exactly as packed (its hand transform and its
// extras.contact, which the bake and the sim read) and replaces only its children with the named part's meshes; the old part's nodes,
// meshes, materials, textures, images and bytes are dropped and the buffer repacked. Idempotent: a second run swaps the swap.
//   node scripts/character/swap-weapon-part.mjs <fighter.glb> <weapon> <variant>
import fs from 'node:fs/promises';
import * as T from 'three';
import { WEAPON_BUILDS } from '../build-weapon.mjs';

const readGlb = bytes => { const n = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + n)), bin: bytes.subarray(28 + n, 28 + n + bytes.readUInt32LE(20 + n)) }; };
const align = n => (n + 3) & ~3;

async function partGlb(weapon, variant) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  globalThis.FileReader ??= class { async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); } };
  const scene = new T.Scene(), part = await WEAPON_BUILDS[weapon].part({ variant });
  if (part.maps) throw new Error(`${weapon}/${variant}: a reconstructed part carries maps; swap only procedural parts`);
  scene.add(part);
  return { glb: Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true })), contact: part.userData.contact };
}

export async function swapWeaponPart(file, weapon, variant) {
  const { json: j, bin } = readGlb(await fs.readFile(file));
  const drawn = j.nodes.findIndex(n => n.name === 'WeaponDrawn');
  if (drawn < 0) throw new Error(`${file}: no WeaponDrawn node`);
  const { glb, contact } = await partGlb(weapon, variant), { json: p, bin: pbin } = readGlb(glb);
  const was = j.nodes[drawn].extras?.contact;
  if (was && (Math.abs(was.from - contact.from) > 1e-6 || Math.abs(was.to - contact.to) > 1e-6)) throw new Error(`${file}: ${weapon}/${variant} contact ${contact.from}–${contact.to} differs from the packed ${was.from}–${was.to}; a look-only swap keeps the contract`);

  // 1. Drop the old part's subtree (WeaponDrawn's descendants) and remap node indices everywhere they appear.
  const drop = new Set(); (function walk(i) { for (const c of j.nodes[i].children ?? []) { drop.add(c); walk(c); } })(drawn);
  const nodeMap = new Map(); j.nodes.forEach((_, i) => { if (!drop.has(i)) nodeMap.set(i, nodeMap.size); });
  const node = i => nodeMap.get(i);
  j.nodes = j.nodes.filter((_, i) => !drop.has(i)).map(n => (n.children ? { ...n, children: n.children.filter(c => !drop.has(c)).map(node) } : n));
  for (const n of j.nodes) if (n.children && !n.children.length) delete n.children;
  for (const s of j.scenes) s.nodes = s.nodes.filter(i => !drop.has(i)).map(node);
  for (const s of j.skins ?? []) { s.joints = s.joints.map(node); if (s.skeleton !== undefined) s.skeleton = node(s.skeleton); }
  for (const a of j.animations ?? []) { if (a.channels.some(c => drop.has(c.target.node))) throw new Error('an animation targets the old part'); for (const c of a.channels) c.target.node = node(c.target.node); }
  const wd = node(drawn);

  // 2. Append the part: its meshes/materials/textures/images/samplers/accessors/bufferViews, offset into the combined buffer.
  const base = { acc: j.accessors.length, view: j.bufferViews.length, mat: j.materials.length, mesh: j.meshes.length, tex: (j.textures ??= []).length, img: (j.images ??= []).length, smp: (j.samplers ??= []).length };
  const offset = align(bin.length);
  for (const v of p.bufferViews) j.bufferViews.push({ ...v, buffer: 0, byteOffset: (v.byteOffset ?? 0) + offset });
  for (const a of p.accessors) j.accessors.push({ ...a, bufferView: a.bufferView + base.view });
  for (const s of p.samplers ?? []) j.samplers.push(s);
  for (const im of p.images ?? []) j.images.push({ ...im, bufferView: im.bufferView + base.view });
  for (const t of p.textures ?? []) j.textures.push({ ...t, source: t.source + base.img, ...(t.sampler !== undefined ? { sampler: t.sampler + base.smp } : {}) });
  const retex = o => JSON.parse(JSON.stringify(o), (k, v) => (k.endsWith('Texture') && v?.index !== undefined ? { ...v, index: v.index + base.tex } : v));
  for (const m of p.materials) j.materials.push(retex(m));
  for (const m of p.meshes) j.meshes.push({ ...m, primitives: m.primitives.map(pr => ({ ...pr, attributes: Object.fromEntries(Object.entries(pr.attributes).map(([k, v]) => [k, v + base.acc])), ...(pr.indices !== undefined ? { indices: pr.indices + base.acc } : {}), ...(pr.material !== undefined ? { material: pr.material + base.mat } : {}) })) });
  const proot = p.nodes.findIndex(n => n.name === 'WeaponDrawn'), pmap = new Map();
  (function walk(i) { for (const c of p.nodes[i].children ?? []) { pmap.set(c, j.nodes.length + pmap.size); walk(c); } })(proot);
  for (const [i] of pmap) { const n = { ...p.nodes[i] }; if (n.mesh !== undefined) n.mesh += base.mesh; if (n.children) n.children = n.children.map(c => pmap.get(c)); j.nodes.push(n); }
  j.nodes[wd].children = (p.nodes[proot].children ?? []).map(c => pmap.get(c));
  j.nodes[wd].extras = { ...j.nodes[wd].extras, weapon, variant };
  j.extensionsUsed = [...new Set([...(j.extensionsUsed ?? []), ...(p.extensionsUsed ?? [])])];

  // 3. Collect: keep only what the remaining nodes, skins and animations reach, then repack the buffer in view order.
  const used = { mesh: new Set(), mat: new Set(), tex: new Set(), img: new Set(), smp: new Set(), acc: new Set(), view: new Set() };
  for (const n of j.nodes) if (n.mesh !== undefined) used.mesh.add(n.mesh);
  for (const mi of used.mesh) for (const pr of j.meshes[mi].primitives) { Object.values(pr.attributes).forEach(a => used.acc.add(a)); if (pr.indices !== undefined) used.acc.add(pr.indices); if (pr.material !== undefined) used.mat.add(pr.material); for (const t of pr.targets ?? []) Object.values(t).forEach(a => used.acc.add(a)); }
  for (const mi of used.mat) JSON.stringify(j.materials[mi], (k, v) => { if (k.endsWith('Texture') && v?.index !== undefined) used.tex.add(v.index); return v; });
  for (const ti of used.tex) { const t = j.textures[ti]; if (t.source !== undefined) used.img.add(t.source); if (t.sampler !== undefined) used.smp.add(t.sampler); JSON.stringify(t.extensions ?? {}, (k, v) => { if (k === 'source') used.img.add(v); return v; }); }
  for (const s of j.skins ?? []) if (s.inverseBindMatrices !== undefined) used.acc.add(s.inverseBindMatrices);
  for (const a of j.animations ?? []) for (const s of a.samplers) { used.acc.add(s.input); used.acc.add(s.output); }
  for (const ai of used.acc) used.view.add(j.accessors[ai].bufferView);
  for (const ii of used.img) used.view.add(j.images[ii].bufferView);
  const keep = (list, set) => { const map = new Map(); list.forEach((_, i) => { if (set.has(i)) map.set(i, map.size); }); return { map, out: list.filter((_, i) => set.has(i)) }; };
  const K = Object.fromEntries(Object.entries({ mesh: j.meshes, mat: j.materials, tex: j.textures, img: j.images, smp: j.samplers, acc: j.accessors, view: j.bufferViews }).map(([k, list]) => [k, keep(list, used[k])]));
  const chunks = []; let at = 0;
  for (const [i, v] of j.bufferViews.entries()) if (used.view.has(i)) {
    const src = i < base.view ? bin : pbin, start = (v.byteOffset ?? 0) - (i < base.view ? 0 : offset);
    const pad = align(at) - at; if (pad) chunks.push(Buffer.alloc(pad)); at += pad;
    chunks.push(src.subarray(start, start + v.byteLength)); v.byteOffset = at; v.buffer = 0; at += v.byteLength;
  }
  j.bufferViews = K.view.out; j.accessors = K.acc.out.map(a => ({ ...a, bufferView: K.view.map.get(a.bufferView) }));
  j.images = K.img.out.map(im => ({ ...im, bufferView: K.view.map.get(im.bufferView) }));
  j.samplers = K.smp.out;
  j.textures = K.tex.out.map(t => ({ ...t, ...(t.source !== undefined ? { source: K.img.map.get(t.source) } : {}), ...(t.sampler !== undefined ? { sampler: K.smp.map.get(t.sampler) } : {}),
    ...(t.extensions ? { extensions: JSON.parse(JSON.stringify(t.extensions), (k, v) => (k === 'source' && typeof v === 'number' ? K.img.map.get(v) : v)) } : {}) }));   // EXT_texture_webp keeps its image in the extension
  j.materials = K.mat.out.map(m => JSON.parse(JSON.stringify(m), (k, v) => (k.endsWith('Texture') && v?.index !== undefined ? { ...v, index: K.tex.map.get(v.index) } : v)));
  j.meshes = K.mesh.out.map(m => ({ ...m, primitives: m.primitives.map(pr => ({ ...pr, attributes: Object.fromEntries(Object.entries(pr.attributes).map(([k, v]) => [k, K.acc.map.get(v)])), ...(pr.indices !== undefined ? { indices: K.acc.map.get(pr.indices) } : {}), ...(pr.material !== undefined ? { material: K.mat.map.get(pr.material) } : {}), ...(pr.targets ? { targets: pr.targets.map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, K.acc.map.get(v)]))) } : {}) })) }));
  for (const n of j.nodes) if (n.mesh !== undefined) n.mesh = K.mesh.map.get(n.mesh);
  for (const s of j.skins ?? []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = K.acc.map.get(s.inverseBindMatrices);
  for (const a of j.animations ?? []) for (const s of a.samplers) { s.input = K.acc.map.get(s.input); s.output = K.acc.map.get(s.output); }
  for (const k of ['textures', 'images', 'samplers']) if (!j[k].length) delete j[k];
  const data = Buffer.concat([...chunks, Buffer.alloc(align(at) - at)]); j.buffers = [{ byteLength: data.length }];

  const json = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([json, Buffer.alloc(align(json.length) - json.length, 32)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + data.length, 8);
  const chunk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  await fs.writeFile(file, Buffer.concat([head, chunk(jp.length, 0x4e4f534a), jp, chunk(data.length, 0x004e4942), data]));
  return { nodes: j.nodes.length, meshes: j.meshes.length, materials: j.materials.map(m => m.name) };
}

if (process.argv[1] && /swap-weapon-part\.mjs$/.test(process.argv[1])) {
  const [file, weapon, variant] = process.argv.slice(2);
  if (!file || !WEAPON_BUILDS[weapon] || !variant) throw new Error('usage: swap-weapon-part.mjs <fighter.glb> <weapon> <variant>');
  const r = await swapWeaponPart(file, weapon, variant), size = (await fs.stat(file)).size;
  console.log(`${file}: WeaponDrawn now carries ${weapon}/${variant}; ${size} bytes, ${r.nodes} nodes, ${r.meshes} meshes, materials ${r.materials.join('/')}`);
}

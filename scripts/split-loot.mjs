// Phase L (Strategy, 2026-09-23): an opponent wears his own loot.glb carriers, so every fight against him downloads them. The whole of
// loot.glb is every opponent's kit (~3.4 MB gzip after Phase R) and would push the worst pairing past the 12 MB per-fight cap, so each
// opponent gets his own cut: src/assets/loot/carriers-<opponent>.glb (not <opponent>.glb: the dist stem would collide with his fighter
// GLB's), the same file with every other opponent's draws removed. The rig, the piece map and every node stay (a pruned draw becomes an empty node), so lootPiecesOf reads a cut exactly as it reads the whole.
// Materials and images the cut no longer uses are dropped by the build's optimize-glb.mjs, as for every GLB.
//
//   node scripts/split-loot.mjs        re-cut every opponent after loot.glb changes (tests/grade-materials.test.ts fails until you do)
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { LOOT, isWeaponLoot } from '../src/loot.ts';

// The armour an opponent wears and offers: his LOOT ids minus the weapon (a weapon is an equip file, never a loot.glb draw).
export const carriersOf = (opponent) => (LOOT[opponent] ?? []).filter((id) => !isWeaponLoot(id));

/** @param {Buffer} raw loot.glb @param {readonly string[]} ids `<opponent>.<slot>` ids to keep @returns {Buffer} */
export function splitLoot(raw, ids) {
  const size = raw.readUInt32LE(12), d = JSON.parse(raw.subarray(20, 20 + size).toString()), bin = raw.subarray(28 + size);
  if (d.buffers.length !== 1 || d.extensionsUsed?.length) throw new Error('split-loot needs one embedded buffer and no extensions');
  // The shared-draw map (brief 14): `<opponent>.<slot>` → `~<family>.<slot>`, on whichever node carries it. Same reading as lootPiecesOf.
  const shared = Object.assign({}, ...d.nodes.map((n) => n.extras?.pieces ?? {}));
  const wanted = new Set(ids.map((id) => shared[id] ?? id));
  const keepMesh = new Set();
  for (const node of d.nodes) {
    if (node.mesh === undefined) continue;
    const own = `${node.extras?.opponent}.${node.extras?.slot}`;
    if (typeof node.extras?.slot === 'string' && wanted.has(own)) keepMesh.add(node.mesh);
    else { delete node.mesh; delete node.skin; }
  }
  const found = new Set(d.nodes.filter((n) => n.mesh !== undefined).map((n) => `${n.extras.opponent}.${n.extras.slot}`));
  const missing = [...wanted].filter((id) => !found.has(id));
  if (missing.length) throw new Error(`loot.glb has no draw for ${missing.join(', ')}`);
  const renumber = (count, keep) => { const map = new Map(); for (let i = 0; i < count; i++) if (keep.has(i)) map.set(i, map.size); return map; };
  const meshMap = renumber(d.meshes.length, keepMesh);
  d.meshes = d.meshes.filter((_, i) => keepMesh.has(i));
  for (const node of d.nodes) if (node.mesh !== undefined) node.mesh = meshMap.get(node.mesh);
  // Accessors still in use: the kept primitives, every skin's inverse binds, any animation.
  const used = new Set();
  for (const mesh of d.meshes) for (const p of mesh.primitives) {
    for (const a of Object.values(p.attributes)) used.add(a);
    if (p.indices !== undefined) used.add(p.indices);
    for (const target of p.targets ?? []) for (const a of Object.values(target)) used.add(a);
  }
  for (const skin of d.skins ?? []) if (skin.inverseBindMatrices !== undefined) used.add(skin.inverseBindMatrices);
  for (const anim of d.animations ?? []) for (const s of anim.samplers) { used.add(s.input); used.add(s.output); }
  const accessorMap = renumber(d.accessors.length, used);
  d.accessors = d.accessors.filter((_, i) => used.has(i));
  const remapAccessors = (o) => { for (const [k, v] of Object.entries(o)) o[k] = accessorMap.get(v); };
  for (const mesh of d.meshes) for (const p of mesh.primitives) {
    remapAccessors(p.attributes);
    if (p.indices !== undefined) p.indices = accessorMap.get(p.indices);
    for (const target of p.targets ?? []) remapAccessors(target);
  }
  for (const skin of d.skins ?? []) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = accessorMap.get(skin.inverseBindMatrices);
  for (const anim of d.animations ?? []) for (const s of anim.samplers) { s.input = accessorMap.get(s.input); s.output = accessorMap.get(s.output); }
  // Buffer views still in use (accessors, sparse data, images), packed afresh 4-byte aligned.
  const views = new Set();
  for (const a of d.accessors) {
    if (a.bufferView !== undefined) views.add(a.bufferView);
    if (a.sparse) { views.add(a.sparse.indices.bufferView); views.add(a.sparse.values.bufferView); }
  }
  for (const image of d.images ?? []) if (image.bufferView !== undefined) views.add(image.bufferView);
  const viewMap = renumber(d.bufferViews.length, views), chunks = [];
  let offset = 0;
  d.bufferViews = d.bufferViews.flatMap((v, i) => {
    if (!views.has(i)) return [];
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength), pad = (4 - (offset % 4)) % 4;
    if (pad) chunks.push(Buffer.alloc(pad));
    offset += pad; const at = offset; chunks.push(bytes); offset += bytes.length;
    return [{ ...v, byteOffset: at }];
  });
  for (const a of d.accessors) {
    if (a.bufferView !== undefined) a.bufferView = viewMap.get(a.bufferView);
    if (a.sparse) { a.sparse.indices.bufferView = viewMap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = viewMap.get(a.sparse.values.bufferView); }
  }
  for (const image of d.images ?? []) if (image.bufferView !== undefined) image.bufferView = viewMap.get(image.bufferView);
  const tail = (4 - (offset % 4)) % 4; if (tail) chunks.push(Buffer.alloc(tail));
  const binary = Buffer.concat(chunks);
  d.buffers = [{ byteLength: binary.length }];
  let json = Buffer.from(JSON.stringify(d)); json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const out = Buffer.alloc(28 + json.length + binary.length);   // 12 header + 8 JSON chunk head + 8 BIN chunk head
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12); out.writeUInt32LE(0x4e4f534a, 16); json.copy(out, 20);
  out.writeUInt32LE(binary.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length); binary.copy(out, 28 + json.length);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../src/assets/', import.meta.url), raw = readFileSync(new URL('loot.glb', root)), dir = new URL('loot/', root);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  for (const opponent of Object.keys(LOOT)) {
    const ids = carriersOf(opponent); if (!ids.length) continue;
    writeFileSync(new URL(`carriers-${opponent}.glb`, dir), splitLoot(raw, ids));
  }
  console.log(readdirSync(dir).join(' '));
}

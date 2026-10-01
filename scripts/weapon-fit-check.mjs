// Weapon shape intake (Strategy/Lead 2026-09-28, weapon-variants brief + addendum 1): does a GLB fit the envelope a weapon's fighting depends on?
// Usage: node scripts/weapon-fit-check.mjs <file.glb> [--weapon=<id>] [--band=plain|crafted|ornate] [--profile=new|legacy] [--root=<node>]
// The weapon and band come from a `<weapon>-<band>.glb` name when not given. Geometry is measured in the WeaponDrawn frame when the file has
// one (a shipped part or a player equip file: hand at the origin, length along +Y), else in the file's root frame (a delivered shape).
// Exit 1 on any FAIL. Two profiles (Strategy 2026-09-28): `new` (the default) is the brief's full contract for a delivered shape; `legacy`
// is the envelope alone (reach, contact, width, thickness, hand at origin, +Y) for the shipped parts, grandfathered: they were made before
// the brief, so the material, map, ratio and budget rules report as INFO on them.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';

// The brief's table (metres along +Y from the hand): overall extent, contact zone, total width across X, and a Z limit where it differs from
// the class limit. Where the shipped parts differed, they are the truth (Strategy 2026-09-28): rows corrected to their measurement rounded
// outward to the centimetre (scythe, warhammer, gladius, knife, estoc, cleaver). Contact zones are the blade tables', unchanged.
export const ENVELOPE = {
  longsword: { y: [-.10, .86], contact: [.18, .86], x: .34, hafted: false },
  gladius:   { y: [-.12, .62], contact: [.16, .62], x: .25, hafted: false },
  knife:     { y: [-.11, .52], contact: [.12, .52], x: .25, hafted: false },
  estoc:     { y: [-.13, 1.15], contact: [.75, 1.15], x: .21, hafted: false },
  cleaver:   { y: [-.13, .86], contact: [.14, .86], x: .20, z: .14, hafted: false },
  scythe:    { y: [-.40, 1.35], contact: [1.22, 1.32], x: .79, z: .35, hafted: true },
  trident:   { y: [-.20, 1.22], contact: [.76, 1.22], x: .35, hafted: false },
  warhammer: { y: [-.12, .82], contact: [.705, .815], x: .35, hafted: true },
  maul:      { y: [-.20, .87], contact: [.65, .87], x: .35, hafted: true },
  reaper:    { y: [-.20, .87], contact: [0, .87], x: .60, hafted: true },
};
const REACH_TOL = .01;          // Y is the reach: hard, within a centimetre either way at both ends
const THICK = { hafted: .25, blade: .12 };   // addendum §2: hafted heads .25; blades/tines .10, guards/pommels .12 (the part's max is its guard)
const SOFT = 1.2;               // addendum §2: X and Z may run 20 % over on ORNATE, disclosed
const RATIO = { target: 1.6, cap: 2.0 };
const TRIS = { plain: 4000, crafted: 6000, ornate: 8000 };   // addendum 2 (Strategy 2026-09-28): 8k for every ornate shape

function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;
  return { json, bin: bytes.subarray(binStart, binStart + bytes.readUInt32LE(20 + jsonLength)) };
}
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readAccessor({ json, bin }, index) {
  const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView], size = COMPONENTS[accessor.type];
  const reader = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] }[accessor.componentType];
  if (!reader || (accessor.componentType !== 5126 && size !== 1)) throw new Error(`accessor ${index}: unsupported component type ${accessor.componentType}`);
  const stride = view.byteStride ?? reader[0] * size, base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), out = [];
  for (let i = 0; i < accessor.count; i++) for (let c = 0; c < size; c++) out.push(bin[reader[1]](base + i * stride + c * reader[0]));
  return out;
}
const localMatrix = (node) => node.matrix ? new Matrix4().fromArray(node.matrix)
  : new Matrix4().compose(new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
// Image size from the PNG/JPEG/WebP header, so the map rule needs no decoder.
function imageSize({ json, bin }, image) {
  const view = json.bufferViews[image.bufferView], b = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const kind = b.toString('latin1', 12, 16);
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  }
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) break;
    const marker = b[i + 1], length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  return [NaN, NaN];
}

// Every primitive's world-frame triangles below `rootName` (or the whole scene), and the structure counts.
export function measure(bytes, rootName = 'WeaponDrawn') {
  const glb = readGlb(bytes), { json } = glb, nodes = json.nodes ?? [];
  const parent = new Map(); nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const world = (i) => { const m = localMatrix(nodes[i]); for (let p = parent.get(i); p !== undefined; p = parent.get(p)) m.premultiply(localMatrix(nodes[p])); return m; };
  const rootIndex = nodes.findIndex((n) => n.name === rootName), inverse = rootIndex >= 0 ? world(rootIndex).invert() : new Matrix4();
  const under = (i) => { if (rootIndex < 0) return true; for (let p = i; p !== undefined; p = parent.get(p)) if (p === rootIndex) return true; return false; };
  const meshNodes = nodes.map((n, i) => [n, i]).filter(([n, i]) => n.mesh !== undefined && under(i));
  const positions = [], triangles = []; let vertices = 0; const materials = new Set();
  for (const [node, i] of meshNodes) {
    const m = world(i).premultiply(inverse);
    for (const primitive of json.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const raw = readAccessor(glb, primitive.attributes.POSITION), base = positions.length, count = raw.length / 3;
      for (let v = 0; v < count; v++) positions.push(new Vector3(raw[3 * v], raw[3 * v + 1], raw[3 * v + 2]).applyMatrix4(m));
      const index = primitive.indices !== undefined ? readAccessor(glb, primitive.indices) : [...Array(count).keys()];
      for (let t = 0; t + 2 < index.length; t += 3) triangles.push([base + index[t], base + index[t + 1], base + index[t + 2]]);
      vertices += count; if (primitive.material !== undefined) materials.add(primitive.material);
    }
  }
  const unique = new Set(positions.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`)).size;
  // The weapon's own maps: the images its materials sample, not every image in a rig file.
  const used = new Set();
  for (const m of materials) {
    const mat = json.materials?.[m] ?? {}, refs = [mat.pbrMetallicRoughness?.baseColorTexture, mat.pbrMetallicRoughness?.metallicRoughnessTexture, mat.normalTexture, mat.occlusionTexture, mat.emissiveTexture];
    for (const ref of refs) { const texture = ref && json.textures?.[ref.index]; const source = texture?.source ?? texture?.extensions?.EXT_texture_webp?.source; if (source !== undefined) used.add(source); }
  }
  const images = [...used].map((i) => json.images[i].bufferView !== undefined ? imageSize(glb, json.images[i]) : [NaN, NaN]);
  return { positions, triangles, vertices, unique, materials: materials.size, meshNodes: meshNodes.length, meshes: new Set(meshNodes.map(([n]) => n.mesh)).size, images, framed: rootIndex >= 0 };
}

// The rules, each { rule, status: PASS|FAIL|WARN|INFO, detail }. `legacy`: the contract rules report as INFO.
/** @param {Buffer} bytes @param {{ weapon: string, band?: string, profile?: string, root?: string }} options */
export function fitCheck(bytes, { weapon, band, profile = 'new', root = 'WeaponDrawn' }) {
  if (profile !== 'new' && profile !== 'legacy') throw new Error(`unknown profile ${profile}`);
  const env = ENVELOPE[weapon]; if (!env) throw new Error(`unknown weapon ${weapon}`);
  const { positions, triangles, vertices, unique, materials, meshNodes, meshes, images } = measure(bytes, root);
  if (!positions.length) throw new Error('no triangles found');
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of positions) { min.min(p); max.max(p); }
  const out = [], add = (rule, ok, detail, soft) => out.push({ rule, status: ok ? 'PASS' : soft ?? 'FAIL', detail });
  const f = (v) => v.toFixed(3), ornate = band === 'ornate', gate = profile === 'legacy' ? 'INFO' : undefined;
  add('extent Y (reach)', Math.abs(min.y - env.y[0]) <= REACH_TOL && Math.abs(max.y - env.y[1]) <= REACH_TOL, `${f(min.y)} … ${f(max.y)} (envelope ${env.y[0]} … ${env.y[1]}, ±${REACH_TOL})`);
  // The contact zone is covered: every centimetre slice of it crosses a triangle.
  const gaps = [];
  for (let y = env.contact[0]; y <= env.contact[1] - REACH_TOL + 1e-9; y += .01) {   // the last centimetre is the reach rule's (a tip may stop short within it)
    const hit = triangles.some(([a, b, c]) => Math.min(positions[a].y, positions[b].y, positions[c].y) <= y + 1e-6 && Math.max(positions[a].y, positions[b].y, positions[c].y) >= y - 1e-6);
    if (!hit) gaps.push(f(y));
  }
  add('contact zone Y covered', !gaps.length, gaps.length ? `empty at y = ${gaps.slice(0, 5).join(', ')}${gaps.length > 5 ? ' …' : ''}` : `${env.contact[0]} … ${env.contact[1]}`);
  const width = max.x - min.x, thick = max.z - min.z, zLimit = env.z ?? (env.hafted ? THICK.hafted : THICK.blade);
  add('total width X', width <= env.x + 1e-6, `${f(width)} (limit ${env.x}${ornate ? `, ornate ${f(env.x * SOFT)} disclosed` : ''})`, ornate && width <= env.x * SOFT ? 'WARN' : undefined);
  add('thickness Z', thick <= zLimit + 1e-6, `${f(thick)} (limit ${zLimit}${ornate ? `, ornate ${f(zLimit * SOFT)} disclosed` : ''})`, ornate && thick <= zLimit * SOFT ? 'WARN' : undefined);
  const trisCap = TRIS[band] ?? TRIS.plain;
  add('triangles', triangles.length <= trisCap, `${triangles.length} (cap ${trisCap}${band ? ` for ${band}` : ''})`, gate);
  const ratio = vertices / unique;
  add('verts ÷ unique positions', ratio <= RATIO.target, `${ratio.toFixed(2)} (${vertices} / ${unique}; target ${RATIO.target}, cap ${RATIO.cap})`, gate ?? (ratio <= RATIO.cap ? 'WARN' : undefined));
  const big = images.filter(([w, h]) => !(w <= 1024 && h <= 1024));
  add('maps ≤ 3 at ≤ 1024', images.length <= 3 && !big.length, `${images.length} image(s): ${images.map(([w, h]) => `${w}×${h}`).join(', ') || 'none'}`, gate);
  add('one node, one mesh, one material', meshNodes === 1 && meshes === 1 && materials === 1, `${meshNodes} mesh node(s), ${meshes} mesh(es), ${materials} material(s)`, gate);
  // The hand at the origin: the grip crosses y = 0 and is centred on the Y axis there.
  // Measured where the surface crosses the plane y = 0 (a lathed haft has no vertex there, only rings at its ends): the crossing points' centre.
  const grip = [];
  for (const tri of triangles) for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
    const a = positions[tri[i]], b = positions[tri[j]];
    if ((a.y < 0) !== (b.y < 0)) grip.push(a.clone().lerp(b, a.y / (a.y - b.y)));
  }
  const centre = grip.reduce((s, p) => s.add(p), new Vector3()).divideScalar(grip.length || 1);
  add('hand at origin', min.y < 0 && max.y > 0 && grip.length > 0 && Math.hypot(centre.x, centre.z) <= .02, grip.length ? `grip centre at y = 0: x ${f(centre.x)}, z ${f(centre.z)}` : 'the surface does not cross y = 0');
  add('+Y length', max.y - min.y > width && max.y - min.y > thick, `Y ${f(max.y - min.y)} vs X ${f(width)}, Z ${f(thick)}`);
  return out;
}

// `<weapon>-<band>.glb`, or an opponent's own shape on a weapon's envelope: `estoc-cane-<band>.glb` fits the estoc's.
const nameOf = (file) => /^(?<weapon>[a-z]+)(?:-[a-z]+)?-(?<band>plain|crafted|ornate)\.glb$/.exec(basename(file))?.groups;
if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, ...flags] = process.argv.slice(2), opt = Object.fromEntries(flags.map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
  if (!file) { console.error('usage: node scripts/weapon-fit-check.mjs <file.glb> [--weapon=<id>] [--band=plain|crafted|ornate] [--profile=new|legacy] [--root=<node>]'); process.exit(2); }
  const named = nameOf(file), weapon = opt.weapon ?? named?.weapon, band = opt.band ?? named?.band;
  if (!weapon) { console.error(`${file}: name it <weapon>-<band>.glb or pass --weapon`); process.exit(2); }
  const results = fitCheck(readFileSync(file), { weapon, band, profile: opt.profile ?? 'new', root: opt.root ?? 'WeaponDrawn' });
  console.log(`${basename(file)} — ${weapon}${band ? ` ${band}` : ''}`);
  for (const { rule, status, detail } of results) console.log(`  ${status.padEnd(4)}  ${rule}: ${detail}`);
  const failed = results.some((r) => r.status === 'FAIL');
  console.log(failed ? 'FAIL' : 'PASS'); process.exit(failed ? 1 : 0);
}

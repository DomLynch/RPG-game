// A player-wieldable weapon as its own small file (Brief 5, 2026-09-21): the WeaponDrawn part exactly as the hero build places it in
// hand_r (same local transform, contract extras, materials and textures), the skeleton as empties, and the weapon's own clip family
// when it has one (Warhammer_*/Trident_*/Scythe_*; a sword-family weapon plays the sword's clips already in warrior.glb). Nothing of
// the body: warrior.glb never grows. The runtime takes `WeaponDrawn` and `animations` from it; the bake takes the same (bake-blades
// `attach`), so the sim sweeps what the player sees.
//   node scripts/build-player-weapon.mjs <weapon> [--from <hero rig built with WARRIOR_WEAPON=<weapon>>] [--hero <hero rig with the sword>] [--out <file>]
// Without --from/--hero it runs build-warrior.mjs for those rigs into scratch files first (same env as a rig build).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WEAPONS } from '../src/moves.ts';

const weapon = process.argv[2];
if (!weapon || !Object.hasOwn(WEAPONS, weapon) || weapon === 'longsword') throw new Error(`usage: build-player-weapon.mjs <${Object.keys(WEAPONS).filter(w => w !== 'longsword').join('|')}>`);
const fromFlag = process.argv.indexOf('--from');
let rigPath = fromFlag > 0 ? process.argv[fromFlag + 1] : null;
if (!rigPath) {
  rigPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'hero-')), `hero-${weapon}.glb`);
  const built = spawnSync(process.execPath, ['scripts/build-warrior.mjs'], { stdio: 'inherit', env: { ...process.env, WARRIOR_FIGHTER: 'hero', WARRIOR_WEAPON: weapon, WARRIOR_OUT: rigPath } });
  if (built.status !== 0) throw new Error(`build-warrior failed for the hero with ${weapon}`);
}
const raw = await fs.readFile(rigPath);
const jsonLength = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + jsonLength)), bin = raw.subarray(28 + jsonLength);
if (doc.buffers.length !== 1 || doc.buffers[0].uri) throw new Error('expected one embedded buffer');

// The clips this weapon owns: its family (build-weapon.mjs names them <Family>_*) plus any sword clip the weapon build re-keys
// (CLEAVER_KEYS: the cleaver's and knife's Heavy leads with the edge) — found by comparing every clip's bytes with the hero's own
// warrior.glb. The runtime and the bake play these OVER the rig's same-named clips.
const family = { warhammer: 'Warhammer_', trident: 'Trident_', scythe: 'Scythe_' }[weapon];
// The baseline is a hero build with the sword from the same tree (--hero <path>, else built here): the committed warrior.glb can lag a
// rebuild in clips no weapon touches (Death_QuietOne, 2026-09-21), and that drift must not ride along in every weapon file.
const heroFlag = process.argv.indexOf('--hero');
let heroPath = heroFlag > 0 ? process.argv[heroFlag + 1] : null;
if (!heroPath) {
  heroPath = path.join(path.dirname(rigPath), 'hero-longsword.glb');
  const built = spawnSync(process.execPath, ['scripts/build-warrior.mjs'], { stdio: 'inherit', env: { ...process.env, WARRIOR_FIGHTER: 'hero', WARRIOR_WEAPON: 'longsword', WARRIOR_OUT: heroPath } });
  if (built.status !== 0) throw new Error('build-warrior failed for the hero baseline');
}
const hero = await fs.readFile(heroPath);
const heroLength = hero.readUInt32LE(12), heroDoc = JSON.parse(hero.subarray(20, 20 + heroLength)), heroBin = hero.subarray(28 + heroLength);
const clipBytes = (d, b, a) => Buffer.concat(a.samplers.flatMap(s => [s.input, s.output].map(i => { const v = d.bufferViews[d.accessors[i].bufferView]; return b.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); })));
const animations = doc.animations.filter(a => {
  if (family && a.name.startsWith(family)) return true;
  const own = heroDoc.animations.find(h => h.name === a.name);
  return own ? !clipBytes(doc, bin, a).equals(clipBytes(heroDoc, heroBin, own)) : false;
});
if (family && !animations.some(a => a.name.startsWith(family))) throw new Error(`${rigPath} has no ${family}* clips`);

const drawn = doc.nodes.findIndex(n => n.name === 'WeaponDrawn');
if (drawn < 0) throw new Error(`${rigPath} has no WeaponDrawn node`);
const parentOf = new Map(); doc.nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));
if (doc.nodes[parentOf.get(drawn)]?.name !== 'hand_r') throw new Error('WeaponDrawn must hang from hand_r');
const subtree = new Set(); (function walk(i) { subtree.add(i); (doc.nodes[i].children || []).forEach(walk); })(drawn);
// Keep the weapon, every bone a clip targets, and the chain up to the roots; everything else (body meshes, the skin) stays out.
const keep = new Set(subtree);
for (const a of animations) for (const c of a.channels) keep.add(c.target.node);
for (const i of [...keep]) for (let p = parentOf.get(i); p !== undefined; p = parentOf.get(p)) keep.add(p);

// Re-index helpers: each collection maps old index → new index in first-use order.
const remap = () => { const m = new Map(), out = []; return { of: (i, src) => { if (i === undefined) return undefined; if (!m.has(i)) { m.set(i, out.length); out.push(structuredClone(src[i])); } return m.get(i); }, out }; };
const views = remap(), accessors = remap(), materials = remap(), textures = remap(), images = remap(), samplers = remap(), meshes = remap();
const chunks = []; let offset = 0;
// A buffer view is copied once, 4-byte aligned, the first time anything kept refers to it.
const viewIndex = new Map();
const view = i => {
  if (viewIndex.has(i)) return viewIndex.get(i);
  const v = doc.bufferViews[i], bytes = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const at = offset; chunks.push(bytes); offset += bytes.length; const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  viewIndex.set(i, views.out.length); views.out.push({ ...v, buffer: 0, byteOffset: at }); return viewIndex.get(i);
};
const accessor = i => { const n = accessors.of(i, doc.accessors); const a = accessors.out[n]; if (a.bufferView !== undefined && !a._done) { a.bufferView = view(a.bufferView); a._done = true; } return n; };
const image = i => { const n = images.of(i, doc.images); const im = images.out[n]; if (im.bufferView !== undefined && !im._done) { im.bufferView = view(im.bufferView); im._done = true; } return n; };
const texture = i => { const n = textures.of(i, doc.textures); const t = textures.out[n]; if (!t._done) { t._done = true; if (t.source !== undefined) t.source = image(t.source); if (t.sampler !== undefined) t.sampler = samplers.of(t.sampler, doc.samplers); for (const e of Object.values(t.extensions || {})) if (e.source !== undefined) e.source = image(e.source); } return n; };
const material = i => { const n = materials.of(i, doc.materials); const m = materials.out[n]; if (!m._done) { m._done = true; (function walk(o) { for (const [k, v] of Object.entries(o)) { if (k.endsWith('Texture') && v?.index !== undefined) v.index = texture(v.index); else if (v && typeof v === 'object') walk(v); } })(m); } return n; };
const mesh = i => { const n = meshes.of(i, doc.meshes); const m = meshes.out[n]; if (!m._done) { m._done = true; for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) p.attributes[k] = accessor(p.attributes[k]); if (p.indices !== undefined) p.indices = accessor(p.indices); if (p.material !== undefined) p.material = material(p.material); if (p.targets) p.targets = p.targets.map(t => Object.fromEntries(Object.entries(t).map(([name, v]) => [name, accessor(v)]))); } } return n; };

const nodeIndex = new Map([...keep].sort((a, b) => a - b).map((i, n) => [i, n]));
const nodes = [...nodeIndex.keys()].map(i => {
  const { mesh: meshRef, children, ...rest } = doc.nodes[i];
  delete rest.skin;   // no skin travels: the body stays in warrior.glb
  const node = { ...rest };
  if (subtree.has(i) && meshRef !== undefined) node.mesh = mesh(meshRef);
  const kept = (children || []).filter(c => nodeIndex.has(c)).map(c => nodeIndex.get(c));
  if (kept.length) node.children = kept;
  return node;
});
const clips = animations.map(a => ({ name: a.name, samplers: a.samplers.map(s => ({ ...s, input: accessor(s.input), output: accessor(s.output) })), channels: a.channels.map(c => ({ ...c, target: { ...c.target, node: nodeIndex.get(c.target.node) } })) }));
for (const list of [accessors.out, images.out, textures.out, materials.out, meshes.out]) for (const o of list) delete o._done;

const out = {
  asset: { version: '2.0', generator: 'frankendom build-player-weapon', extras: { weapon, variant: doc.nodes[drawn].extras?.variant, family: family ? family.slice(0, -1) : 'sword', from: path.basename(rigPath), rig: doc.asset?.extras } },
  scene: 0, scenes: [{ name: `player-${weapon}`, nodes: doc.scenes[doc.scene ?? 0].nodes.filter(n => nodeIndex.has(n)).map(n => nodeIndex.get(n)) }],
  nodes, meshes: meshes.out, accessors: accessors.out, bufferViews: views.out, buffers: [{ byteLength: offset }],
  ...(materials.out.length ? { materials: materials.out } : {}), ...(textures.out.length ? { textures: textures.out } : {}), ...(images.out.length ? { images: images.out } : {}), ...(samplers.out.length ? { samplers: samplers.out } : {}),
  ...(clips.length ? { animations: clips } : {}),
};
// Only the extensions the kept objects actually use.
const used = new Set(); (function scan(o) { if (!o || typeof o !== 'object') return; if (o.extensions) for (const k of Object.keys(o.extensions)) used.add(k); for (const v of Object.values(o)) scan(v); })({ ...out, asset: undefined });
if (used.size) out.extensionsUsed = [...used].sort();
const required = (doc.extensionsRequired || []).filter(e => used.has(e)); if (required.length) out.extensionsRequired = required;

const jsonChunk = Buffer.from(JSON.stringify(out)); const jsonPad = (4 - (jsonChunk.length % 4)) % 4;
const binBuf = Buffer.concat(chunks); const binPad = (4 - (binBuf.length % 4)) % 4;
const total = 12 + 8 + jsonChunk.length + jsonPad + 8 + binBuf.length + binPad;
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonChunk.length + jsonPad, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binBuf.length + binPad, 0); binHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHeader, jsonChunk, Buffer.alloc(jsonPad, 0x20), binHeader, binBuf, Buffer.alloc(binPad)]);
const outFlag = process.argv.indexOf('--out');
const output = outFlag > 0 ? process.argv[outFlag + 1] : `src/assets/weapons/player/${weapon}.glb`;   // --out for a trial build outside the tree
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, glb);
const tris = meshes.out.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (p.indices !== undefined ? accessors.out[p.indices].count / 3 : accessors.out[p.attributes.POSITION].count / 3), 0), 0);
console.log(`${output}: ${glb.length} bytes, ${nodes.length} nodes (${subtree.size} weapon), ${tris} tris, ${clips.length} clips${clips.length ? ` (${clips.map(c => c.name).join(', ')})` : ''}, materials ${materials.out.map(m => m.name).join('/')}`);

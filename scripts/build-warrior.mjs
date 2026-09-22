import { quietOneClip } from './build-quiet-one.mjs';
import { fitVeteranNeck, textureVeteranTrident } from './veteran-finish.mjs';
import { warriorRecipe, DWARF_BONES } from './warrior-recipe.mjs';
import { warriorAppearance } from './warrior-appearance.mjs';
// Offline art build. Inputs: official CC0 Standard archives extracted under artifacts/source.
// No additional packages: use the same Three.js geometry, skinning and glTF tools as the game.
import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

globalThis.ProgressEvent = class { constructor(_, fields) { Object.assign(this, fields); } };
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const source = 'artifacts/source';
const realistic = process.env.WARRIOR_BODY !== 'classic'; // the Blender Studio body with the reconstructed head ships; WARRIOR_BODY=classic rebuilds the CC0 stylised one
// WARRIOR_FIGHTER=veteran builds the opponent from scripts/character/parts.py --fighter veteran (its own scan, helm and maps)
// into src/assets/veteran.glb; the default (hero) is the player's warrior.glb. Same rig and body clips; the Veteran carries the trident.
const fighter = process.env.WARRIOR_FIGHTER || 'hero';
// WARRIOR_LOOT=1 (Brief 5, 2026-09-21): the loot file. The hero rig and materials, no body, no weapon, no clips — only the opponents'
// kit pieces named in src/assets/source/loot/loot.json, each bound to the player's skeleton as its own skinned draw
// `<opponent>.<slot>.<material>` (userData.opponent/slot). The runtime binds a draw to the player's Skeleton and hides the player's
// own draw in that slot. Output src/assets/loot.glb; warrior.glb is untouched (LOOT=false is byte-identical).
const LOOT = process.env.WARRIOR_LOOT === '1';
if (LOOT && fighter !== 'hero') throw new Error('WARRIOR_LOOT builds on the hero rig only');
const recipe = warriorRecipe(fighter, process.env.WARRIOR_WEAPON), variant = realistic ? process.env.WARRIOR_PARTS_VARIANT || recipe.body : '';   // WARRIOR_PARTS_VARIANT: a reconstruction's donor rig borrows another fighter's parts (the surface is replaced by creature_pack.py)
// WARRIOR_WEAPON=trident (weapons lane, scripts/build-weapon.mjs): the fighter carries that weapon instead of the sword — no scabbard, the
// sword nodes stay as empty groups (the runtime's loader looks them up), WeaponDrawn hangs under hand_r with the sword's transform and
// the weapon's own clips join the set. The hero defaults to the longsword (byte-identical output); the Veteran defaults to the trident
// since slice V (duel.ts initialDuel gives him it), so a plain rebuild never hands him the sword back.
if (recipe.pipeline === 'reconstruction' && !process.env.WARRIOR_PARTS_VARIANT) throw new Error(`Use node scripts/build-creatures.mjs ${fighter} for this reconstructed surface`);   // a donor-rig build for a reconstruction is the exception (WARRIOR_OUT outside src/assets)
const weaponId = recipe.weapon;
const appearance = warriorAppearance(process.env.WARRIOR_PARTS_VARIANT || fighter);   // a donor rig wears the borrowed fighter's palette too
if (!realistic && fighter !== 'hero') throw new Error('WARRIOR_FIGHTER needs the realistic body');
const output = process.env.WARRIOR_OUT || (LOOT ? 'src/assets/loot.glb' : fighter === 'hero' ? 'src/assets/warrior.glb' : `src/assets/${fighter}.glb`);
const baseDir = path.join(source, 'base/Universal Base Characters[Standard]/Base Characters/Godot - UE');
const json = JSON.parse(await fs.readFile(path.join(baseDir, 'Superhero_Male_FullBody.gltf'), 'utf8'));
// The foundation supplies topology and weights. Our covered warrior needs none of its face/hair textures.
json.images = []; json.textures = [];
json.materials = json.materials.map(m => ({ name: m.name }));
for (const buffer of json.buffers) buffer.uri = 'data:application/octet-stream;base64,' + (await fs.readFile(path.join(baseDir, buffer.uri))).toString('base64');
const loader = new GLTFLoader();
const base = await loader.parseAsync(JSON.stringify(json), '');
const bytes = await fs.readFile(path.join(source, 'animations/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'));
const library = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const bytes2 = await fs.readFile(path.join(source, 'animations2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'));
const library2 = await loader.parseAsync(bytes2.buffer.slice(bytes2.byteOffset, bytes2.byteOffset + bytes2.byteLength), '');
base.scene.updateMatrixWorld(true); library.scene.updateMatrixWorld(true); library2.scene.updateMatrixWorld(true);
const body = base.scene.getObjectByName('SuperHero_Male');
if (!body?.isSkinnedMesh) throw new Error('Expected the licensed skinned body');
const skeleton = body.skeleton;
const cloth = new T.MeshStandardMaterial({ name: 'Gambeson', color: '#9a8f7c', roughness: 0.96 }); // undyed, dirty linen
const steel = new T.MeshStandardMaterial({ name: 'Steel', ...appearance.steel });
const trim = new T.MeshStandardMaterial({ name: 'Antique brass', color: '#8a6a3c', metalness: 0.85, roughness: 0.5 }); // worn bronze furniture
const blade = new T.MeshStandardMaterial({ name: 'Blade', color: '#c3c7ca', metalness: 0.9, roughness: 0.3 });
const leather = new T.MeshStandardMaterial({ name: 'Leather', color: appearance.leather, roughness: 0.8 });
const heraldry = new T.MeshStandardMaterial({ name: 'Heraldry', color: appearance.heraldry, roughness: 0.92, side: T.DoubleSide }); // dye over the undyed map
// The universal humanoid: the whole CC0 body with its own face, eyes and eyebrows. Skin maps come from the manifest.
const skin = new T.MeshPhysicalMaterial({ name: 'Skin', roughness: 1, specularIntensity: 0.5 }); // skin-strength specular, the same as the head tile's: the two tiles meet on the neck and must shade alike
body.material = skin;
for (const mesh of [body, base.scene.getObjectByName('Eyes')]) { mesh.geometry.morphAttributes = {}; mesh.morphTargetInfluences = []; mesh.morphTargetDictionary = {}; }
base.scene.getObjectByName('Eyes').material = new T.MeshStandardMaterial({ name: 'Eyes', roughness: .35 });
const hair = new T.MeshStandardMaterial({ name: 'Hair', color: '#2b211b', roughness: .88 });
const ranger = new T.MeshStandardMaterial({ name: 'Ranger', roughness: 1 }); // CC0 outfit-pack items; maps from the manifest
const bronze = new T.MeshStandardMaterial({ name: 'Bronze', color: appearance.bronze, roughness: 1, metalness: 1 });
const wrap = new T.MeshStandardMaterial({ name: 'Wrap', roughness: .85 }); // wrist wraps: leather strip maps from the manifest
const eyesMaterial = new T.MeshPhysicalMaterial({ name: 'Eyes', roughness: .3, clearcoat: .5, clearcoatRoughness: .18 }); // wet cornea, soft highlight; roughness from the map
// Realistic head: its own texture tile with skin-strength specular (KHR_materials_specular), and strand cards for hair,
// brows and lashes as an alpha cut-out (no sorting, works in the shadow pass).
const face = new T.MeshPhysicalMaterial({ name: 'Face', roughness: 1, specularIntensity: 0.5 });
const hairCards = new T.MeshPhysicalMaterial({ name: 'HairCards', roughness: .9, specularIntensity: .3, alphaTest: .35, side: T.DoubleSide }); // 0.35: loose strands survive mip averaging
const browCards = new T.MeshPhysicalMaterial({ name: 'BrowCards', roughness: .9, specularIntensity: .3, transparent: true, alphaTest: .04, side: T.DoubleSide }); // small cards over opaque skin: blended, so hair tips stay soft
const hairShell = new T.MeshPhysicalMaterial({ name: 'HairShell', roughness: .9, specularIntensity: .25, alphaTest: .42, side: T.DoubleSide, vertexColors: true }); // fur shells: dot alpha × per-shell vertex alpha
// Photogrammetry head (KeenTools reconstruction of the owner's portraits): its own textures, skin specular, wet eyes.
const photo = new T.MeshPhysicalMaterial({ name: 'Photo', roughness: .78, specularIntensity: .35 }); // 2026-09-16: .62/.5 read shiny beside the body's skin (roughness map 0.62+, specular .5)
const photoEyes = new T.MeshPhysicalMaterial({ name: 'PhotoEyes', roughness: .25, clearcoat: .5, clearcoatRoughness: .1 }); // wet cornea: a small catch-light without the room washing the iris grey
const photoTeeth = new T.MeshStandardMaterial({ name: 'PhotoTeeth', roughness: .4 });
const bone = new T.MeshStandardMaterial({ name: 'Bone', color: '#b3a073', roughness: .58 }); // yellowed ivory, not chalk: the tusks
const boneWorn = new T.MeshStandardMaterial({ name: 'BoneWorn', color: '#6e5d45', roughness: .72 }); // the lashed plates: old bone gone dark, pulled toward the leather (owner, 2026-09-16: "a bit darker, or the leather colour") // the Pitborn's tusks and plates (materials rule: bone)
const ruby = new T.MeshStandardMaterial({ name: 'Ruby', color: '#4a0d18', metalness: 0.8, roughness: 0.35 }); // the Nightborn's crown: dark ruby metal, not bright red (owner's examples, 2026-09-18)
const parts = new Map([steel, trim, leather, heraldry, cloth, hair, ranger, bronze, wrap, skin, eyesMaterial, face, hairCards, browCards, hairShell, photo, photoEyes, photoTeeth, bone, boneWorn, ruby].map(m => [m, []]));
// Per-fighter frame (moves.ts OPPONENTS.scale must match `scale`; tests/characters.test.ts checks the shipped height against it): the whole
// rig is scaled, so every clip, the hand's sword and the baked blade paths follow. `hunch` bends bones forward by degrees in every clip
// (a constant post-rotation about each bone's own rest sideways axis) — the brute's forward-hunched spine, head thrust out to look at you.
// The Nightborn: a shade taller than a man and the opposite posture to the brute — the same post-rotations with the signs reversed: chest
// back, chin up (OPPONENTS.nightborn.scale is the measured standing ratio; the hit capsule follows it).
// The goblin (opponent 4) is a small man RE-PROPORTIONED, not a shrunken one: `bones` scales each named bone about its own joint in its rest
// frame (y along the bone = its length, x/z its girth), applied through the skin weights of every part before binding — a smooth stretch,
// no fold at a joint — and the rig's rest positions and inverse binds are rebuilt to match (`reproportion` below). Rotations, hence every
// clip's keys, are untouched; the pelvis drops by what the legs lost so the feet stay on the floor, and its walk bob scales with the legs
// (`bob`). `scale` then sizes the whole man: 0.835 × the re-proportioned ~1.65 m ≈ 1.36 m standing. OPPONENTS.goblin.scale (0.78) is the
// measured standing-height ratio — the hit capsule follows the man's height, not the root scale — and tests/characters.test.ts pins it.
// `stride` (root scale × leg scale) is written to the GLB so the runtime plays his walk at his own pace instead of a man's (characters.ts).
const BUILD = { hero: { scale: 1, hunch: [] }, veteran: { scale: 1, hunch: [] }, pitborn: { scale: 1.13, hunch: [['spine_02', 7], ['spine_03', 7], ['neck_01', -7], ['Head', -6]] },
  nightborn: { scale: 1.03, hunch: [['spine_02', -2], ['spine_03', -2], ['Head', -4]] },
  executioner: { scale: 1.36, hunch: [] },   // 20 % over the Pitborn's 1.13 (owner, 2026-09-17); no hunch — the Executioner stands straight
  goblin: { scale: .835, hunch: [['spine_02', 9], ['spine_03', 9], ['neck_01', -8], ['Head', -8]], bob: .84, stride: .835 * .84, floor: .12,
    bones: { thigh_l: [1, .84, 1], thigh_r: [1, .84, 1], calf_l: [1, .84, 1], calf_r: [1, .84, 1],   // short legs
      upperarm_l: [1, 1.16, 1], upperarm_r: [1, 1.16, 1], lowerarm_l: [1, 1.16, 1], lowerarm_r: [1, 1.16, 1],   // long arms (the hands keep their size: the grip and the sword are untouched)
      neck_01: [.86, .9, .86], Head: [1.17, 1.17, 1.17] } },   // a thin, shorter neck; a big head
  // The dwarf donor (2026-09-20): a short, wide man — the TRELLIS surface replaces this body in creature_pack.py, so only the joints,
  // inverse binds, stride and the trident matter. Legs lose 28 %, torso/limbs gain 20–25 % girth, a short thick neck and a bigger head;
  // `scale` .95 lands ~1.45 m standing. Owner asked for true dwarf proportions rather than the 1.60 m Veteran fit.
  dwarf: { scale: .95, hunch: [['spine_02', 4], ['spine_03', 4], ['neck_01', -3], ['Head', -3]], bob: .72, stride: .95 * .72, floor: .10,
    bones: DWARF_BONES } }[fighter] ?? { scale: 1, hunch: [] };
const boneIndex = name => {
  const index = skeleton.bones.findIndex(b => b.name === name);
  if (index < 0) throw new Error(`Missing attachment bone ${name}`);
  return index;
};
// Rigid plate pieces become one skinned draw per material, not dozens of moving meshes.
// Equipment slots: authored parts declare extras.slot; each (slot, material) pair becomes its own skinned draw so a slot
// can be shown, hidden or swapped without touching the others. Built-in pieces (hair, scabbard) sit in the '' slot.
const slotOf = new Map();
let lootOf = '', lootSlot = ''; const lootLayer = new Map();   // loot build only: the opponent whose pieces are being added, the slot its primitives fall into (add()'s default slot — '' in every other build, so nothing changes), opponent:slot → 'replace' | 'over'   // loot build: the opponent whose pieces are being added, and the slot primitives fall into; '' otherwise
function add(g, material, bone, x = 0, y = 0, z = 0, rotation = 0, slot = lootSlot) {
  if (g.index) g = g.toNonIndexed();
  g.userData.slot = LOOT ? `${lootOf}:${slot}` : slot;   // loot: draws group per (opponent, slot, material)
  g.rotateZ(rotation); g.translate(x, y, z);
  if (bone) { // rigid: every vertex follows one bone; otherwise the geometry already carries remapped skin weights
    const count = g.getAttribute('position').count, index = boneIndex(bone);
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Array.from({ length: count * 4 }, (_, i) => i % 4 ? 0 : index), 4));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(Array.from({ length: count * 4 }, (_, i) => i % 4 ? 0 : 1), 4));
  }
  // Every bucket merges into one draw: keep only the attributes the game reads so authored and primitive parts agree.
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'uv1', 'skinIndex', 'skinWeight'].includes(name) && !(name === 'color' && material.vertexColors)) g.deleteAttribute(name);
  withAoUv(g);
  parts.get(material).push(g);
}
// TEXCOORD_1 addresses the baked body occlusion. Pieces cut from the body carry the body's layout; anything else points
// at a fully lit texel so it takes no shadow it did not earn.
const AO_WHITE = [0.85, 0.30];
function withAoUv(g) {
  if (!g.getAttribute('uv1')) g.setAttribute('uv1', new T.Float32BufferAttribute(Array.from({ length: g.getAttribute('position').count * 2 }, (_, i) => AO_WHITE[i % 2]), 2));
  return g;
}
function plate(x, y, z, sx, sy, sz, material, bone) {
  add(new T.SphereGeometry(1, 20, 12).scale(sx, sy, sz), material, bone, x, y, z);
}
function band(x, y, z, radius, depth, bone, material = trim, rotation = 0, stretch = 1) {
  const g = new T.TorusGeometry(radius, depth, 5, 24); g.rotateX(Math.PI / 2); g.scale(1, 1, stretch);
  add(g, material, bone, x, y, z, rotation);
}
function strip(w, h, d, x, y, z, material, bone, rotation = 0) {
  add(new T.BoxGeometry(w, h, d), material, bone, x, y, z, rotation);
}
function knee(x, bone) {
  const shape = new T.Shape(); shape.moveTo(0,.076); shape.lineTo(.064,.035); shape.lineTo(.072,-.015); shape.lineTo(0,-.078); shape.lineTo(-.072,-.015); shape.lineTo(-.064,.035); shape.closePath();
  const g = new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1});
  add(g,steel,bone,x,.55,.025);
}
// The Pitborn's bone plates (owner's brief: lashed at shoulder and forearm): rigid ellipsoids on the left shoulder cap and down the
// upper arm, two along the sword forearm. Iron knee plates wait for a kit pass in parts.py (the classic-body knee() primitive read as boxes).
if (fighter === 'pitborn' || LOOT) {
  if (LOOT) { lootOf = 'pitborn'; lootSlot = 'Arms'; }
  const at = name => new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(skeleton.boneInverses[boneIndex(name)]).invert());
  const shoulder = at('upperarm_l'), elbow = at('lowerarm_l'), wrist = at('hand_r'), elbowR = at('lowerarm_r');
  for (let i = 0; i < 3; i++) { const p = new T.Vector3().lerpVectors(shoulder, elbow, .04 + i * .16); plate(p.x + .012, p.y + .045 - i * .012, p.z + .01, .074 - i * .008, .024, .06, boneWorn, 'upperarm_l'); }
  for (let i = 0; i < 2; i++) { const p = new T.Vector3().lerpVectors(elbowR, wrist, .30 + i * .28); plate(p.x, p.y, p.z + .028, .03, .058, .02, boneWorn, 'lowerarm_r'); }
}
if (LOOT) { lootOf = ''; lootSlot = ''; }
// Peaked closed sallet: elliptical rings give it a forged silhouette, tapered neck and brow.
function shell(rings, material, bone, z = 0) {
  const vertices = [], uvs = [], segments = 48;
  for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < segments; i++) {
    const point = (r, a) => { const [y, rx, rz] = rings[r]; return [Math.sin(a) * rx, y, Math.cos(a) * rz + z]; };
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
    for (const [r,t] of [[row,a],[row,b],[row+1,a],[row,b],[row+1,b],[row+1,a]]) { vertices.push(...point(r,t)); uvs.push(t/(2*Math.PI), r/(rings.length-1)); }
  }
  let g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g = mergeVertices(g);
  g.computeVertexNormals(); add(g, material, bone);
}
// Level-1 kit and every later tier come from authored parts (below). Buzzed hair from the CC0 pack sits on the head.
if (realistic) { body.visible = false; base.scene.getObjectByName('Eyes').removeFromParent(); base.scene.getObjectByName('Eyebrows').removeFromParent(); }
else {
  const hairDir = path.join(source, 'base/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
  const hairJson = JSON.parse(await fs.readFile(path.join(hairDir, 'Hair_Buzzed.gltf'), 'utf8'));
  hairJson.images = []; hairJson.textures = []; hairJson.materials = hairJson.materials.map(m => ({ name: m.name }));
  for (const buffer of hairJson.buffers) buffer.uri = 'data:application/octet-stream;base64,' + (await fs.readFile(path.join(hairDir, buffer.uri))).toString('base64');
  const asset = await loader.parseAsync(JSON.stringify(hairJson), ''); asset.scene.updateMatrixWorld(true);
  asset.scene.traverse(o => { if (o.isMesh) add(o.geometry.clone().applyMatrix4(o.matrixWorld), hair, 'Head', 0, 0, 0, 0, 'Hair'); });
  // Eyebrows ride the head rigidly too: one draw with the hair instead of their own skinned mesh.
  const eyebrows = base.scene.getObjectByName('Eyebrows'); eyebrows.geometry.morphAttributes = {};
  add(eyebrows.geometry.clone().applyMatrix4(eyebrows.matrixWorld), hair, 'Head'); eyebrows.removeFromParent();
}
// Authored parts from scripts/character/parts.py: meshes in this same unscaled rest space, rigid to extras.bone,
// merged into the per-material skinned draws exactly like the primitives above. No parts → identical output.
const partsDir = process.env.WARRIOR_PARTS || 'src/assets/source/parts';
const partFiles = LOOT ? [] : (await fs.readdir(partsDir).catch(() => [])).filter(f => f.endsWith('.glb') && (variant ? f.endsWith(`_${variant}.glb`) : !/_\w+\.glb$/.test(f))).sort(); // body_<variant>.glb + level1_<variant>.glb; the classic build takes the untagged level1.glb
for (const file of partFiles) {
  const glb = await fs.readFile(path.join(partsDir, file)), part = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  part.scene.updateMatrixWorld(true);
  part.scene.traverse(o => {
    if (!o.isMesh) return;
    const material = [...parts.keys()].find(m => m.name === o.userData.material);
    if (!material || (!o.userData.bone && !o.isSkinnedMesh)) throw new Error(`${file}: mesh ${o.name} needs extras.material (${[...parts.keys()].map(m => m.name).join('|')}) and extras.bone or skin weights`);
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (o.isSkinnedMesh && !o.userData.bone) { // authored weights: the part's joint order → this skeleton's, by bone name
      const map = o.skeleton.bones.map(b => skeleton.bones.some(x => x.name === b.name) ? boneIndex(b.name) : boneIndex(b.name.replace(/[._]\d{1,3}$/, ''))), index = g.getAttribute('skinIndex');
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Array.from(index.array, i => map[i]), 4));
    }
    add(g, material, o.userData.bone, 0, 0, 0, 0, o.userData.slot || '');
  });
}
// Equipped items (WARRIOR_ITEMS=ranger,...): src/assets/source/items/<name>.glb, same contract as parts. An item replaces
// whatever the level-1 kit put in the same slot. Demo builds only until the runtime swaps slots itself.
const items = LOOT ? '' : process.env.WARRIOR_ITEMS ?? appearance.items; // An explicit empty override keeps the fighter bareheaded.
for (const item of items.split(',').filter(Boolean)) {
  const own = `src/assets/source/items/${item}_${fighter}.glb`, file = fighter !== 'hero' && await fs.stat(own).then(() => true, () => false) ? own : `src/assets/source/items/${item}.glb`; // a helm is shelled from its fighter's skull
  const glb = await fs.readFile(file), asset = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  asset.scene.updateMatrixWorld(true);
  const slots = new Set(); asset.scene.traverse(o => { if (o.isMesh) slots.add(o.userData.slot); });
  if (slots.has('Helmet')) slots.add('Hair'); // a helmet covers the hair
  for (const [material, list] of parts) parts.set(material, list.filter(g => !slots.has(g.userData.slot)));
  asset.scene.traverse(o => {
    if (!o.isMesh) return;
    const material = [...parts.keys()].find(m => m.name === o.userData.material), g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (o.isSkinnedMesh) { const map = o.skeleton.bones.map(b => skeleton.bones.some(x => x.name === b.name) ? boneIndex(b.name) : boneIndex(b.name.replace(/[._]\d{1,3}$/, ''))), index = g.getAttribute('skinIndex'); g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Array.from(index.array, i => map[i]), 4)); }
    add(g, material, o.userData.bone, 0, 0, 0, 0, o.userData.slot);
  });
}
// Loot (WARRIOR_LOOT=1): src/assets/source/loot/loot.json names, per opponent, the authored pieces they drop and the player slot each
// fills. Sources are parts.py/items outputs (same contract as the parts above); `slots`/`names` pick meshes out of a shared file.
if (LOOT) {
  const lootDir = 'src/assets/source', manifest = JSON.parse(await fs.readFile(path.join(lootDir, 'loot/loot.json'), 'utf8'));
  // The Dwarf's iron keeps his baked look (scripts/character/loot_dwarf.py writes the maps beside its GLB); every other piece wears the palette.
  parts.set(new T.MeshStandardMaterial({ name: 'DwarfIron', roughness: 1, metalness: .35 }), []);
  // A piece cut from a re-proportioned body (loot.json "unscale": the BUILD name) comes back to a man's frame by inverting that field
  // through the piece's own weights: forward, v' = v + Σ w (shift + M (v − j)) with M = R (S − I) R⁻¹, so v = A⁻¹ (v' − c) with
  // A = I + Σ w M and c = Σ w (shift − M j). Weights are the transferred ones the piece already carries.
  const unscalers = new Map();
  const unscaler = name => {
    if (unscalers.has(name)) return unscalers.get(name);
    const bones = { dwarf: DWARF_BONES }[name]; if (!bones) throw new Error(`loot: no proportion table for ${name}`);
    const { joint, frame, S, shift } = proportionField(bones);
    const M = skeleton.bones.map((_, i) => { const R = new T.Matrix4().makeRotationFromQuaternion(frame[i]), D = new T.Matrix4().makeScale(S[i].x - 1, S[i].y - 1, S[i].z - 1); return new T.Matrix3().setFromMatrix4(R.clone().multiply(D).multiply(R.clone().invert())); });
    const c = skeleton.bones.map((_, i) => shift[i].clone().sub(joint[i].clone().applyMatrix3(M[i])));
    const fn = g => {
      const position = g.getAttribute('position'), index = g.getAttribute('skinIndex'), weight = g.getAttribute('skinWeight'), v = new T.Vector3(), A = new T.Matrix3(), cc = new T.Vector3();
      for (let k = 0; k < position.count; k++) {
        v.fromBufferAttribute(position, k); A.identity(); cc.set(0, 0, 0);
        for (let q = 0; q < 4; q++) { const w = weight.getComponent(k, q); if (!w) continue; const i = index.getComponent(k, q); const e = A.elements, m = M[i].elements; for (let t = 0; t < 9; t++) e[t] += w * m[t]; cc.addScaledVector(c[i], w); }
        v.sub(cc).applyMatrix3(A.invert()); position.setXYZ(k, v.x, v.y, v.z);
      }
      return g;
    };
    unscalers.set(name, fn); return fn;
  };
  for (const [opponent, entries] of Object.entries(manifest)) {
    if (opponent === '_') continue;
    lootOf = opponent;
    for (const entry of entries) {
      if (!['replace', 'over'].includes(entry.layer)) throw new Error(`loot ${opponent}.${entry.slot}: layer must be replace|over`);
      lootLayer.set(`${opponent}:${entry.slot}`, entry.layer);
      if (entry.file.startsWith('@build:')) continue;   // primitives this script builds itself (the Pitborn's plates above)
      const glb = await fs.readFile(path.join(lootDir, entry.file)), asset = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
      asset.scene.updateMatrixWorld(true);
      let taken = 0;
      asset.scene.traverse(o => {
        if (!o.isMesh) return;
        if (entry.slots && !entry.slots.includes(o.userData.slot)) return;
        if (entry.names && !entry.names.some(n => o.name === n || o.name.startsWith(`${n}_`))) return;
        const material = [...parts.keys()].find(m => m.name === o.userData.material);
        if (!material || (!o.userData.bone && !o.isSkinnedMesh)) throw new Error(`${entry.file}: mesh ${o.name} needs extras.material and extras.bone or skin weights`);
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (o.isSkinnedMesh && !o.userData.bone) {
          const map = o.skeleton.bones.map(b => skeleton.bones.some(x => x.name === b.name) ? boneIndex(b.name) : boneIndex(b.name.replace(/[._]\d{1,3}$/, ''))), index = g.getAttribute('skinIndex');
          g.setAttribute('skinIndex', new T.Uint16BufferAttribute(Array.from(index.array, i => map[i]), 4));
        }
        if (entry.unscale) { if (!o.isSkinnedMesh) throw new Error(`${entry.file}: unscale needs skin weights on ${o.name}`); unscaler(entry.unscale)(g); }
        add(g, material, o.userData.bone, 0, 0, 0, 0, entry.slot); taken++;
      });
      if (!taken && !entry.optional) throw new Error(`loot ${opponent}: nothing matched in ${entry.file} (${JSON.stringify({ slots: entry.slots, names: entry.names })})`);
    }
  }
  lootOf = '';
}
// The goblin's trophies (owner's brief): a bone-and-string necklace — five teeth and a finger on a cord that hugs the collar, rigid to spine_03 —
// and one iron bracer that doesn't match on the left forearm (the sword hand stays free): a tapered sleeve with two rivet bands, rigid to
// lowerarm_l. The cord is fitted by raycast: from the neck's axis outward at 36 azimuths, lower at the front (the clavicles) than at the nape,
// the outermost thing already on him (skin, the scan's neck, tunic, baldric — every bucket so far, in rest space) plus 7 mm; the teeth and the
// finger hang from it, each set just off the chest at its own height. It rests on the man, whatever the build.
if (fighter === 'goblin' || LOOT) {
  const at = name => new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(skeleton.boneInverses[boneIndex(name)]).invert());
  // Loot: the cord is fitted over the PLAYER — his skin and level-1 kit loaded for the rays only, never exported; the necklace is a Body
  // piece worn over the tunic, the bracer an Arms piece over the wraps.
  const wornGeometries = LOOT ? await (async () => {
    const list = [];
    for (const file of ['body_realistic.glb', 'level1_realistic.glb']) {
      const glb = await fs.readFile(path.join(partsDir, file)), asset = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
      asset.scene.updateMatrixWorld(true); asset.scene.traverse(o => { if (o.isMesh) list.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
    }
    return list;
  })() : [...parts.values()].flat();
  if (LOOT) { lootOf = 'goblin'; lootSlot = 'Body'; }
  const worn = wornGeometries.map(g => new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide })));   // everything on him so far (rest space): skin, the scan head's neck, tunic, baldric
  const ray = new T.Raycaster(); ray.far = .35;
  const axis = at('neck_01').clone().add(new T.Vector3(0, 0, .03));   // the neck's own axis at the collar
  const surface = (y, a, gap) => {   // from the axis at height y, outward at azimuth a (0 = +z, the front): the outermost thing worn there, plus a gap
    const out = new T.Vector3(Math.sin(a), 0, Math.cos(a)), origin = new T.Vector3(axis.x, y, axis.z);
    ray.set(origin, out); const hits = ray.intersectObjects(worn, false); if (!hits.length) throw new Error(`goblin necklace: nothing worn at ${y.toFixed(3)} m, azimuth ${a.toFixed(2)}`);
    return origin.addScaledVector(out, Math.max(...hits.map(h => h.distance)) + gap);
  };
  const nape = axis.y + .012, front = nape - .065, collar = a => surface(nape - (nape - front) * (1 + Math.cos(a)) / 2, a, .007);   // the cord: lower at the front than at the nape
  const ring = Array.from({ length: 36 }, (_, k) => collar(k / 36 * Math.PI * 2));
  add(new T.TubeGeometry(new T.CatmullRomCurve3(ring, true), 96, .0035, 6, true), leather, 'spine_03');
  for (let i = -2; i <= 2; i++) {   // teeth: bone cones hanging point-down from the front of the cord, the middle ones longest, each just off the chest at its own height
    const length = .03 - Math.abs(i) * .004, p = surface(front - .012 - length / 2, i * .17, .006);
    add(new T.ConeGeometry(.0055, length, 7).rotateX(Math.PI), bone, 'spine_03', p.x, p.y, p.z);
  }
  const f = surface(front - .035, -.5, .006);   // a finger: three knuckles, hanging beside the teeth
  for (let k = 0; k < 3; k++) add(new T.CylinderGeometry(.0065 - k * .0008, .006 - k * .0008, .018, 8), bone, 'spine_03', f.x, f.y - k * .017, f.z);
  const elbow = at('lowerarm_l'), wrist = at('hand_l'), arm = wrist.clone().sub(elbow), length = arm.length(); arm.normalize();
  const along = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), arm);
  const sleeve = (t0, t1, r0, r1, material) => { const g = new T.CylinderGeometry(r1, r0, (t1 - t0) * length, 18, 1, true).applyQuaternion(along); const c = elbow.clone().addScaledVector(arm, (t0 + t1) / 2 * length); add(g, material, 'lowerarm_l', c.x, c.y, c.z); };
  if (LOOT) lootSlot = 'Arms';
  sleeve(.28, .82, .052, .042, steel);   // the bracer: elbow end wider, a rust-brown iron sleeve
  sleeve(.30, .34, .055, .054, trim); sleeve(.76, .80, .046, .045, trim);   // two bronze rivet bands (mismatched furniture)
  console.log(`  goblin trophies: cord front ${ring[0].toArray().map(v => v.toFixed(3))}, nape ${ring[18].toArray().map(v => v.toFixed(3))}`);
  if (LOOT) { lootOf = ''; lootSlot = ''; }
}
// Sheathed straight sword on the hip; its visible guard establishes the neutral longsword.
// Geometry is baked in bind space, with the scabbard angled away from the leg.
// Leather scabbard with a bronze throat and chape, the same size and angle as the old plank so the sheathed sword fits.
if (weaponId === 'longsword' && !LOOT) {
  add(bladeGeometry(-.33, .33, .06, .026, .12).rotateZ(Math.PI), leather, 'pelvis', -.24, .79, -.13, -.19);
  add(new T.CylinderGeometry(.031, .031, .03, 12), trim, 'pelvis', -.24, .79 + .30, -.13, -.19);
  add(new T.TorusGeometry(.036, .007, 6, 18).rotateX(Math.PI / 2), leather, 'pelvis', -.24, .79 + .26, -.13, -.19); // belt loop holding the scabbard
  add(new T.CylinderGeometry(.008, .016, .05, 10), trim, 'pelvis', -.24, .79 - .30, -.13, -.19);
}
// Separate sword nodes allow a presentation-only transfer from scabbard to hand.
// Diamond-section blade: a centre ridge that catches the key light, tapering to a point. Length and tip stay where the
// bake samples them (local y .18 and .86 on the SwordDrawn node); only the look changes.
function bladeGeometry(base, tip, width, thickness, pointFraction = .14, segments = 12) {
  const length = tip - base, positions = [], uvs = [], ring = s => {
    const t = s / segments, y = base + t * length, taper = t < 1 - pointFraction ? 1 - .3 * t / (1 - pointFraction) : .7 * (1 - t) / pointFraction;
    const w = width * taper / 2, d = thickness * Math.max(taper, .08) / 2;
    return [[w, y, 0], [0, y, d], [-w, y, 0], [0, y, -d]];
  };
  for (let s = 0; s < segments; s++) {
    const a = ring(s), b = ring(s + 1);
    for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; for (const [p, v] of [[a[k], s], [a[n], s], [b[n], s + 1], [a[k], s], [b[n], s + 1], [b[k], s + 1]]) { positions.push(...p); uvs.push(k % 2, v / segments); } }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals(); return g;
}
// Phase 2 polish (weapons lane, 2026-09-20): the hero's longsword is the reconstructed part when it exists (scripts/weapon-fit.py →
// src/assets/source/weapons/longsword.part.glb), in the hand AND the scabbard node — the same geometry, one buffer in the export.
// WEAPON_VARIANT=procedural rebuilds the primitives below, byte-identical to before.
const longswordPart = weaponId === 'longsword' && process.env.WEAPON_VARIANT !== 'procedural' && await fs.stat('src/assets/source/weapons/longsword.part.glb').then(() => true, () => false)
  ? await (await import('./build-weapon.mjs')).sourced('longsword', null)({}) : null;
function sword(name, parent) {
  const group = new T.Group(); group.name = name; parent.add(group);
  if (longswordPart) { for (const child of longswordPart.children) group.add(child.clone()); return group; }
  const piece = (geometry, material, y) => { const mesh = new T.Mesh(withAoUv(geometry), material); mesh.position.y = y; group.add(mesh); };
  piece(bladeGeometry(.10, .86, .046, .007), blade, 0);
  piece(new T.CapsuleGeometry(.011, .21, 3, 10).rotateZ(Math.PI / 2), trim, .092);           // rounded bronze crossguard
  piece(new T.CylinderGeometry(.013, .015, .15, 10), leather, -.003);                         // wrapped grip
  piece(new T.CylinderGeometry(.023, .023, .014, 14).rotateX(Math.PI / 2), trim, -.098);      // wheel pommel
  piece(new T.CylinderGeometry(.009, .009, .012, 8).rotateX(Math.PI / 2), steel, -.098);      // peened tang
  return group;
}
const sheathed = sword('SwordSheathed',base.scene.getObjectByName('pelvis'));
const sheathWorld = new T.Matrix4().compose(new T.Vector3(-.16,1.22,-.13),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.PI-.19),new T.Vector3(1,1,1));
sheathed.applyMatrix4(base.scene.getObjectByName('pelvis').matrixWorld.clone().invert().multiply(sheathWorld));
const drawn = sword('SwordDrawn',base.scene.getObjectByName('hand_r'));
drawn.position.set(0,.08,.015); drawn.rotation.x = Math.PI / 2;
let weaponNode = null, weaponBuild = null;
if (weaponId !== 'longsword') {
  const { WEAPON_BUILDS } = await import('./build-weapon.mjs'); weaponBuild = WEAPON_BUILDS[weaponId];
  if (!weaponBuild) throw new Error(`WARRIOR_WEAPON=${weaponId}: no such weapon (scripts/build-weapon.mjs)`);
  sheathed.clear(); drawn.clear(); // the loader still finds SwordSheathed/SwordDrawn; they carry nothing
  weaponNode = await weaponBuild.part({ T, withAoUv, leather, variant: process.env.WEAPON_VARIANT }); // async for a reconstructed part (build-weapon.mjs sourced())
  base.scene.getObjectByName('hand_r').add(weaponNode); weaponNode.position.copy(drawn.position); weaponNode.quaternion.premultiply(drawn.quaternion); // retain the part's authored grip tilt
  if (weaponNode.userData.grip === 'reverse') weaponNode.rotateZ(Math.PI);   // the blade runs back along the forearm (the goblin's reverse-grip hook): the sword's transform turned 180° about its thickness axis — blade reversed AND the edge moved to the other side, so the forehand still leads with the edge
}
// Re-proportion (BUILD.bones): every rest-space geometry in the buckets is moved through its skin weights — for bone b with scale S_b about
// its joint j_b in its rest frame R_b, a vertex v gains w_b·(shift_b + R_b (S_b − I) R_b⁻¹ (v − j_b)), where shift_b is where b's joint
// went because of its ancestors' scaling (and the pelvis drop that puts the feet back on the floor). Then each bone's rest position is
// set to its moved joint and the inverse binds are recomputed, so the deformed mesh IS the new bind pose. Rest rotations are untouched.
const PROPORTION = { drop: 0 };
// The re-proportioning field of a `bones` table on the unscaled rig: per bone its rest joint j, rest frame R, scale S, the shift its joint
// takes from its ancestors' scaling (plus the pelvis drop that keeps the soles on the floor), and field(i, v) = R (S − I) R⁻¹ (v − j).
function proportionField(bones) {
  const bind = i => new T.Matrix4().copy(skeleton.boneInverses[i]).invert();   // rest == bind on this rig (checked: 3e-7 m)
  const joint = skeleton.bones.map((_, i) => new T.Vector3().setFromMatrixPosition(bind(i)));
  const frame = skeleton.bones.map((_, i) => new T.Quaternion().setFromRotationMatrix(bind(i)));
  const S = skeleton.bones.map(b => { const s = bones[b.name]; if (s && s.length !== 3) throw new Error(`bones: ${b.name} needs [x, y, z]`); return new T.Vector3(...(s ?? [1, 1, 1])); });
  for (const name of Object.keys(bones)) boneIndex(name);   // every named bone exists
  const field = (i, v) => v.clone().sub(joint[i]).applyQuaternion(frame[i].clone().invert()).multiply(S[i]).applyQuaternion(frame[i]).add(joint[i]).sub(v);   // R (S − I) R⁻¹ (v − j)
  const shift = skeleton.bones.map(() => new T.Vector3()), order = [];
  const visit = b => { order.push(b); for (const c of b.children) if (c.isBone) visit(c); };
  for (const b of skeleton.bones) if (!b.parent?.isBone) visit(b);
  for (const b of order) { const i = boneIndex(b.name); if (b.parent?.isBone) { const p = boneIndex(b.parent.name); shift[i].copy(shift[p]).add(field(p, joint[i])); } }
  // The feet rose by what the legs lost: everything below the root drops by that, so the soles stay where they were.
  const feet = ['foot_l', 'foot_r'].map(n => shift[boneIndex(n)].y);
  if (Math.abs(feet[0] - feet[1]) > 1e-6) throw new Error(`reproportion: uneven legs ${feet}`);
  const drop = -feet[0];
  for (const b of skeleton.bones) if (b.parent?.isBone) shift[boneIndex(b.name)].y += drop;
  return { joint, frame, S, field, shift, drop };
}
if (BUILD.bones) {
  const { joint, frame, field, shift, drop } = proportionField(BUILD.bones);
  PROPORTION.drop = drop;
  let vertices = 0;
  for (const geometries of parts.values()) for (const g of geometries) {
    const position = g.getAttribute('position'), index = g.getAttribute('skinIndex'), weight = g.getAttribute('skinWeight'), v = new T.Vector3(), d = new T.Vector3();
    for (let k = 0; k < position.count; k++) {
      v.fromBufferAttribute(position, k); d.set(0, 0, 0);
      for (let c = 0; c < 4; c++) { const w = weight.getComponent(k, c); if (!w) continue; const i = index.getComponent(k, c); d.addScaledVector(shift[i], w).addScaledVector(field(i, v), w); }
      position.setXYZ(k, v.x + d.x, v.y + d.y, v.z + d.z); vertices++;
    }
  }
  for (const b of skeleton.bones) if (b.parent?.isBone) { const i = boneIndex(b.name), p = boneIndex(b.parent.name); b.position.copy(joint[i]).add(shift[i]).sub(joint[p]).sub(shift[p]).applyQuaternion(frame[p].clone().invert()); }
  base.scene.updateMatrixWorld(true); skeleton.calculateInverses();
  const top = name => new T.Vector3().setFromMatrixPosition(new T.Matrix4().copy(skeleton.boneInverses[boneIndex(name)]).invert());
  console.log(`  reproportion: ${vertices} vertices; pelvis ${joint[boneIndex('pelvis')].y.toFixed(3)} → ${top('pelvis').y.toFixed(3)} m (drop ${PROPORTION.drop.toFixed(3)}), head joint ${joint[boneIndex('Head')].y.toFixed(3)} → ${top('Head').y.toFixed(3)}, wrist reach ${joint[boneIndex('hand_r')].distanceTo(joint[boneIndex('upperarm_r')]).toFixed(3)} → ${top('hand_r').distanceTo(top('upperarm_r')).toFixed(3)} m, sole ${top('foot_l').y.toFixed(3)} (was ${joint[boneIndex('foot_l')].y.toFixed(3)})`);
}
const LIFT = new T.Vector3(0, PROPORTION.drop, 0);   // authored hand goals below are a man's: the goblin's shoulders sit lower by the drop
for (const [material, geometries] of parts) {
  const slots = [...new Set(geometries.map(g => g.userData.slot))].sort();
  for (const slot of slots) {
    const mesh = new T.SkinnedMesh(mergeVertices(mergeGeometries(geometries.filter(g => g.userData.slot === slot))), material);
    // The first draw of a material keeps the plain material name (the runtime looks up 'Steel'); further slots are suffixed.
    mesh.name = slotOf.has(material) ? `${material.name}.${slot}` : material.name; slotOf.set(material, true);
    mesh.userData.slot = slot; mesh.bind(skeleton, body.bindMatrix); body.parent.add(mesh);
  }
}
if (LOOT) {   // one draw per (opponent, slot, material); nothing else in the file but the rig it binds to
  for (const mesh of [...body.parent.children]) if (mesh.isSkinnedMesh && mesh !== body) {
    const [opponent, slot] = mesh.userData.slot.split(':');
    if (!opponent || !slot) throw new Error(`loot draw without opponent/slot: ${mesh.userData.slot}`);
    mesh.name = `${opponent}.${slot}.${mesh.material.name}`; mesh.userData.opponent = opponent; mesh.userData.slot = slot; mesh.userData.layer = lootLayer.get(`${opponent}:${slot}`);
  }
  for (const name of ['SwordSheathed', 'SwordDrawn']) base.scene.getObjectByName(name)?.removeFromParent();
  base.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });
  base.scene.updateMatrixWorld(true);
  const draws = body.parent.children.filter(m => m.isSkinnedMesh && m !== body);
  // Materials: the runtime takes a loot draw's material from the player by name where he has one (Steel, Leather, Gambeson, Heraldry,
  // Wrap — the same maps his own kit wears), so those ship here as bare palette entries. What he has no material for ships complete:
  // the Dwarf's baked iron, and Bronze with the hero-tone maps from the materials manifest (Ruby and BoneWorn are plain colours).
  const lootMaps = new Map(), lootDir = 'src/assets/source/loot', used = new Set(draws.map(m => m.material.name));
  if (used.has('DwarfIron')) lootMaps.set('DwarfIron', { baseColor: { bytes: await fs.readFile(path.join(lootDir, 'dwarf_iron_color.jpg')), mime: 'image/jpeg' }, metallicRoughness: { bytes: await fs.readFile(path.join(lootDir, 'dwarf_iron_orm.jpg')), mime: 'image/jpeg' }, occlusionTexCoord: 0 });
  const materialsDir = process.env.WARRIOR_MATERIALS || 'src/assets/source/materials', heroManifest = JSON.parse(await fs.readFile(path.join(materialsDir, 'manifest_realistic.json'), 'utf8'));
  for (const name of ['Bronze']) if (used.has(name)) {
    const maps = heroManifest[name], entry = { normalScale: maps.normalScale, occlusionTexCoord: 0 };
    for (const slot of ['baseColor', 'metallicRoughness', 'normal']) if (maps[slot]) entry[slot] = { bytes: await fs.readFile(path.join(materialsDir, maps[slot])), mime: /\.jpe?g$/i.test(maps[slot]) ? 'image/jpeg' : 'image/png' };
    lootMaps.set(name, entry);
  }
  base.scene.scale.set(.9 * BUILD.scale, .97 * BUILD.scale, .97 * BUILD.scale); base.scene.position.y = .025;   // the same scene-root transform warrior.glb ships (below): a loot draw and the hero share one space whichever root it is added under
  base.scene.updateMatrixWorld(true);
  const bytes = finishMaterials(Buffer.from(await new GLTFExporter().parseAsync(base.scene, { binary: true, animations: [], onlyVisible: true })), lootMaps, false);
  await fs.writeFile(output, bytes);
  console.log(`Loot → ${output}: ${bytes.byteLength} bytes; ${draws.length} draws: ${draws.map(m => m.name).join(', ')}`);
  process.exit(0);
}
// Retarget rotation deltas onto the body rest pose; preserve its own bone lengths. A window [t0, t1] of the source can be
// cut out and retimed to a fixed duration, so a library clip can fill a contract clip without changing its length.
const clips = [];
function retargetClip(lib, sourceName, name, { t0 = 0, t1 = Infinity, duration, inPlace = false } = {}) {
  const original = lib.animations.find(a => a.name === sourceName);
  if (!original) throw new Error(`Missing clip ${sourceName}`);
  const end = Math.min(t1, original.duration), scale = duration ? duration / (end - t0) : 1, tracks = [];
  for (const track of original.tracks) {
    const [bone, property] = track.name.split('.'), target = base.scene.getObjectByName(bone), from = lib.scene.getObjectByName(bone);
    if (!target || !from || bone === 'root') continue;
    if (property !== 'quaternion' && !(property === 'position' && bone === 'pelvis')) continue;
    const size = track.getValueSize(), times = [], values = [];
    for (let i = 0; i < track.times.length; i++) {
      if (track.times[i] < t0 - 1e-6 || track.times[i] > end + 1e-6) continue;
      times.push((track.times[i] - t0) * scale); values.push(...track.values.subarray(i * size, (i + 1) * size));
    }
    if (!times.length) continue;
    if (property === 'quaternion') {
      const correction = target.quaternion.clone().multiply(from.quaternion.clone().invert());
      for (let i = 0; i < values.length; i += 4) new T.Quaternion().fromArray(values, i).premultiply(correction).normalize().toArray(values, i);
      tracks.push(new T.QuaternionKeyframeTrack(track.name, times, values));
    } else {
      for (let i = 0; i < values.length; i += 3) for (let c = 0; c < 3; c++) values[i + c] = target.position.getComponent(c) + (inPlace && c !== 1 ? 0 : values[i + c] - from.position.getComponent(c)) * 1.04 * (BUILD.bob ?? 1);   // bob: shorter legs sway the hips less
      tracks.push(new T.VectorKeyframeTrack(track.name, times, values));
    }
  }
  return new T.AnimationClip(name, duration ?? end - t0, tracks).optimize();
}
for (const [sourceName, name] of [['Idle_Loop','Idle'],['Walk_Loop','Walk'],['Jog_Fwd_Loop','Jog'],['Sprint_Loop','Run'],['Sword_Idle','Armed'],['Sword_Attack','Attack'],['Hit_Chest','Hit'],['Death01','Death'],['Roll','Roll']])
  clips.push(retargetClip(library, sourceName, name, { inPlace: name === 'Roll' }));
// Author a short in-place draw on this rig: reach the hilt, lift clear, settle into guard.
const poseMixer = new T.AnimationMixer(base.scene), drawTimes = [0,.20,.32,.50,.70];
const drawPositions = [], drawValues = new Map(skeleton.bones.map(b => [b.name, []]));
function aimBone(bone, child, destination) {
  base.scene.updateMatrixWorld(true);
  const origin = bone.getWorldPosition(new T.Vector3());
  const delta = new T.Quaternion().setFromUnitVectors(child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),destination.clone().sub(origin).normalize());
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(delta).multiply(bone.getWorldQuaternion(new T.Quaternion())));
}
for (let frame=0;frame<drawTimes.length;frame++) {
  const action = poseMixer.clipAction(clips.find(c => c.name === (frame === 4 ? 'Armed' : 'Idle'))).play();
  poseMixer.update(0); base.scene.updateMatrixWorld(true);
  if (frame > 0 && frame < 4) {
    const shoulder=base.scene.getObjectByName('upperarm_r'), elbow=base.scene.getObjectByName('lowerarm_r'), hand=base.scene.getObjectByName('hand_r');
    const target=new T.Vector3(...(frame===1 ? [-.16,1.22,-.13] : frame===2 ? [-.12,1.38,.02] : [-.08,1.65,.24])).add(LIFT);
    const start=shoulder.getWorldPosition(new T.Vector3()), joint=elbow.getWorldPosition(new T.Vector3()), end=hand.getWorldPosition(new T.Vector3());
    const upper=start.distanceTo(joint), lower=joint.distanceTo(end), direction=target.clone().sub(start), distance=Math.min(direction.length(),upper+lower-.001);
    direction.normalize(); const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    const bend=new T.Vector3(0,0,-1).addScaledVector(direction,direction.z).normalize();
    aimBone(shoulder,elbow,start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along))));
    aimBone(elbow,hand,target); base.scene.updateMatrixWorld(true);
    const orientation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),frame===1 ? Math.PI-.19 : .15);
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation).multiply(drawn.quaternion.clone().invert()));
  }
  drawPositions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for (const bone of skeleton.bones) drawValues.get(bone.name).push(...bone.quaternion.toArray());
  action.stop();
}
clips.push(new T.AnimationClip('Draw',.70,[new T.VectorKeyframeTrack('pelvis.position',drawTimes,drawPositions),...skeleton.bones.map(b => new T.QuaternionKeyframeTrack(b.name+'.quaternion',drawTimes,drawValues.get(b.name)))]));
clips.push(clips.splice(clips.findIndex(c => c.name === 'Roll'), 1)[0]);
// Guard: the raise-and-hold of the CC0 UAL2 Sword_Block, retimed into the contract's 1 s. The runtime scrubs it over
// 40 ticks and then holds its last frame, so the clip ends on the settled block.
clips.push(retargetClip(library2, 'Sword_Block', 'Guard', { t0: .05, t1: .60, duration: 1 }));
// Backhand return from the same coherent swing; preserve the contact pose in reverse.
const sourceAttack = clips.find(c => c.name === 'Attack');
const backhand = sourceAttack.clone(); backhand.name = 'Return';
for (const track of backhand.tracks) {
  const times = Array.from(track.times), values = Array.from(track.values), stride = track.getValueSize();
  for (let i = 0; i < times.length; i++) {
    track.times[i] = backhand.duration - times[times.length - 1 - i];
    for (let k = 0; k < stride; k++) track.values[i * stride + k] = values[(times.length - 1 - i) * stride + k];
  }
}
clips.push(backhand);
// Original overhead and thrust on the same rig; offline two-bone reach, no runtime IK dependency.
function reachArm(side, target, leg = false) {
  const upper = base.scene.getObjectByName((leg ? 'thigh_' : 'upperarm_') + side), lower = base.scene.getObjectByName((leg ? 'calf_' : 'lowerarm_') + side), hand = base.scene.getObjectByName((leg ? 'foot_' : 'hand_') + side);
  base.scene.updateMatrixWorld(true);
  const start = upper.getWorldPosition(new T.Vector3()), joint = lower.getWorldPosition(new T.Vector3()), end = hand.getWorldPosition(new T.Vector3());
  const a = start.distanceTo(joint), b = joint.distanceTo(end), direction = target.clone().sub(start);
  const distance = Math.max(.03, Math.min(direction.length(), a + b - .001)); direction.normalize();
  const along = (a*a-b*b+distance*distance)/(2*distance);
  const bend = new T.Vector3(...(leg ? [0,0,1] : [side === 'r' ? 1 : -1,-.5,-.3])); bend.addScaledVector(direction,-bend.dot(direction)).normalize();
  aimBone(upper,lower,start.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along))));
  aimBone(lower,hand,start.clone().addScaledVector(direction,distance));
}
// The cuts are authored the same way (owner, 2026-09-16: the library flick read as "too quick and shallow"): Attack is a horizontal
// right-to-left arc at chest height — cocked out to the right, the tip crossing the front at the contact key (.34), out to the left — and
// Return is the backhand, left to right. Their keys replace the retargeted Sword_Attack and its time-reversed clone below.
for (const [name, sourceKeys] of [
  ['Heavy', [[0,[.18,1.3,.3],[0,0,1]],[.28,[.2,1.65,-.08],[0,1,-.4]],[.48,[.04,1.13,.43],[0,0,1]],[.64,[.28,.98,.35],[.3,-.6,.7]],[1,[.18,1.3,.3],[0,0,1]]]],
  ['Riposte', [[0,[.18,1.3,.3],[0,0,1]],[.2,[.15,1.25,.05],[0,0,1]],[.34,[.02,1.23,.48],[0,0,1]],[.55,[.04,1.2,.48],[0,0,1]],[1,[.18,1.3,.3],[0,0,1]]]],
  // A cut is a hook with a sword (owner, 2026-09-16): a short load from guard on one side (blade lifted, not swung out), one power arc through
  // the front to the other side, a short stop past the target, then a retraction that LIFTS the sword back to guard — never a mirror swing back
  // along the arc (that read as a weave), never behind the shoulder line, never dipping toward the floor. Key phases follow the sim's swing
  // easing: 0–.34 the load, .34 contact in front, .34–.7 the active arc, .7–1 the retraction.
  // One stroke only: the load is a small raise with the blade set a little to the side (the tip moves up more than out), the cut is the one
  // sideways travel (~90° across the front), and the retraction goes straight UP first (tip over the shoulder, azimuth held) and only then
  // over the head to centre, so no second sideways stroke is ever visible.
  // The sword rests at the RIGHT hip in the armed idle (rig x < 0 is the fighter's right). So the first cut (Attack, 'light_right') loads
  // where the sword already is — a small raise on the right — and hooks across to the left; the backhand (Return) loads on the left, where
  // the first cut ended, and hooks back to the right. Both recover with a lift over the head down to a low right guard, next to the idle,
  // so the blend back to idle is short. The only sideways travel the eye sees is the cut itself.
  // Owner (2026-09-16): the cut STOPS at the extended pose (arm out, blade level) and comes back along the same arc to guard — no lift over the
  // head. So after the stop (.7) the keys retrace: mid-arc (.82), the contact pose in front (.92), then the low right guard the swing started from.
  ['Attack', [[0,[-.15,1.1,0],[-.5,.45,.74]],[.16,[-.28,1.34,.28],[-.35,.45,.82]],[.34,[-.02,1.18,.5],[0,0,1]],[.52,[.24,1.2,.44],[.62,0,.78]],[.7,[.46,1.26,.32],[.86,.08,.5]],[.82,[.24,1.2,.44],[.62,0,.78]],[.92,[-.02,1.18,.5],[0,0,1]],[1,[-.15,1.1,0],[-.5,.45,.74]]]],
  ['Return', [[0,[.35,1.2,.25],[.6,.4,.7]],[.16,[.32,1.34,.3],[.32,.42,.85]],[.34,[.25,1.18,.5],[0,0,1]],[.52,[-.14,1.2,.46],[-.62,0,.78]],[.7,[-.4,1.24,.34],[-.86,.08,.5]],[.82,[-.14,1.2,.46],[-.62,0,.78]],[.92,[.25,1.18,.5],[0,0,1]],[1,[-.15,1.1,0],[-.5,.45,.74]]]]
]) {
  const keys = weaponBuild?.keys?.[name] ?? sourceKeys; // a weapon may re-key a sword clip on its own rig (the cleaver's Heavy is a diagonal hack so its edge leads)
  const positions = [], values = new Map(skeleton.bones.map(b => [b.name, []]));
  for (const [phase, position, direction] of keys) {
    poseMixer.clipAction(clips.find(c => c.name === 'Armed')).play(); poseMixer.update(0);
    const turn = Math.sin(phase*Math.PI*2);
    base.scene.getObjectByName('pelvis').rotation.y -= turn*.08;
    base.scene.getObjectByName('spine_01').rotation.y -= turn*.16;
    base.scene.getObjectByName('spine_02').rotation.x += Math.sin(phase*Math.PI)*(name === 'Heavy' ? .10 : .05);
    positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
    const handGoal = new T.Vector3(...position).add(LIFT), bladeDirection = new T.Vector3(...direction).normalize();
    reachArm('r',handGoal); reachArm('l',handGoal.clone().addScaledVector(bladeDirection,-.10).add(new T.Vector3(-.04,0,0)));
    base.scene.updateMatrixWorld(true);
    const hand = base.scene.getObjectByName('hand_r'), orientation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bladeDirection);
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation).multiply(drawn.quaternion.clone().invert()));
    for (const bone of skeleton.bones) values.get(bone.name).push(...bone.quaternion.toArray());
    poseMixer.stopAllAction();
  }
  const authored = new T.AnimationClip(name,1,[new T.VectorKeyframeTrack('pelvis.position',keys.map(k=>k[0]),positions),...skeleton.bones.map(b => new T.QuaternionKeyframeTrack(b.name+'.quaternion',keys.map(k=>k[0]),values.get(b.name)))]);
  const slot = clips.findIndex(c => c.name === name); if (slot >= 0) clips[slot] = authored; else clips.push(authored);
}
// Armed locomotion keeps the sword ready; original lateral steps are authored on the same rig.
const armedWalk=clips.find(c=>c.name==='Walk').clone();armedWalk.name='ArmedWalk';
const armedClip=clips.find(c=>c.name==='Armed');
for(let i=0;i<armedWalk.tracks.length;i++) {
 const track=armedWalk.tracks[i];
 if(/spine|neck|head|clavicle|arm|hand|finger|thumb/.test(track.name)) {
  const rest=armedClip.tracks.find(t=>t.name===track.name);
  if(rest) armedWalk.tracks[i]=new T.QuaternionKeyframeTrack(track.name,[0,armedWalk.duration],[...rest.values.slice(0,4),...rest.values.slice(0,4)]);
 }
}
clips.push(armedWalk);
for(const [name,direction] of [['StrafeLeft',-1],['StrafeRight',1]]) {
 const times=Array.from({length:25},(_,i)=>i/24*.8),positions=[],values=new Map(skeleton.bones.map(b=>[b.name,[]]));
 for(let i=0;i<times.length;i++) {
  poseMixer.clipAction(armedClip).play();poseMixer.update(0);base.scene.updateMatrixWorld(true);
  for(const [side,offset] of [['l',0],['r',.5]]) {
   const foot=base.scene.getObjectByName('foot_'+side),target=foot.getWorldPosition(new T.Vector3()),rotation=foot.getWorldQuaternion(new T.Quaternion());
   const phase=(i/24+offset)%1,stance=phase<.6;
   target.x+=direction*(stance ? .18-.36*phase/.6 : -.18+.36*(phase-.6)/.4);
   if(!stance) target.y+=Math.sin((phase-.6)/.4*Math.PI)*.07;
   reachArm(side,target,true);base.scene.updateMatrixWorld(true);
   foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  }
  positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for(const bone of skeleton.bones)values.get(bone.name).push(...bone.quaternion.toArray());
  poseMixer.stopAllAction();
 }
 clips.push(new T.AnimationClip(name,.8,[new T.VectorKeyframeTrack('pelvis.position',times,positions),...skeleton.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b.name)))]));
}
// Original front kick: planted support foot, chamber, extension, then recover to armed stance.
{
 const times=[0,.18,.34,18/44,.53,.72,1],positions=[],values=new Map(skeleton.bones.map(b=>[b.name,[]]));
 for(const phase of times){
  poseMixer.clipAction(armedClip).play();poseMixer.update(0);base.scene.updateMatrixWorld(true);
  const foot=base.scene.getObjectByName('foot_r'),home=foot.getWorldPosition(new T.Vector3()),orientation=foot.getWorldQuaternion(new T.Quaternion());
  const lift=phase<=18/44 ? Math.min(1,phase/.34) : Math.max(0,(.85-phase)/(.85-18/44));
  const extension=Math.max(0,1-Math.abs(phase-18/44)/.23);
  base.scene.getObjectByName('spine_01').rotation.x-=lift*.14;
  reachArm('r',new T.Vector3(home.x,home.y+lift*.60,home.z+extension*(.88-home.z)),true);base.scene.updateMatrixWorld(true);
  foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-extension*.5)));
  positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for(const bone of skeleton.bones)values.get(bone.name).push(...bone.quaternion.toArray());
  poseMixer.stopAllAction();
 }
 clips.push(new T.AnimationClip('Kick',1,[new T.VectorKeyframeTrack('pelvis.position',times,positions),...skeleton.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b.name)))]));
}
// Original defensive exchanges: absorb a block, sweep a parry, and lose the attacking line.
for(const name of ['BlockImpact','Parry','Deflected']) {
 const times=[0,.12,.35,.65,1],positions=[],values=new Map(skeleton.bones.map(b=>[b.name,[]]));
 for(const phase of times) {
  const source=clips.find(c=>c.name===(name==='Deflected' ? (phase===1 ? 'Armed' : 'Attack') : 'Guard'));
  poseMixer.clipAction(source).play();poseMixer.setTime(name==='Deflected' && phase<1 ? source.duration*.34 : source.name==='Guard' ? source.duration-1e-4 : 0);   // Deflected starts from the cut's contact pose (the authored Attack's contact key is .34)base.scene.updateMatrixWorld(true);
  const wave=Math.sin(Math.PI*phase),hand=base.scene.getObjectByName('hand_r'),goal=hand.getWorldPosition(new T.Vector3()),orientation=hand.getWorldQuaternion(new T.Quaternion());
  const delta=name==='BlockImpact' ? new T.Vector3(.05,0,-.20) : name==='Parry' ? new T.Vector3(-.22,.04,.04) : new T.Vector3(.27,.12,-.10);
  base.scene.getObjectByName('spine_01').rotation.x-=wave*(name==='BlockImpact' ? .07 : .03);
  base.scene.getObjectByName('spine_02').rotation.y+=wave*(name==='Parry' ? -.18 : .12);
  if(phase>0 && phase<1) {
   for(const side of ['r','l']) { const target=base.scene.getObjectByName('hand_'+side).getWorldPosition(new T.Vector3()).addScaledVector(delta,wave);reachArm(side,side==='r' ? goal.clone().addScaledVector(delta,wave) : target); }
   base.scene.updateMatrixWorld(true);
   const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),wave*(name==='Parry' ? -.55 : name==='Deflected' ? .7 : -.08));
   hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(turn).multiply(orientation));
  }
  positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for(const bone of skeleton.bones)values.get(bone.name).push(...bone.quaternion.toArray());
  poseMixer.stopAllAction();
 }
 clips.push(new T.AnimationClip(name,1,[new T.VectorKeyframeTrack('pelvis.position',times,positions),...skeleton.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b.name)))]));
}
// Death_SplitCrown (owner-authorized finishers & gore, 2026-09-17 — additive; the 21 contract clips above stay frozen):
// a heavy overhead into the crown. The skull gives at the impact key, then the body drops STRAIGHT down — the knees fold
// under him, the shins slide back, he ends kneeling and folded forward over his own legs. No backward fall, no bounce.
// 2.4 s = RULES.death (144 ticks), so the dead phase's progress sweeps the clip 1:1 exactly as Death01 does. Authored on
// this rig from measured world references, so the re-proportioned goblin gets his own scale of the same collapse.
{
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const times=[0,.045,.09,.18,.32,.5,.68,.82,1],positions=[],values=new Map(skeleton.bones.map(b=>[b.name,[]]));
 const armed=clips.find(c=>c.name==='Armed');
 poseMixer.clipAction(armed).play();poseMixer.update(0);base.scene.updateMatrixWorld(true);
 const pelvisRest=base.scene.getObjectByName('pelvis').position.clone();   // pelvis local frame: +z is world up (.949 standing), +y is world back
 const footHome={l:base.scene.getObjectByName('foot_l').getWorldPosition(new T.Vector3()),r:base.scene.getObjectByName('foot_r').getWorldPosition(new T.Vector3())};
 const FLOOR=BUILD.floor??0,rest=pelvisRest.z,ratio=rest/.949;   // kneel/fold distances scale with this rig's standing pelvis height
 poseMixer.stopAllAction();
 for(const phase of times){
  poseMixer.clipAction(armed).play();poseMixer.update(0);base.scene.updateMatrixWorld(true);
  const snap=smooth(phase/.09);                    // the skull gives: a fast downward jolt of the head in the first fifth of a second
  const fold=smooth((phase-.09)/.5);               // the torso folds forward over the legs
  const drop=smooth((phase-.06)/.62);              // the straight-down collapse to the knees
  const sink=smooth((phase-.5)/.4);                // the last settle onto the folded legs
  const kneel=smooth((phase-.06)/.5);              // the shins slide back under him
  const pelvis=base.scene.getObjectByName('pelvis');
  pelvis.position.set(pelvisRest.x,pelvisRest.y+kneel*.06*ratio,rest-(drop*.55+sink*.08)*rest);
  pelvis.rotation.x+=fold*.18;
  base.scene.getObjectByName('spine_01').rotation.x+=fold*.34+snap*.06;
  base.scene.getObjectByName('spine_02').rotation.x+=fold*.30;
  base.scene.getObjectByName('neck_01').rotation.x+=snap*.30+fold*.18;
  base.scene.getObjectByName('Head').rotation.x+=snap*.50+fold*.22;
  base.scene.updateMatrixWorld(true);
  for(const side of ['l','r']){
   const home=footHome[side],target=home.clone();
   target.z-=kneel*.30*ratio; target.y=home.y+(Math.max(.05,FLOOR)-home.y)*kneel;   // the top of the foot comes to rest on the floor behind him
   reachArm(side,target,true);
  }
  // The arms go slack: the hands fall from guard to his sides, then flop forward onto the ground ahead of the knees.
  for(const side of ['l','r']){
   const sx=side==='l' ? 1 : -1, hand=base.scene.getObjectByName('hand_'+side), home=hand.getWorldPosition(new T.Vector3());
   const sidePt=new T.Vector3(sx*.24*ratio,rest*.55,.05*ratio);
   const groundPt=new T.Vector3(sx*.17*ratio,Math.max(.1,FLOOR),footHome[side].z+.28*ratio-kneel*.30*ratio);
   const goal=phase<.5 ? home.clone().lerp(sidePt,smooth((phase-.09)/.4)) : sidePt.clone().lerp(groundPt,smooth((phase-.5)/.35));
   reachArm(side,goal);
  }
  base.scene.updateMatrixWorld(true);
  positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for(const bone of skeleton.bones)values.get(bone.name).push(...bone.quaternion.toArray());
  poseMixer.stopAllAction();
 }
 clips.push(new T.AnimationClip('Death_SplitCrown',2.4,[new T.VectorKeyframeTrack('pelvis.position',times,positions),...skeleton.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b.name)))]));
}
// Death_RunThrough (owner-authorized finishers & gore set — Run Through ships 2026-09-18 as rotation finisher #4; additive,
// same contract as Death_SplitCrown): a thrust through the torso. The impact drives him up onto his toes, arched back over
// the blade; a held beat — both hands come up and grip the blade at the chest, a small tremble, the head hanging; then the
// strength goes and the knees fold — and he sinks ONTO the blade, not off it (owner 2026-09-18 revision: "the weapon should
// stay through the body, not pull out — it comes out the other side, and as the opponent drops on his knees the weapon is
// through his stomach"). The torso stays on the blade line in a tall kneel, hands still on it, the head hanging.
// 2.4 s = RULES.death (144 ticks); authored on this rig so every fighter (and scale) gets his own run of the same collapse.
{
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const times=[0,.05,.12,.3,.5,.62,.75,.88,1],positions=[],values=new Map(skeleton.bones.map(b=>[b.name,[]]));
 const armed=clips.find(c=>c.name==='Armed');
 poseMixer.clipAction(armed).play();poseMixer.update(0);base.scene.updateMatrixWorld(true);
 const pelvisRest=base.scene.getObjectByName('pelvis').position.clone();   // pelvis local frame: +z is world up (.949 standing), +y is world back
 const footHome={l:base.scene.getObjectByName('foot_l').getWorldPosition(new T.Vector3()),r:base.scene.getObjectByName('foot_r').getWorldPosition(new T.Vector3())};
 const FLOOR=BUILD.floor??0,rest=pelvisRest.z,ratio=rest/.949;   // kneel/grip distances scale with this rig's standing pelvis height
 poseMixer.stopAllAction();
 for(const phase of times){
  poseMixer.clipAction(armed).play();poseMixer.update(0);base.scene.updateMatrixWorld(true);
  const snap=smooth(phase/.05);                    // the impact: a fast arch back over the blade in the first fifth of a second
  const arch=snap*(1-smooth((phase-.45)/.3));      // held through the beat, released as he sinks onto the blade
  const hang=smooth((phase-.28)/.45);              // the head, forward and heavy, once the first shock passes
  const fold=smooth((phase-.55)/.4);               // a small slump forward onto the blade — the torso stays near-upright
  const drop=smooth((phase-.55)/.55);              // the straight-down sink to a TALL kneel (higher than the Split Crown: the torso must stay on the blade)
  const kneel=smooth((phase-.5)/.5);               // the shins slide back under him
  const grip=smooth((phase-.08)/.2);               // the hands rise to the blade
  const down=smooth((phase-.5)/.4);                // and follow it down as he kneels — they never let go
  const pelvis=base.scene.getObjectByName('pelvis');
  pelvis.position.set(pelvisRest.x,pelvisRest.y+kneel*.06*ratio+arch*.02*ratio-fold*.04*ratio-drop*.08*ratio,rest-drop*.46*rest+arch*.02*ratio);
  pelvis.rotation.x+=fold*.08;
  base.scene.getObjectByName('spine_01').rotation.x+=-arch*.16+fold*.16+(phase>.1&&phase<.5?Math.sin(phase*90)*.012:0);   // the held-beat tremble
  base.scene.getObjectByName('spine_02').rotation.x+=-arch*.12+fold*.14;
  base.scene.getObjectByName('neck_01').rotation.x+=-snap*.10+hang*.16+fold*.10;
  base.scene.getObjectByName('Head').rotation.x+=-snap*.28+hang*.30+fold*.12;
  base.scene.updateMatrixWorld(true);
  for(const side of ['l','r']){
   const home=footHome[side],target=home.clone();
   target.z-=kneel*.30*ratio; target.y=home.y+(Math.max(.05,FLOOR)-home.y)*kneel;   // the top of the foot comes to rest on the floor behind him
   reachArm(side,target,true);
  }
  // The arms: up to grip the blade through the held beat, then DOWN with it as he sinks to the kneel — gripping to the end.
  for(const side of ['l','r']){
   const sx=side==='l'?1:-1,hand=base.scene.getObjectByName('hand_'+side),home=hand.getWorldPosition(new T.Vector3());
   const bladePt=new T.Vector3(sx*.05*ratio,1.18*ratio,.30*ratio);
   const kneelPt=new T.Vector3(sx*.06*ratio,1.0*ratio,.32*ratio);
   const goal=phase<.08?home.clone():bladePt.clone().lerp(kneelPt,down);
   reachArm(side,goal);
  }
  base.scene.updateMatrixWorld(true);
  positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for(const bone of skeleton.bones)values.get(bone.name).push(...bone.quaternion.toArray());
  poseMixer.stopAllAction();
 }
 clips.push(new T.AnimationClip('Death_RunThrough',2.4,[new T.VectorKeyframeTrack('pelvis.position',times,positions),...skeleton.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b.name)))]));
}
// Fin_RunThrough (owner 2026-09-18 revision — the blade STAYS through the body): the KILLER's side of the Run Through
// tableau, additive on the same contract as the Death_* clips; every rig carries it. Derived from this rig's own Riposte
// contact pose (the blade's fullest natural extension — correct grip and arm, nothing hand-tuned), then the whole upper
// body pitches forward so the blade line drops onto the kneeling man's chest and out his back; a slight crouch and a small
// step in sell the drive. Keyed [0,.12,.25,1]: raise from Armed, settle by .25, then HOLD — the scene plays it on the
// finisher clock and freezes it at progress 1 for as long as the corpse kneels.
{
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const times=[0,.12,.25,1],positions=[],values=new Map(skeleton.bones.map(b=>[b.name,[]]));
 const armed=clips.find(c=>c.name==='Armed'),riposte=clips.find(c=>c.name==='Riposte');
 // Off-hand (owner 2026-09-21): the Riposte's contact frame throws the left hand out, fingers spread — a swing follow-through
 // that, frozen for the whole hold, read as a splayed hand turned the wrong way ("giving the middle finger"). The hold is a
 // two-handed drive instead: the left hand closes onto the grip just behind the right — the Armed pose's wrist, and the RIGHT
 // hand's fist mirrored onto the left fingers (the Armed left hand is open; frozen on the hilt it still read as a raised palm).
 const OFF_FINGER=/^(index|middle|ring|pinky|thumb)_0\d_l$/;
 poseMixer.stopAllAction();poseMixer.clipAction(armed).play();poseMixer.update(0);
 const armedWrist=base.scene.getObjectByName('hand_l').quaternion.clone();
 poseMixer.stopAllAction();
 // the Riposte's fullest-extension instant = this rig's natural thrust line
 let hit=0,best=-1e9;
 for(let t=0;t<=riposte.duration;t+=1/60){
  poseMixer.stopAllAction();poseMixer.clipAction(riposte).play();poseMixer.setTime(t);base.scene.updateMatrixWorld(true);
  const z=drawn.localToWorld(new T.Vector3(0,.86,0)).z; if(z>best){best=z;hit=t;}
 }
 poseMixer.stopAllAction();
 for(const phase of times){
  poseMixer.stopAllAction();
  if(phase===0){ poseMixer.clipAction(armed).play();poseMixer.update(0); }
  else {
   poseMixer.clipAction(riposte).play();poseMixer.setTime(hit);
   const settle=smooth((phase-.12)/.13);   // the full hold pose by .25
   base.scene.getObjectByName('spine_01').rotation.x+=.24*settle;
   base.scene.getObjectByName('spine_02').rotation.x+=.12*settle;
   const pelvis=base.scene.getObjectByName('pelvis');
   pelvis.position.y-=.12*settle;           // pelvis local +y is world back: a full lunge shift INTO the drive, the line stays at chest height
   base.scene.getObjectByName('Head').rotation.x-=.10*settle;   // eyes up on the victim
   reachArm('r',new T.Vector3(0,1.04,.69));   // extend the drive along the arm's own line (near-full extension) — carries the tip out the far side at close kills
   base.scene.getObjectByName('hand_l').quaternion.copy(armedWrist);
   for(const bone of skeleton.bones)if(OFF_FINGER.test(bone.name)){const q=base.scene.getObjectByName(bone.name.replace(/_l$/,'_r')).quaternion;bone.quaternion.set(q.x,-q.y,-q.z,q.w);}   // mirrored finger bones: the same curl is (x,-y,-z,w)
   base.scene.updateMatrixWorld(true);
   const grip=base.scene.getObjectByName('hand_r').getWorldPosition(new T.Vector3());
   const pommelward=drawn.localToWorld(new T.Vector3(0,-1,0)).sub(drawn.localToWorld(new T.Vector3(0,0,0))).normalize();   // down the hilt, away from the tip
   reachArm('l',grip.addScaledVector(pommelward,.07));   // the second hand on the grip, a hand's width behind the first
  }
  base.scene.updateMatrixWorld(true);
  if(phase===1){ const from=drawn.localToWorld(new T.Vector3(0,.12,0)),to=drawn.localToWorld(new T.Vector3(0,.86,0)); console.log(`  Fin_RunThrough blade line: [${from.x.toFixed(2)}, ${from.y.toFixed(2)}, ${from.z.toFixed(2)}] -> [${to.x.toFixed(2)}, ${to.y.toFixed(2)}, ${to.z.toFixed(2)}]`); }
  positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
  for(const bone of skeleton.bones)values.get(bone.name).push(...bone.quaternion.toArray());
  poseMixer.stopAllAction();
 }
 clips.push(new T.AnimationClip('Fin_RunThrough',2.4,[new T.VectorKeyframeTrack('pelvis.position',times,positions),...skeleton.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b.name)))]));
}
// GAMEPLAY CHANGE candidates (opt-in, combat review decides): strikes from UAL2 replace the authored attacks. Each candidate
// joins a strike with its recovery, finds the blade's most-forward instant, and retimes piecewise so that instant lands on
// the contract's contact fraction at the contract's duration. Moves the blade during contact → re-bake, tests, review.
if (process.env.WARRIOR_UAL2_ATTACKS) {
  const strike = (name, sources, duration, keyFraction) => {
    const joined = new Map(); let offset = 0;
    for (const [lib, src] of sources) {
      const clip = retargetClip(lib, src, src);
      for (const track of clip.tracks) {
        const size = track.getValueSize(), entry = joined.get(track.name) ?? { times: [], values: [], size, Track: track.constructor };
        for (let i = 0; i < track.times.length; i++) { entry.times.push(track.times[i] + offset); entry.values.push(...track.values.subarray(i * size, (i + 1) * size)); }
        joined.set(track.name, entry);
      }
      offset += clip.duration;
    }
    const clip = new T.AnimationClip(name, offset, [...joined].map(([n, e]) => new e.Track(n, e.times, e.values)));
    const mixer = new T.AnimationMixer(base.scene), action = mixer.clipAction(clip).play(); let hit = 0, best = -Infinity;
    for (let t = 0; t <= offset; t += 1 / 120) { mixer.setTime(t); base.scene.updateMatrixWorld(true); const z = drawn.localToWorld(new T.Vector3(0, .86, 0)).z; if (z > best) { best = z; hit = t; } }
    action.stop(); mixer.uncacheClip(clip);
    const key = keyFraction * duration, map = t => t <= hit ? t / hit * key : key + (t - hit) / (offset - hit) * (duration - key);
    for (const track of clip.tracks) track.times = new Float32Array(Array.from(track.times, map));
    clip.duration = duration; console.log(`  candidate ${name}: ${sources.map(x => x[1]).join('+')} hit at ${hit.toFixed(2)}s (tip z ${best.toFixed(2)}) → key ${key.toFixed(3)}s of ${duration}s`);
    return clip;
  };
  // WARRIOR_UAL2_ATTACKS=lights takes only the cuts (the authored Heavy and Riposte stay: the owner likes them); any other value takes all four.
  const candidates = [
    strike('Attack', [[library2, 'Sword_Regular_A'], [library2, 'Sword_Regular_A_Rec']], 1.533, 18 / 66),
    strike('Return', [[library2, 'Sword_Regular_B'], [library2, 'Sword_Regular_B_Rec']], 1.533, 1 - 18 / 66),
    ...(process.env.WARRIOR_UAL2_ATTACKS === 'lights' ? [] : [strike('Heavy', [[library2, 'Sword_Regular_C']], 1, .48), strike('Riposte', [[library2, 'Sword_Dash']], 1, .34)]),
  ];
  for (const c of candidates) clips[clips.findIndex(k => k.name === c.name)] = c;
}
if (weaponBuild?.clips) { // the weapon's own clips, authored on this rig after every sword clip exists (they borrow the body loops and the two-hand grip)
  const fresh = weaponBuild.clips({ T, base, skeleton, poseMixer, clips, reachArm, weapon: weaponNode });
  clips.push(...fresh);
  if (process.env.GRIP_DEBUG) for (const clip of fresh) { // playback audit: does the recorded clip reproduce the authored grip in-process?
    const mixer = new T.AnimationMixer(base.scene), action = mixer.clipAction(clip).play();
    let row = '', max = 0;
    for (let i = 0; i <= 24; i++) {
      mixer.setTime(i / 24 * clip.duration * .9999); base.scene.updateMatrixWorld(true);
      const a = weaponNode.localToWorld(new T.Vector3(0, -1.1, 0)), b = weaponNode.localToWorld(new T.Vector3(0, 1.8, 0));
      const ab = b.clone().sub(a), hp = base.scene.getObjectByName('hand_l').getWorldPosition(new T.Vector3());
      const tt = Math.max(0, Math.min(1, hp.clone().sub(a).dot(ab) / ab.lengthSq()));
      const d = hp.distanceTo(a.clone().addScaledVector(ab, tt));
      max = Math.max(max, d); row += d < .09 ? '.' : d < .16 ? 'o' : '#';
    }
    console.log('PLAYBACKDBG', clip.name.padEnd(20), row, ' max', max.toFixed(3));
    action.stop(); mixer.uncacheClip(clip);
  }
}
// The hunch: for each named bone, its rest-pose sideways axis in its own frame; every quaternion key of every clip is post-rotated about it.
if (BUILD.hunch.length) {
  // Rest-pose frames come from the bind matrices (the exported node transforms are left exactly as the hero build leaves them).
  const bind = name => new T.Matrix4().copy(skeleton.boneInverses[boneIndex(name)]).invert();
  const facing = new T.Vector3().subVectors(new T.Vector3().setFromMatrixPosition(bind('ball_l')), new T.Vector3().setFromMatrixPosition(bind('foot_l'))).setY(0).normalize();
  const sideways = new T.Vector3(0, 1, 0).cross(facing).normalize();   // bending forward = rotating about the fighter's left-right axis
  for (const [name, degrees] of BUILD.hunch) {
    if (!skeleton.bones.some(x => x.name === name)) throw new Error(`hunch: no bone ${name}`);
    const local = sideways.clone().applyQuaternion(new T.Quaternion().setFromRotationMatrix(bind(name)).invert()).normalize();
    const delta = new T.Quaternion().setFromAxisAngle(local, degrees * Math.PI / 180), q = new T.Quaternion();
    let keys = 0;
    for (const clip of clips) for (const track of clip.tracks) if (track.name === `${name}.quaternion`) for (let i = 0; i < track.values.length; i += 4) { q.fromArray(track.values, i).multiply(delta); q.toArray(track.values, i); keys++; }
    console.log(`  hunch ${name} ${degrees}° over ${keys} keys`);
  }
}
// Ground clamp (BUILD.floor, the re-proportioned man only): longer arms on lower shoulders plant the rolling goblin's hands through the floor
// (the hero's clear it by 18 cm). The Roll is sampled at 30 Hz; wherever a wrist would be below `floor` (rig metres) the arm is re-solved with
// the same two-bone reach to that point lifted onto the floor, and only the four arm bones' tracks are rewritten. Nothing else in the clip moves.
if (BUILD.floor) for (const name of ['Roll']) {
  const clip = clips.find(c => c.name === name), times = Array.from({ length: Math.round(clip.duration * 30) + 1 }, (_, i) => Math.min(clip.duration, i / 30));
  const arms = ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r'], values = new Map(arms.map(b => [b, []]));
  let clamped = 0, lowest = 9;
  const action = poseMixer.clipAction(clip); action.play();
  for (const t of times) {
    poseMixer.setTime(t); base.scene.updateMatrixWorld(true);
    for (const side of ['l', 'r']) { const p = base.scene.getObjectByName('hand_' + side).getWorldPosition(new T.Vector3()); lowest = Math.min(lowest, p.y); if (p.y < BUILD.floor) { reachArm(side, p.setY(BUILD.floor)); clamped++; } }
    base.scene.updateMatrixWorld(true);
    for (const b of arms) values.get(b).push(...base.scene.getObjectByName(b).quaternion.toArray());
  }
  poseMixer.stopAllAction();
  clip.tracks = [...clip.tracks.filter(tr => !arms.some(b => tr.name === `${b}.quaternion`)), ...arms.map(b => new T.QuaternionKeyframeTrack(`${b}.quaternion`, times, values.get(b)))];
  console.log(`  floor ${name}: ${clamped} wrist samples lifted to ${BUILD.floor} m (lowest was ${lowest.toFixed(3)})`);
}
base.scene.name='Ashcourt warrior';
if (BUILD.stride) base.scene.userData.stride = BUILD.stride;   // his walk cycle covers this much of a man's stride: the runtime plays it faster to match the sim's travel (no clip change)
base.scene.scale.set(.9 * BUILD.scale, .97 * BUILD.scale, .97 * BUILD.scale); base.scene.position.y=.025;
base.scene.updateMatrixWorld(true);
clips.push(quietOneClip(base.scene, clips));
const result=await new GLTFExporter().parseAsync(base.scene,{binary:true,animations:clips,onlyVisible:true});
await fs.mkdir('src/assets',{recursive:true});
// Authored material maps (scripts/character): src/assets/source/materials/manifest.json maps a material name to
// { baseColor, metallicRoughness, normal, normalScale } image files in that directory. Listed materials replace the
// procedural maps below; unlisted ones keep them. No manifest → identical output.
const materialsDir = process.env.WARRIOR_MATERIALS || 'src/assets/source/materials';
const manifest = JSON.parse(await fs.readFile(path.join(materialsDir, variant ? `manifest_${variant}.json` : 'manifest.json'), 'utf8').catch(() => '{}'));
const authored = new Map(), files = new Map(); // one object per file so a map shared by several materials is embedded once
for (const [name, maps] of Object.entries(manifest)) {
  const entry = { normalScale: maps.normalScale, occlusionTexCoord: maps.occlusionTexCoord ?? 0 };
  for (const slot of ['baseColor', 'metallicRoughness', 'normal', 'occlusion']) if (maps[slot]) {
    const hi = maps[slot].replace(/\.(jpe?g|png)$/i, '@2k.$1'), file = process.env.WARRIOR_TEXTURES === '2k' && await fs.stat(path.join(materialsDir, hi)).then(() => true, () => false) ? hi : maps[slot];
    if (!files.has(maps[slot])) files.set(maps[slot], { bytes: await fs.readFile(path.join(materialsDir, file)), mime: /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png' });
    entry[slot] = files.get(maps[slot]);
  }
  authored.set(name, entry);
}
const textures = path.join(source, 'base/Universal Base Characters[Standard]/Base Characters/Textures');
if (!realistic) authored.set('Eyes', { baseColor: { bytes: await fs.readFile(path.join(textures, 'T_Eye_Brown.png')), mime: 'image/png' }, normal: { bytes: await fs.readFile(path.join(textures, 'T_Eye_Normal.png')), mime: 'image/png' } });
for (const [name, maps] of Object.entries(weaponNode?.maps ?? longswordPart?.maps ?? {})) authored.set(name, { ...maps, occlusionTexCoord: 0 }); // a reconstructed weapon's own maps, by material name
let finished = finishMaterials(Buffer.from(result), authored);
if (fighter === 'veteran') {
  finished = fitVeteranNeck(finished).glb;
  if (weaponId === 'trident') finished = textureVeteranTrident(finished);
}
await fs.writeFile(output, finished);
console.log(`${fighter === 'hero' ? 'Warrior' : fighter} → ${output}: ${finished.byteLength} bytes; ${clips.map(a=>a.name).join(', ')}`);

// Original seamless surface maps, baked into the GLB. Deterministic; no external image service.
function png(width, height, pixel) {
  function chunk(type, data) {
    const name=Buffer.from(type), bytes=Buffer.concat([name,data]); let crc=0xffffffff;
    for(const byte of bytes) { crc^=byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);bytes.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;
  }
  const raw=Buffer.alloc(height*(width*4+1));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const rgba=pixel(x,y);for(let c=0;c<4;c++)raw[y*(width*4+1)+1+x*4+c]=rgba[c]??255;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function finishMaterials(glb, authored = new Map(), procedural = true) {   // procedural=false (loot.glb): palette materials carry no maps — the runtime takes the player's by name
  const length=glb.readUInt32LE(12), j=JSON.parse(glb.subarray(20,20+length).toString());
  const chunks=[glb.subarray(28+length)]; let offset=chunks[0].length;
  j.images=[];j.textures=[];j.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
  function image(bytes, mimeType) {
    const padding=Buffer.alloc((4-bytes.length%4)%4);
    j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});offset+=bytes.length+padding.length;chunks.push(bytes,padding);
    j.images.push({bufferView:j.bufferViews.length-1,mimeType});j.textures.push({source:j.images.length-1,sampler:0});return j.textures.length-1;
  }
  const texture=pixel=>procedural?image(png(256,256,pixel),'image/png'):null;
  const noise=(x,y)=>((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%97/97;
  const metal=texture((x,y)=>{const wear=noise(x,y)*13+Math.sin(y*1.7)*3;return [218+wear,222+wear,224+wear,255]});
  const rough=texture((x,y)=>[255,125+noise(x,y)*40,255,255]);
  // Linen: two fine thread directions, low contrast, with dirt in the low-frequency noise.
  const linen=texture((x,y)=>{const thread=(x%2?3:-3)+(y%2?3:-3), dirt=(noise(x>>4,y>>4)+noise(x>>5,y>>5))*22;const v=168+thread+noise(x,y)*9-dirt;return [v,v-2,v-6,255]});
  const grain=texture((x,y)=>[126+noise(x,y)*4,126+noise(y,x)*4,255,255]);
  const hide=texture((x,y)=>{const pore=noise(x,y)*18, blotch=(noise(x>>3,y>>3)+noise(x>>5,y>>5))*30;const v=150+pore-blotch;return [v,v*.86,v*.72,255]});
  const hideNormal=texture((x,y)=>[122+noise(x,y)*12,122+noise(y,x)*12,255,255]);
  for(const m of j.materials) {
    const p=m.pbrMetallicRoughness, a=authored.get(m.name) ?? {};
    // Authored slots own their channel outright; anything not authored keeps the procedural map below.
    if(a.baseColor) {p.baseColorTexture={index:image(a.baseColor.bytes,a.baseColor.mime)};if(m.name!=='Heraldry'&&!(m.name==='Bronze'&&appearance.matteIron))p.baseColorFactor=[1,1,1,1];} // Heraldry keeps its dye as the factor: the map is undyed leather and the runtime recolours the opponent's; the Executioner's Bronze keeps its blackened-iron factor over the bronze map
    if(a.metallicRoughness) {p.metallicRoughnessTexture={index:image(a.metallicRoughness.bytes,a.metallicRoughness.mime)};p.metallicFactor=1;p.roughnessFactor=1;}
    if(a.normal) m.normalTexture={index:image(a.normal.bytes,a.normal.mime),scale:a.normalScale ?? 1};
    if(a.occlusion) {a.occlusion.index ??= image(a.occlusion.bytes,a.occlusion.mime); m.occlusionTexture={index:a.occlusion.index,texCoord:a.occlusionTexCoord,strength:1};} // one shared image across materials
    if(procedural&&m.name==='Blade') {p.metallicRoughnessTexture={index:rough};p.roughnessFactor=.7;m.normalTexture={index:grain,scale:.15};}
    if(procedural&&m.name==='Steel') {if(!a.baseColor)p.baseColorTexture={index:metal};if(!a.metallicRoughness){p.metallicRoughnessTexture={index:rough};p.roughnessFactor=1;}if(!a.normal)m.normalTexture={index:grain,scale:.3};}
    if(procedural&&(m.name==='Gambeson'||m.name==='Heraldry')) {if(!a.baseColor)p.baseColorTexture={index:linen};if(!a.normal)m.normalTexture={index:grain,scale:.5};}
    if(procedural&&m.name==='Leather') {if(!a.baseColor)p.baseColorTexture={index:hide};if(!a.normal)m.normalTexture={index:hideNormal,scale:.6};}
    // The Executioner's blackened iron (owner, v3 review: the mask and greaves read darker and shinier than the hood — fake):
    // drop the ORM map for scalar matte factors; with metalness down the diffuse returns and they read as charcoal iron beside the hood's cloth.
    if(appearance.matteIron&&(m.name==='Steel'||m.name==='Bronze')) {delete p.metallicRoughnessTexture;p.metallicFactor=0.45;p.roughnessFactor=0.88;}
  }
  j.buffers[0].byteLength=offset;
  const text=Buffer.from(JSON.stringify(j)), padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]), bin=Buffer.concat(chunks);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,padded,bh,bin]);
}

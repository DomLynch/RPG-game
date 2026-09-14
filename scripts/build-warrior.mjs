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
const realistic = process.env.WARRIOR_BODY === 'realistic'; // Blender Studio body instead of the CC0 stylised one
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
const steel = new T.MeshStandardMaterial({ name: 'Steel', color: '#767a7c', metalness: 0.85, roughness: 0.55 }); // iron, not chrome
const trim = new T.MeshStandardMaterial({ name: 'Antique brass', color: '#8a6a3c', metalness: 0.85, roughness: 0.5 }); // worn bronze furniture
const blade = new T.MeshStandardMaterial({ name: 'Blade', color: '#c3c7ca', metalness: 0.9, roughness: 0.3 });
const leather = new T.MeshStandardMaterial({ name: 'Leather', color: '#4a3527', roughness: 0.8 });
const heraldry = new T.MeshStandardMaterial({ name: 'Heraldry', color: '#6b1a1e', roughness: 0.92, side: T.DoubleSide }); // dyed cloth; the runtime recolours the opponent's
// The universal humanoid: the whole CC0 body with its own face, eyes and eyebrows. Skin maps come from the manifest.
const skin = new T.MeshStandardMaterial({ name: 'Skin', roughness: 1 });
body.material = skin;
for (const mesh of [body, base.scene.getObjectByName('Eyes')]) { mesh.geometry.morphAttributes = {}; mesh.morphTargetInfluences = []; mesh.morphTargetDictionary = {}; }
base.scene.getObjectByName('Eyes').material = new T.MeshStandardMaterial({ name: 'Eyes', roughness: .35 });
const hair = new T.MeshStandardMaterial({ name: 'Hair', color: '#2b211b', roughness: .88 });
const ranger = new T.MeshStandardMaterial({ name: 'Ranger', roughness: 1 }); // CC0 outfit-pack items; maps from the manifest
const bronze = new T.MeshStandardMaterial({ name: 'Bronze', roughness: 1, metalness: 1 });
const eyesMaterial = new T.MeshPhysicalMaterial({ name: 'Eyes', roughness: .3, clearcoat: .5, clearcoatRoughness: .18 }); // wet cornea, soft highlight; roughness from the map
// Realistic head: its own texture tile with skin-strength specular (KHR_materials_specular), and strand cards for hair,
// brows and lashes as an alpha cut-out (no sorting, works in the shadow pass).
const face = new T.MeshPhysicalMaterial({ name: 'Face', roughness: 1, specularIntensity: 0.5 });
const hairCards = new T.MeshPhysicalMaterial({ name: 'HairCards', roughness: .9, specularIntensity: .3, alphaTest: .35, side: T.DoubleSide }); // 0.35: loose strands survive mip averaging
const browCards = new T.MeshPhysicalMaterial({ name: 'BrowCards', roughness: .9, specularIntensity: .3, transparent: true, alphaTest: .04, side: T.DoubleSide }); // small cards over opaque skin: blended, so hair tips stay soft
const hairShell = new T.MeshPhysicalMaterial({ name: 'HairShell', roughness: .9, specularIntensity: .25, alphaTest: .42, side: T.DoubleSide, vertexColors: true }); // fur shells: dot alpha × per-shell vertex alpha
// Photogrammetry head (KeenTools reconstruction of the owner's portraits): its own textures, skin specular, wet eyes.
const photo = new T.MeshPhysicalMaterial({ name: 'Photo', roughness: .62, specularIntensity: .5 });
const photoEyes = new T.MeshPhysicalMaterial({ name: 'PhotoEyes', roughness: .2, clearcoat: .6, clearcoatRoughness: .15 });
const photoTeeth = new T.MeshStandardMaterial({ name: 'PhotoTeeth', roughness: .4 });
const parts = new Map([steel, trim, leather, heraldry, cloth, hair, ranger, bronze, skin, eyesMaterial, face, hairCards, browCards, hairShell, photo, photoEyes, photoTeeth].map(m => [m, []]));
const boneIndex = name => {
  const index = skeleton.bones.findIndex(b => b.name === name);
  if (index < 0) throw new Error(`Missing attachment bone ${name}`);
  return index;
};
// Rigid plate pieces become one skinned draw per material, not dozens of moving meshes.
// Equipment slots: authored parts declare extras.slot; each (slot, material) pair becomes its own skinned draw so a slot
// can be shown, hidden or swapped without touching the others. Built-in pieces (hair, scabbard) sit in the '' slot.
const slotOf = new Map();
function add(g, material, bone, x = 0, y = 0, z = 0, rotation = 0, slot = '') {
  if (g.index) g = g.toNonIndexed();
  g.userData.slot = slot;
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
const partFiles = (await fs.readdir(partsDir).catch(() => [])).filter(f => f.endsWith('.glb') && (realistic ? f !== 'level1.glb' : !f.includes('realistic'))).sort();
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
for (const item of (process.env.WARRIOR_ITEMS || '').split(',').filter(Boolean)) {
  const glb = await fs.readFile(`src/assets/source/items/${item}.glb`), asset = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
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
// Sheathed straight sword on the hip; its visible guard establishes the neutral longsword.
// Geometry is baked in bind space, with the scabbard angled away from the leg.
// Leather scabbard with a bronze throat and chape, the same size and angle as the old plank so the sheathed sword fits.
add(bladeGeometry(-.33, .33, .06, .026, .12).rotateZ(Math.PI), leather, 'pelvis', -.24, .79, -.13, -.19);
add(new T.CylinderGeometry(.031, .031, .03, 12), trim, 'pelvis', -.24, .79 + .30, -.13, -.19);
add(new T.TorusGeometry(.036, .007, 6, 18).rotateX(Math.PI / 2), leather, 'pelvis', -.24, .79 + .26, -.13, -.19); // belt loop holding the scabbard
add(new T.CylinderGeometry(.008, .016, .05, 10), trim, 'pelvis', -.24, .79 - .30, -.13, -.19);
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
function sword(name, parent) {
  const group = new T.Group(); group.name = name; parent.add(group);
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
for (const [material, geometries] of parts) {
  const slots = [...new Set(geometries.map(g => g.userData.slot))].sort();
  for (const slot of slots) {
    const mesh = new T.SkinnedMesh(mergeVertices(mergeGeometries(geometries.filter(g => g.userData.slot === slot))), material);
    // The first draw of a material keeps the plain material name (the runtime looks up 'Steel'); further slots are suffixed.
    mesh.name = slotOf.has(material) ? `${material.name}.${slot}` : material.name; slotOf.set(material, true);
    mesh.userData.slot = slot; mesh.bind(skeleton, body.bindMatrix); body.parent.add(mesh);
  }
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
      for (let i = 0; i < values.length; i += 3) for (let c = 0; c < 3; c++) values[i + c] = target.position.getComponent(c) + (inPlace && c !== 1 ? 0 : values[i + c] - from.position.getComponent(c)) * 1.04;
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
    const target=new T.Vector3(...(frame===1 ? [-.16,1.22,-.13] : frame===2 ? [-.12,1.38,.02] : [-.08,1.65,.24]));
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
for (const [name, keys] of [
  ['Heavy', [[0,[.18,1.3,.3],[0,0,1]],[.28,[.2,1.65,-.08],[0,1,-.4]],[.48,[.04,1.13,.43],[0,0,1]],[.64,[.28,.98,.35],[.3,-.6,.7]],[1,[.18,1.3,.3],[0,0,1]]]],
  ['Riposte', [[0,[.18,1.3,.3],[0,0,1]],[.2,[.15,1.25,.05],[0,0,1]],[.34,[.02,1.23,.48],[0,0,1]],[.55,[.04,1.2,.48],[0,0,1]],[1,[.18,1.3,.3],[0,0,1]]]]
]) {
  const positions = [], values = new Map(skeleton.bones.map(b => [b.name, []]));
  for (const [phase, position, direction] of keys) {
    poseMixer.clipAction(clips.find(c => c.name === 'Armed')).play(); poseMixer.update(0);
    const turn = Math.sin(phase*Math.PI*2);
    base.scene.getObjectByName('pelvis').rotation.y -= turn*.08;
    base.scene.getObjectByName('spine_01').rotation.y -= turn*.16;
    base.scene.getObjectByName('spine_02').rotation.x += Math.sin(phase*Math.PI)*(name === 'Heavy' ? .10 : .05);
    positions.push(...base.scene.getObjectByName('pelvis').position.toArray());
    const handGoal = new T.Vector3(...position), bladeDirection = new T.Vector3(...direction).normalize();
    reachArm('r',handGoal); reachArm('l',handGoal.clone().addScaledVector(bladeDirection,-.10).add(new T.Vector3(-.04,0,0)));
    base.scene.updateMatrixWorld(true);
    const hand = base.scene.getObjectByName('hand_r'), orientation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bladeDirection);
    hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation).multiply(drawn.quaternion.clone().invert()));
    for (const bone of skeleton.bones) values.get(bone.name).push(...bone.quaternion.toArray());
    poseMixer.stopAllAction();
  }
  clips.push(new T.AnimationClip(name,1,[new T.VectorKeyframeTrack('pelvis.position',keys.map(k=>k[0]),positions),...skeleton.bones.map(b => new T.QuaternionKeyframeTrack(b.name+'.quaternion',keys.map(k=>k[0]),values.get(b.name)))]));
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
  poseMixer.clipAction(source).play();poseMixer.setTime(name==='Deflected' && phase<1 ? source.duration*18/66 : source.name==='Guard' ? source.duration-1e-4 : 0);base.scene.updateMatrixWorld(true);
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
  const candidates = [
    strike('Attack', [[library2, 'Sword_Regular_A'], [library2, 'Sword_Regular_A_Rec']], 1.533, 18 / 66),
    strike('Return', [[library2, 'Sword_Regular_B'], [library2, 'Sword_Regular_B_Rec']], 1.533, 1 - 18 / 66),
    strike('Heavy', [[library2, 'Sword_Regular_C']], 1, .48),
    strike('Riposte', [[library2, 'Sword_Dash']], 1, .34),
  ];
  for (const c of candidates) clips[clips.findIndex(k => k.name === c.name)] = c;
}
base.scene.name='Ashcourt warrior';
base.scene.scale.set(.9,.97,.97); base.scene.position.y=.025;
base.scene.updateMatrixWorld(true);
const result=await new GLTFExporter().parseAsync(base.scene,{binary:true,animations:clips,onlyVisible:true});
await fs.mkdir('src/assets',{recursive:true});
// Authored material maps (scripts/character): src/assets/source/materials/manifest.json maps a material name to
// { baseColor, metallicRoughness, normal, normalScale } image files in that directory. Listed materials replace the
// procedural maps below; unlisted ones keep them. No manifest → identical output.
const materialsDir = process.env.WARRIOR_MATERIALS || 'src/assets/source/materials';
const manifest = JSON.parse(await fs.readFile(path.join(materialsDir, realistic ? 'manifest_realistic.json' : 'manifest.json'), 'utf8').catch(() => '{}'));
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
const finished = finishMaterials(Buffer.from(result), authored);
await fs.writeFile('src/assets/warrior.glb', finished);
console.log(`Warrior: ${finished.byteLength} bytes; ${clips.map(a=>a.name).join(', ')}`);

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
function finishMaterials(glb, authored = new Map()) {
  const length=glb.readUInt32LE(12), j=JSON.parse(glb.subarray(20,20+length).toString());
  const chunks=[glb.subarray(28+length)]; let offset=chunks[0].length;
  j.images=[];j.textures=[];j.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
  function image(bytes, mimeType) {
    const padding=Buffer.alloc((4-bytes.length%4)%4);
    j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});offset+=bytes.length+padding.length;chunks.push(bytes,padding);
    j.images.push({bufferView:j.bufferViews.length-1,mimeType});j.textures.push({source:j.images.length-1,sampler:0});return j.textures.length-1;
  }
  const texture=pixel=>image(png(256,256,pixel),'image/png');
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
    if(a.baseColor) {p.baseColorTexture={index:image(a.baseColor.bytes,a.baseColor.mime)};p.baseColorFactor=[1,1,1,1];}
    if(a.metallicRoughness) {p.metallicRoughnessTexture={index:image(a.metallicRoughness.bytes,a.metallicRoughness.mime)};p.metallicFactor=1;p.roughnessFactor=1;}
    if(a.normal) m.normalTexture={index:image(a.normal.bytes,a.normal.mime),scale:a.normalScale ?? 1};
    if(a.occlusion) {a.occlusion.index ??= image(a.occlusion.bytes,a.occlusion.mime); m.occlusionTexture={index:a.occlusion.index,texCoord:a.occlusionTexCoord,strength:1};} // one shared image across materials
    if(m.name==='Blade') {p.metallicRoughnessTexture={index:rough};p.roughnessFactor=.7;m.normalTexture={index:grain,scale:.15};}
    if(m.name==='Steel') {if(!a.baseColor)p.baseColorTexture={index:metal};if(!a.metallicRoughness){p.metallicRoughnessTexture={index:rough};p.roughnessFactor=1;}if(!a.normal)m.normalTexture={index:grain,scale:.3};}
    if(m.name==='Gambeson'||m.name==='Heraldry') {if(!a.baseColor)p.baseColorTexture={index:linen};if(!a.normal)m.normalTexture={index:grain,scale:.5};}
    if(m.name==='Leather') {if(!a.baseColor)p.baseColorTexture={index:hide};if(!a.normal)m.normalTexture={index:hideNormal,scale:.6};}
  }
  j.buffers[0].byteLength=offset;
  const text=Buffer.from(JSON.stringify(j)), padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]), bin=Buffer.concat(chunks);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,padded,bh,bin]);
}

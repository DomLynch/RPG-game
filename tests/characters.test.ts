import test from 'node:test';
import {finisherSidePose} from '../src/scene.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Box3, Vector3, PerspectiveCamera, SkinnedMesh, Mesh, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { SWORD, ATTACKS, initialPractice } from '../src/combat.ts';
import { OPPONENTS, PATHS, WEAPONS, total, type WeaponId } from '../src/moves.ts';
import { bladePaths } from '../src/blade-paths.ts';
import { CLIPS, COMBAT_CLIPS, FINISHER_CLIPS, ROLES, WEAPON_CLIPS, clipFor, buildWarriors, gaitWeights, swingProgress, defenceReaction, type Role } from '../src/characters.ts';

test('gaits blend continuously, stay normalized and settle to idle at rest', () => {
  for (const speed of [NaN, Infinity, -1, 0, .1, .8, 1.7, 2.9, 3, 4, 5.2, 100]) {
    const weights = gaitWeights(speed);
    assert.equal(weights.length, CLIPS.length);
    assert.ok(weights.every(w => w >= 0 && w <= 1));
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-8);
  }
  assert.deepEqual(gaitWeights(0), [1, 0, 0, 0]);
  assert.deepEqual(gaitWeights(3), [0, 0, 1, 0]);
  for (const speed of [1.7, 3, 5.2]) {
    const before = gaitWeights(speed - .001), after = gaitWeights(speed + .001);
    assert.ok(before.every((w, i) => Math.abs(w - after[i]) < .003));
  }
});

// Parse the shipped geometry/rig/clips in Node. Image decoding/CSP is exercised in the browser.
// Six fighters ship: the player's warrior.glb, the Veteran (his own head, helm and maps on the same rig), the Pitborn (the same rig at
// OPPONENTS.pitborn.scale with a hunched spine — his ceilings scale with him), the Nightborn and the goblin (the rig re-proportioned and
// scaled to OPPONENTS.goblin.scale of a man's height), and the Executioner (the brute frame at OPPONENTS.executioner.scale, mask and hood).
const FIGHTERS = ['warrior.glb', 'veteran.glb', 'pitborn.glb', 'nightborn.glb', 'goblin.glb', 'executioner.glb'] as const;
const SCALE: Record<(typeof FIGHTERS)[number], number> = { 'warrior.glb': 1, 'veteran.glb': 1, 'pitborn.glb': OPPONENTS.pitborn.scale, 'nightborn.glb': OPPONENTS.nightborn.scale, 'goblin.glb': OPPONENTS.goblin.scale, 'executioner.glb': OPPONENTS.executioner.scale };
// The weapon each shipped rig carries is the simulation's word (moves.ts OPPONENTS): the player's longsword, the Veteran's trident, the Pitborn's cleaver, the Nightborn's estoc and the goblin's knife (sword clips until the weapons lane lands them).
const WEAPON_OF: Record<(typeof FIGHTERS)[number], WeaponId> = { 'warrior.glb': 'longsword', 'veteran.glb': OPPONENTS.veteran.weapon, 'pitborn.glb': OPPONENTS.pitborn.weapon, 'nightborn.glb': OPPONENTS.nightborn.weapon, 'goblin.glb': OPPONENTS.goblin.weapon, 'executioner.glb': OPPONENTS.executioner.weapon };
async function readWarrior(file: (typeof FIGHTERS)[number] = 'warrior.glb') {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  assert.ok(json.images.length >= 3);
  assert.ok(json.images.every((i: { bufferView: number }) => Number.isInteger(i.bufferView)));
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

test('Split Crown cuts every fighter head, follows its animated bone, respects blood modes and restores on rematch', async () => {
  for (const file of FIGHTERS) {
    const asset = await readWarrior(file), weapon = WEAPON_OF[file];
    const { player, opponent } = buildWarriors(asset, undefined, [weapon, weapon]);
    const placed = new Group(); placed.position.set(5, 0, -4); placed.rotation.y = .8; placed.add(opponent.anchor);
    const head = opponent.anchor.getObjectByName('Head')!;
    opponent.update(0, .1, 'splitCrown', .15);
    opponent.splitCrown(.15, 'off');
    assert.equal(opponent.anchor.getObjectByName('SplitCrown'), undefined, 'off never builds a split');
    opponent.splitCrown(.15, 'red');
    const crown = opponent.anchor.getObjectByName('SplitCrown')!;
    assert.ok(crown, `${file}: its own head is split`);
    assert.ok(new Box3().setFromObject(crown).getCenter(new Vector3()).distanceTo(head.getWorldPosition(new Vector3())) < .35,
      `${file}: head bake stays on the neck away from the world origin, even before a GPU render`);
    assert.equal(crown.children.length, 2);
    for (const [i, half] of crown.children.entries()) {
      const side = i ? 1 : -1;
      assert.ok(half.children.some(o => o.name === 'SkullCut'), `${file}: cut surfaces close the head`);
      assert.ok(half.children.length >= 2);
      for (const part of half.children) {
        assert.ok(part instanceof Mesh);
        const p = part.geometry.getAttribute('position');
        for (let v = 0; v < p.count; v++) {
          assert.ok([p.getX(v), p.getY(v), p.getZ(v)].every(Number.isFinite));
          assert.ok(p.getX(v)*side >= -1e-7, 'no exterior triangle bridges the split');
        }
      }
    }
    assert.equal(player.anchor.getObjectByName('SplitCrown'), undefined, 'the other fighter is untouched');
    assert.equal(player.anchor.getObjectByName('Head')!.scale.x, 1);
    opponent.update(0, .1, 'splitCrown', 1); opponent.splitCrown(1, 'dark');
    assert.deepEqual(crown.quaternion.toArray(), head.quaternion.toArray(), 'the halves follow the kneeling head');
    assert.deepEqual(crown.position.toArray(), head.position.toArray());
    const cap = crown.children[0].children.find(o => o.name === 'SkullCut') as Mesh;
    const darkColor = (cap.material as import('three').MeshStandardMaterial).color.getHex();
    opponent.splitCrown(1, 'off');
    assert.equal(crown.visible, false); assert.equal(head.scale.x, 1);
    opponent.splitCrown(1, 'red');
    assert.equal(crown.visible, true); assert.equal(head.scale.x, .0001);
    assert.notEqual((cap.material as import('three').MeshStandardMaterial).color.getHex(), darkColor);
    let disposed = 0; cap.geometry.addEventListener('dispose', () => disposed++);
    opponent.unsever();
    assert.equal(disposed, 1); assert.equal(head.scale.x, 1);
    assert.equal(opponent.anchor.getObjectByName('SplitCrown'), undefined);
    // The same fighter can decapitate on the next fight; the separate severed-head path is still intact.
    opponent.update(0, .1, 'decapitation', .1);
    const severed = opponent.sever(); assert.ok(severed?.group.children.length);
    assert.equal(opponent.sever(), null); opponent.unsever();
    severed.group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
  }
});

for (const file of FIGHTERS) test(`shipped ${file} has finite poses, grounded walk and bounded running flight`, async () => {
  const asset = await readWarrior(file), names = asset.animations.map(a => a.name);
  // The sword set is the base of every rig; a rig carries every clip its weapon's role table names, and nothing plays by position.
  assert.deepEqual(names.slice(0, CLIPS.length + COMBAT_CLIPS.length), [...CLIPS, ...COMBAT_CLIPS]);
  for (const role of ROLES) assert.ok(names.includes(clipFor(WEAPON_OF[file], role)), `${file} carries ${clipFor(WEAPON_OF[file], role)} for ${role}`);
  const mixer = new AnimationMixer(asset.scene), point = new Vector3();
  let triangles = 0;
  asset.scene.traverse(o => { if (o instanceof SkinnedMesh) triangles += o.geometry.index!.count / 3; });
  assert.ok(triangles < 60000, `${file} triangle count: ${triangles}`); // ceiling raised 40k→60k by the owner, 2026-09-14 (character lane)
  for (const clip of asset.animations.filter(a => (CLIPS as readonly string[]).includes(a.name))) {
    assert.ok(clip.tracks.every(t => t.values.every(Number.isFinite)));
    const action = mixer.clipAction(clip).play();
    for (let frame = 0; frame < 12; frame++) {
      mixer.setTime(clip.duration * frame / 12); asset.scene.updateMatrixWorld(true);
      const bounds = new Box3();
      asset.scene.traverse(object => {
        if (!(object instanceof SkinnedMesh)) return;
        object.skeleton.update();
        for (let i = 0; i < object.geometry.index!.count; i++) {
          object.getVertexPosition(object.geometry.index!.getX(i), point).applyMatrix4(object.matrixWorld);
          assert.ok(point.toArray().every(Number.isFinite)); bounds.expandByPoint(point);
        }
      });
      const k = SCALE[file];
      // Flight scales with the fighter's stride, so the bound scales with k like the height/reach bounds below (probe
      // 2026-09-18, max Jog min-y over 24 frames: man 0.285, pitborn 0.323 @1.13, goblin 0.193 @0.835, executioner 0.379 @1.36;
      // the old fixed 0.32 only survived on the Pitborn by 12-frame sampling luck). Walk/Idle stay grounded for everyone.
      assert.ok(bounds.min.y >= -.03, `${clip.name}: underground foot ${bounds.min.y}`);
      assert.ok(bounds.min.y < (clip.name === 'Idle' || clip.name === 'Walk' ? .06 : .32 * k), `${clip.name}: floating ${bounds.min.y}`);
      assert.ok(bounds.max.y < 2.0 * k && bounds.max.y > 1.4 * k, `${file} ${clip.name}: height ${bounds.max.y}`); // 1.87 → 2.0 (REQUESTS #9): the Veteran's crested helm reaches ~1.92 m on this 1.8 m body
      // depth 1.6→1.65: the Studio body's feet are real length, so the Jog stride measures 1.605 m toe to toe (2026-09-14)
      assert.ok(bounds.max.x - bounds.min.x < 1.5 * k && bounds.max.z - bounds.min.z < 1.65 * k, `${clip.name} frame ${frame}: reach ${(bounds.max.x - bounds.min.x).toFixed(2)} × ${(bounds.max.z - bounds.min.z).toFixed(2)}`);
    }
    action.stop();
  }
});

test('the Veteran is the warrior\'s rig: same bones, the shared clips identical track for track, and either the sword nodes or a WeaponDrawn with a contact segment', async () => {
  const [hero, veteran] = await Promise.all([readWarrior('warrior.glb'), readWarrior('veteran.glb')]);
  const shared = hero.animations.filter(clip => veteran.animations.some(v => v.name === clip.name)).map(c => c.name);
  assert.deepEqual(shared, [...CLIPS, ...COMBAT_CLIPS, ...FINISHER_CLIPS], 'the sword set is shared (finisher clips are additive, 2026-09-17)');
  for (const clip of hero.animations) {
    const other = veteran.animations.find(v => v.name === clip.name)!;
    assert.equal(other.duration, clip.duration, `${clip.name} duration`);
    assert.deepEqual(other.tracks.map(t => t.name).sort(), clip.tracks.map(t => t.name).sort(), `${clip.name} tracks`);
    for (const track of clip.tracks) { // every bone track identical: same rig, same motion, so a sword blade path would be the Veteran's too
      const twin = other.tracks.find(t => t.name === track.name)!;
      assert.deepEqual(Array.from(twin.times), Array.from(track.times), `${clip.name} ${track.name} times`);
      if (clip.name === 'Death_QuietOne') continue; // authored on each body/weapon; the all-rig throat/ground test below checks this new motion
      assert.deepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} values`);
    }
  }
  const bones = (asset: Awaited<ReturnType<typeof readWarrior>>) => { const names: string[] = []; asset.scene.traverse(o => { if ((o as { isBone?: boolean }).isBone) names.push(o.name); }); return names; };
  assert.deepEqual(bones(veteran), bones(hero));
  // The weapon on each rig, the way the renderer looks for it: the hero's sword hangs under hand_r; the Veteran's trident is a WeaponDrawn
  // node under hand_r with its contact segment (the tines) in extras, and the sword nodes carry nothing.
  for (const [asset, weapon] of [[hero, WEAPON_OF['warrior.glb']], [veteran, WEAPON_OF['veteran.glb']]] as const) {
    const weaponNode = asset.scene.getObjectByName('WeaponDrawn'), drawn = asset.scene.getObjectByName('SwordDrawn')!, sheathed = asset.scene.getObjectByName('SwordSheathed')!;
    assert.ok(drawn && sheathed, 'the sword nodes exist on every rig');
    if (weapon === 'longsword') { assert.equal(weaponNode, undefined); assert.equal(drawn.parent?.name, 'hand_r'); assert.ok(drawn.children.length > 0, 'the sword hangs under SwordDrawn'); }
    else {
      assert.ok(weaponNode, 'WeaponDrawn'); assert.equal(weaponNode!.parent?.name, 'hand_r');
      const contact = weaponNode!.userData.contact as { from: number; to: number };
      assert.ok(contact && contact.to > contact.from && contact.from > 0, `extras.contact ${JSON.stringify(contact)}`);
      assert.equal(drawn.children.length + sheathed.children.length, 0, 'the sword nodes carry nothing');
    }
  }
});

test('the role table resolves every role for both weapons to a clip the rig carries, and the attack roles play the clips the blade tables were baked from', async () => {
  const rigs = { longsword: await readWarrior('warrior.glb'), trident: await readWarrior('veteran.glb'), cleaver: await readWarrior('pitborn.glb'), estoc: await readWarrior('nightborn.glb'), knife: await readWarrior('goblin.glb'), scythe: await readWarrior('executioner.glb') } as const;   // the estoc, the knife and the scythe ride the sword clip family until the weapons lane lands them
  for (const weapon of Object.keys(WEAPON_CLIPS) as WeaponId[]) {
    const names = rigs[weapon].animations.map(a => a.name);
    for (const role of ROLES) assert.ok(names.includes(clipFor(weapon, role)), `${weapon} ${role} → ${clipFor(weapon, role)}`);
    // What the renderer plays for a path is what scripts/bake-blades.mjs sampled for it (PathSpec.clip), so the trail and the sim agree.
    const paths = WEAPONS[weapon].paths, played: Record<string, Role> = { light_right: 'Attack', light_right_chain: 'Attack', light_left: 'Return', light_left_chain: 'Return', heavy_overhead: 'Heavy', heavy_overhead_chain: 'Heavy', heavy_riposte: 'Heavy', thrust: 'Thrust', riposte: 'Riposte', slash_riposte: 'Attack' };
    for (const [path, role] of Object.entries(played)) assert.equal(clipFor(weapon, role), paths[path as keyof typeof paths].clip, `${weapon} ${path}: renderer plays ${clipFor(weapon, role)}, bake sampled ${paths[path as keyof typeof paths].clip}`);
  }
  assert.deepEqual(Object.keys(WEAPON_CLIPS).sort(), Object.keys(WEAPONS).sort(), 'every weapon the sim knows has a clip table');
});

test('the renderer builds a trident fighter without throwing, keeps the weapon in hand through every pose, and its trail samples the contact segment', async () => {
  const [hero, veteran] = await Promise.all([readWarrior('warrior.glb'), readWarrior('veteran.glb')]);
  const { player, opponent } = buildWarriors(hero, veteran, ['longsword', 'trident']);
  const weapon = opponent.anchor.getObjectByName('WeaponDrawn')!, contact = weapon.userData.contact as { from: number; to: number };
  assert.ok(weapon, 'the opponent carries WeaponDrawn');
  for (const [pose, attack] of [['sheathed', 'light'], ['ready', 'light'], ['attack', 'light'], ['attack', 'return'], ['attack', 'heavy'], ['attack', 'thrust'], ['attack', 'riposte'], ['attack', 'slashRiposte'], ['guard', 'light'], ['block', 'light'], ['parry', 'light'], ['deflected', 'light'], ['hit', 'light'], ['roll', 'light'], ['kick', 'light'], ['death', 'light']] as const) {
    for (let i = 0; i < 12; i++) opponent.update(0, 1 / 60, pose, i / 11, attack, .4);
    assert.ok(weapon.visible, `${pose}/${attack}: the trident stays in hand`);
    opponent.anchor.updateMatrixWorld(true);
    const tip = weapon.localToWorld(new Vector3(0, contact.to, 0)).toArray();
    assert.ok(tip.every(Number.isFinite) && Math.hypot(...tip) < 4, `${pose}/${attack}: finite tines ${tip.map(v => v.toFixed(2))}`);
  }
  // A sword rig asked to fight with the trident has no such clips: the renderer says so instead of playing the wrong ones.
  assert.throws(() => buildWarriors(hero, hero, ['longsword', 'trident']), /Warrior is missing Trident_Idle/);
  assert.throws(() => buildWarriors(hero, undefined, ['longsword', 'trident']), /one weapon/);
  // The trail: the ribbon's first live sample spans the contact segment (from → to) on the weapon node, not the sword's blade constants.
  const ribbon = opponent.anchor.children.find(c => c !== opponent.anchor.children[0]) as { geometry: { attributes: { position: { array: Float32Array } }, drawRange: { count: number } } };
  for (let i = 0; i < 30; i++) opponent.update(0, 1 / 60, 'ready', 1);
  opponent.update(0, 1 / 60, 'attack', .4, 'light', .35); opponent.update(0, 1 / 60, 'attack', .42, 'light', .35);
  assert.ok(ribbon.geometry.drawRange.count > 0, 'a live swing frame samples the trail');
  opponent.anchor.updateMatrixWorld(true);
  const local = (y: number) => opponent.anchor.worldToLocal(weapon.localToWorld(new Vector3(0, y, 0))).toArray();
  const v = ribbon.geometry.attributes.position.array, first = [v[0], v[1], v[2]], second = [v[3], v[4], v[5]];   // [newest.from, newest.to, ...] per the ribbon's vertex order
  const near = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-4);
  assert.ok(near(first, local(contact.from)) && near(second, local(contact.to)), `the trail spans ${contact.from}–${contact.to} m along the weapon: got ${first.map(x => x.toFixed(3))} / ${second.map(x => x.toFixed(3))}`);
  // The hero is untouched by the table: his sword still swaps sheathed/drawn.
  const drawn = player.anchor.getObjectByName('SwordDrawn')!, sheathed = player.anchor.getObjectByName('SwordSheathed')!;
  player.update(0, 1 / 60, 'sheathed', 0); assert.ok(sheathed.visible && !drawn.visible);
  player.update(0, 1 / 60, 'ready', 1); assert.ok(drawn.visible && !sheathed.visible);
});


// Standing height of a clip's first frame: the top of every skinned vertex.
// `skip` excludes meshes (e.g. the Nightborn's crown) so accessories can be measured separately from the body.
function standingTop(asset: Awaited<ReturnType<typeof readWarrior>>, clipName = 'Idle', skip?: (o: SkinnedMesh) => boolean) {
  const mixer = new AnimationMixer(asset.scene), clip = asset.animations.find(a => a.name === clipName)!, point = new Vector3(), bounds = new Box3();
  mixer.clipAction(clip).play(); mixer.setTime(0); asset.scene.updateMatrixWorld(true);
  asset.scene.traverse(o => { if (!(o instanceof SkinnedMesh) || (skip && skip(o))) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { point.fromBufferAttribute(p, i); o.applyBoneTransform(i, point); point.applyMatrix4(o.matrixWorld); bounds.expandByPoint(point); } });
  return bounds.max.y;
}
const HUNCHED = ['spine_02', 'spine_03', 'neck_01', 'Head'];   // scripts/build-warrior.mjs BUILD.pitborn.hunch
test('the Pitborn is the warrior\'s rig at OPPONENTS.pitborn.scale with a hunched spine: same clips and timings, every bone track identical except the hunched ones and the cleaver\'s re-keyed Heavy (the hack), the cleaver in the sword hand, and he stands taller by his scale less the hunch', async () => {
  const [hero, brute] = await Promise.all([readWarrior('warrior.glb'), readWarrior('pitborn.glb')]);
  assert.deepEqual(brute.animations.map(a => a.name), hero.animations.map(a => a.name));
  let hunchedTracks = 0, rekeyed = 0;
  for (const [i, clip] of hero.animations.entries()) {
    const other = brute.animations[i];
    assert.equal(other.duration, clip.duration, `${clip.name} duration`);
    assert.deepEqual(other.tracks.map(t => t.name).sort(), clip.tracks.map(t => t.name).sort(), `${clip.name} tracks`);
    for (const track of clip.tracks) {
      const twin = other.tracks.find(t => t.name === track.name)!;
      assert.deepEqual(Array.from(twin.times), Array.from(track.times), `${clip.name} ${track.name} times`);
      if (clip.name === 'Death_QuietOne') continue; // authored on each body/weapon; the all-rig throat/ground test below checks this new motion
      if (HUNCHED.some(b => track.name === `${b}.quaternion`)) { assert.notDeepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} should be hunched`); hunchedTracks++; }
      else if (clip.name === 'Heavy' && /arm|hand|clavicle|Sword|Weapon/.test(track.name)) { if (!twin.values.every((v, n) => v === track.values[n])) rekeyed++; }   // the cleaver's Heavy is the hack: the arms re-keyed so the edge leads (weapons lane); legs and spine still the sword's
      else assert.deepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} values`);
    }
  }
  assert.ok(hunchedTracks >= hero.animations.length * HUNCHED.length * .9, `hunched tracks ${hunchedTracks}`);
  assert.ok(rekeyed >= 2, `the hack re-keys the arms (${rekeyed} arm tracks differ in Heavy)`);
  // He carries the cleaver where the sword hung: WeaponDrawn under hand_r at the sword's transform, its edge as the contact segment; the sword nodes carry nothing.
  for (const name of ['SwordSheathed', 'SwordDrawn', 'hand_r']) {
    const a = hero.scene.getObjectByName(name)!, b = brute.scene.getObjectByName(name)!;
    assert.ok(a && b, name);
    assert.deepEqual(b.position.toArray(), a.position.toArray(), `${name} position`); assert.deepEqual(b.quaternion.toArray(), a.quaternion.toArray(), `${name} rotation`); assert.equal(b.parent?.name, a.parent?.name, `${name} parent`);
  }
  const cleaver = brute.scene.getObjectByName('WeaponDrawn')!, sword = hero.scene.getObjectByName('SwordDrawn')!;
  assert.ok(cleaver && cleaver.parent?.name === 'hand_r', 'WeaponDrawn under hand_r');
  assert.deepEqual(cleaver.position.toArray(), sword.position.toArray()); assert.deepEqual(cleaver.quaternion.toArray(), sword.quaternion.toArray());
  assert.deepEqual(cleaver.userData.contact, { from: .14, to: .86 }); assert.equal(brute.scene.getObjectByName('SwordDrawn')!.children.length + brute.scene.getObjectByName('SwordSheathed')!.children.length, 0, 'the sword nodes carry nothing');
  // The scale is on the rig root, so the simulation's capsule (OPPONENTS.pitborn.scale) and the rendered man agree; the hunch takes a few centimetres off the top.
  const k = OPPONENTS.pitborn.scale, root = (a: typeof hero) => a.scene.children[0].scale;
  for (const axis of ['x', 'y', 'z'] as const) assert.ok(Math.abs(root(brute)[axis] / root(hero)[axis] - k) < 1e-3, `root scale ${axis}: ${root(brute)[axis]} / ${root(hero)[axis]}`);
  const ratio = standingTop(brute) / standingTop(hero);
  assert.ok(ratio > k - .06 && ratio <= k + .01, `standing height ratio ${ratio.toFixed(3)} for scale ${k} (${standingTop(brute).toFixed(3)} / ${standingTop(hero).toFixed(3)} m)`);
  console.log(`pitborn stands ${standingTop(brute).toFixed(3)} m to the hero's ${standingTop(hero).toFixed(3)} (×${ratio.toFixed(3)}, scale ${k}); ${hunchedTracks} hunched tracks`);
});

// The goblin: scripts/build-warrior.mjs BUILD.goblin — legs ×.84, arms ×1.16, neck ×.9 (thinner), head ×1.17, a 9°/9°/−8°/−8° hunch, root scale .835.
const GOBLIN = { legs: .84, arms: 1.16, root: .835, stride: .835 * .84, hunched: ['spine_02', 'spine_03', 'neck_01', 'Head'], clamped: ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r'] };
// Library clips are retargeted rotations: proportion-independent, so they must be the hero's to the bit. The authored clips (Draw, the swings,
// the strafes, the kick, the defences) are solved on the rig with the two-bone reach, so their limb tracks legitimately follow his longer arms
// and shorter legs; everything else in them (pelvis, spine_01, fingers, clavicles) is still the hero's.
const RETARGETED = ['Idle', 'Walk', 'Jog', 'Run', 'Armed', 'Hit', 'Death', 'Guard', 'ArmedWalk', 'Roll'], SOLVED = /^(upperarm|lowerarm|hand|thigh|calf|foot)_[lr]\.quaternion$/;
test('the goblin is the warrior\'s rig re-proportioned: short legs, long arms, a big head on a thin neck, the feet still on the floor; the same clips at the same durations (the finisher is additive) — library clips bit-identical except the hunched spine (and the rolling arms), authored clips identical except the hunch and the re-solved limbs; the sword in the same hand; and he stands OPPONENTS.goblin.scale of the hero', async () => {
  const [hero, goblin] = await Promise.all([readWarrior('warrior.glb'), readWarrior('goblin.glb')]);
  assert.deepEqual(goblin.animations.map(a => a.name), hero.animations.map(a => a.name));
  let hunchedTracks = 0, solvedTracks = 0, identical = 0;
  for (const [i, clip] of hero.animations.entries()) {
    const other = goblin.animations[i], retargeted = RETARGETED.includes(clip.name);
    assert.equal(other.duration, clip.duration, `${clip.name} duration`);
    assert.deepEqual(other.tracks.map(t => t.name).sort(), clip.tracks.map(t => t.name).sort(), `${clip.name} tracks`);
    for (const track of clip.tracks) {
      const twin = other.tracks.find(t => t.name === track.name)!;
      if (track.name === 'pelvis.position') continue;   // the pelvis sits lower (the legs' loss) and sways less (bob): checked below
      if (clip.name === 'Roll' && GOBLIN.clamped.some(b => track.name === `${b}.quaternion`)) { assert.ok(twin.times.length >= 20, `${track.name}: the rolling arm is re-sampled for the floor clamp`); continue; }
      assert.deepEqual(Array.from(twin.times), Array.from(track.times), `${clip.name} ${track.name} times`);
      if (clip.name === 'Death_QuietOne') continue; // authored on each body/weapon; the all-rig throat/ground test below checks this new motion
      if (GOBLIN.hunched.some(b => track.name === `${b}.quaternion`)) { assert.notDeepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} should be hunched`); hunchedTracks++; }
      else if (!retargeted && SOLVED.test(track.name)) solvedTracks++;
      else { assert.deepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} values`); identical++; }
    }
  }
  assert.ok(hunchedTracks >= hero.animations.length * GOBLIN.hunched.length * .9, `hunched tracks ${hunchedTracks}`);
  assert.ok(identical > hero.animations.length * 50 && solvedTracks <= (hero.animations.length - RETARGETED.length) * 12, `identical ${identical}, solved ${solvedTracks}`);
  // The sword hangs from hand_r exactly as the hero's (the hand and the grip are untouched); the scabbard rides the pelvis.
  for (const name of ['SwordSheathed', 'SwordDrawn']) {
    const a = hero.scene.getObjectByName(name)!, b = goblin.scene.getObjectByName(name)!;
    assert.deepEqual(b.position.toArray(), a.position.toArray(), `${name} position`); assert.deepEqual(b.quaternion.toArray(), a.quaternion.toArray(), `${name} rotation`); assert.equal(b.parent?.name, a.parent?.name, `${name} parent`);
  }
  // Proportions, from the rig's rest positions (bone length = the child's offset): legs ×.84, arms ×1.16, the hands unchanged, the pelvis
  // lower by exactly the legs' loss, so the ankle rests where a man's does.
  const bone = (a: typeof hero, n: string) => a.scene.getObjectByName(n)!, len = (a: typeof hero, n: string) => bone(a, n).position.length();
  const near = (x: number, y: number, tol: number, what: string) => assert.ok(Math.abs(x - y) <= tol, `${what}: ${x.toFixed(4)} vs ${y.toFixed(4)}`);
  for (const side of ['l', 'r']) {
    near(len(goblin, `calf_${side}`) / len(hero, `calf_${side}`), GOBLIN.legs, .002, `thigh ${side}`); near(len(goblin, `foot_${side}`) / len(hero, `foot_${side}`), GOBLIN.legs, .002, `calf ${side}`);
    near(len(goblin, `lowerarm_${side}`) / len(hero, `lowerarm_${side}`), GOBLIN.arms, .002, `upper arm ${side}`); near(len(goblin, `hand_${side}`) / len(hero, `hand_${side}`), GOBLIN.arms, .002, `forearm ${side}`);
    near(len(goblin, `ball_${side}`), len(hero, `ball_${side}`), 1e-4, `foot ${side}`); near(len(goblin, `index_01_${side}`), len(hero, `index_01_${side}`), 1e-4, `hand ${side}`);
  }
  const legLoss = (1 - GOBLIN.legs) * (len(hero, 'calf_l') + len(hero, 'foot_l'));
  near(bone(hero, 'pelvis').position.length() - bone(goblin, 'pelvis').position.length(), legLoss, .002, 'pelvis drop = the legs\' loss');
  // Root scale, the stride datum the runtime reads, and the standing height: OPPONENTS.goblin.scale is the measured ratio (the hit capsule follows it).
  const root = (a: typeof hero) => a.scene.children[0];
  for (const axis of ['x', 'y', 'z'] as const) near(root(goblin).scale[axis] / root(hero).scale[axis], GOBLIN.root, 1e-3, `root scale ${axis}`);
  near(root(goblin).userData.stride, GOBLIN.stride, 1e-6, 'stride');
  const ratio = standingTop(goblin) / standingTop(hero), k = OPPONENTS.goblin.scale;
  assert.ok(Math.abs(ratio - k) <= .02, `standing height ratio ${ratio.toFixed(3)} for OPPONENTS.goblin.scale ${k} (${standingTop(goblin).toFixed(3)} / ${standingTop(hero).toFixed(3)} m)`);
  // The floor clamp: the roll's longer arms on lower shoulders would otherwise plant the hands 10 cm under the floor.
  const mixer = new AnimationMixer(goblin.scene), roll = goblin.animations.find(a => a.name === 'Roll')!, point = new Vector3(); let lowest = 9;
  const action = mixer.clipAction(roll).play();
  for (let f = 0; f <= 24; f++) { mixer.setTime(roll.duration * f / 24 * .999); goblin.scene.updateMatrixWorld(true); goblin.scene.traverse(o => { if (!(o instanceof SkinnedMesh)) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { point.fromBufferAttribute(p, i); o.applyBoneTransform(i, point); point.applyMatrix4(o.matrixWorld); lowest = Math.min(lowest, point.y); } }); }
  action.stop();
  assert.ok(lowest >= 0, `the roll dips to ${lowest.toFixed(3)} m`);
  console.log(`goblin stands ${standingTop(goblin).toFixed(3)} m to the hero's ${standingTop(hero).toFixed(3)} (×${ratio.toFixed(3)}, OPPONENTS.goblin.scale ${k}); ${identical} identical tracks, ${hunchedTracks} hunched, ${solvedTracks} re-solved limbs; roll lowest ${lowest.toFixed(3)} m`);
});

test('two fighters share geometry but have independent animated bones', async () => {
  const asset = await readWarrior(), opponent = clone(asset.scene);
  const a = asset.scene.getObjectByName('Steel') as SkinnedMesh, b = opponent.getObjectByName('Steel') as SkinnedMesh;
  assert.equal(a.geometry, b.geometry);
  assert.notEqual(a.skeleton.bones[0], b.skeleton.bones[0]);
  const before = b.skeleton.bones.map(bone => bone.quaternion.toArray());
  const mixer = new AnimationMixer(asset.scene); mixer.clipAction(asset.animations[3]).play(); mixer.update(.25);
  assert.deepEqual(b.skeleton.bones.map(bone => bone.quaternion.toArray()), before);
  assert.notDeepEqual(a.skeleton.bones.map(bone => bone.quaternion.toArray()), before);
});


test('combat clips and both sword attachments are present and produce finite animated poses', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene);
  for (const name of ['SwordSheathed', 'SwordDrawn']) assert.ok(asset.scene.getObjectByName(name), name);
  const drawn = asset.scene.getObjectByName('SwordDrawn')!;
  assert.equal(drawn.parent?.name, 'hand_r');
  for (const name of COMBAT_CLIPS) {
    const clip = asset.animations.find(a => a.name === name)!;
    assert.ok(clip.duration > 0 && clip.tracks.length > 0);
    assert.ok(clip.tracks.every(t => t.values.every(Number.isFinite)));
    const action = mixer.clipAction(clip).play();
    for (let frame = 0; frame < 20; frame++) {
      mixer.setTime(clip.duration * frame / 20); asset.scene.updateMatrixWorld(true);
      const tip = drawn.localToWorld(new Vector3(0, .86, 0));
      assert.ok(tip.toArray().every(Number.isFinite)); assert.ok(tip.length() < 4);
    }
    action.stop();
  }
});


test('the exported blade crosses the target at the simulation contact frame', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene);
  const clip = asset.animations.find(a => a.name === 'Attack')!;
  mixer.clipAction(clip).play(); mixer.setTime(clip.duration * swingProgress(SWORD.contact / SWORD.recovery, SWORD.contact / SWORD.recovery));
  asset.scene.updateMatrixWorld(true);
  const tip = asset.scene.getObjectByName('SwordDrawn')!.localToWorld(new Vector3(0, .86, 0));
  assert.ok(tip.z > .9 && tip.z <= SWORD.reach + .1 && Math.abs(tip.x) < .45 && tip.y > .6 && tip.y < 2, `Contact tip: ${tip.toArray()}`);
});

test('roll and guard keep the shipped body finite, above the floor and within a compact silhouette', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene), point = new Vector3();
  for (const name of ['Roll', 'Guard', 'BlockImpact', 'Parry']) {
    const clip = asset.animations.find(a => a.name === name)!;
    const action = mixer.clipAction(clip).play();
    for (let frame = 0; frame < 24; frame++) {
      mixer.setTime(clip.duration * frame / 24); asset.scene.updateMatrixWorld(true);
      const bounds = new Box3();
      asset.scene.traverse(object => {
        if (!(object instanceof SkinnedMesh)) return;
        object.skeleton.update();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld); bounds.expandByPoint(point);
        }
      });
      assert.ok(bounds.min.y > -.12, `${name} floor: ${bounds.min.y}`);
      if(name === 'Guard') assert.ok(bounds.min.y < .06, `Guard floats: ${bounds.min.y}`);
      assert.ok(bounds.max.y < 2.2, `${name} height: ${bounds.max.y}`);
      assert.ok(bounds.getSize(point).length() < 3.5, `${name} silhouette: ${point.toArray()}`);
    }
    action.stop();
  }
});

test('swing easing remains monotone and preserves the authored contact pose', () => {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) { const p = swingProgress(i / 1000); assert.ok(p >= previous && p <= 1); previous = p; }
  assert.ok(Math.abs(swingProgress(SWORD.contact / SWORD.recovery, SWORD.contact / SWORD.recovery) - .34) < 1e-8, 'the cut meets at its authored contact key');
});

test('return, heavy and riposte authored blades agree with their contact ticks', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene);
  for (const [kind,name,source] of [['light','Attack',.34],['return','Return',.34],['heavy','Heavy',.48],['riposte','Riposte',.34],['slashRiposte','Attack',.34]] as const) {
    const spec = ATTACKS[kind], clip = asset.animations.find(a => a.name === name)!;
    const action = mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * swingProgress(spec.contact/spec.recovery,spec.contact/spec.recovery,source));
    asset.scene.updateMatrixWorld(true);
    const tip = asset.scene.getObjectByName('SwordDrawn')!.localToWorld(new Vector3(0,.86,0));
    assert.ok(tip.z > .85 && Math.abs(tip.x) < .45 && tip.y > .6 && tip.y < 1.8, `${name} ${tip.toArray()}`);
    action.stop();
  }
});

test('baked collision paths match the shipped blade throughout every active strike', async () => {
  const {bladePose}=await import('../src/blade.ts');
  const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene),blade=asset.scene.getObjectByName('SwordDrawn')!;
  for(const [kind,spec] of Object.entries(PATHS)) {
    const length=total(spec),clip=asset.animations.find(c=>c.name===spec.clip)!,action=mixer.clipAction(clip).play();
    for(let age=spec.windup-1;age<=spec.windup+spec.active;age++) {
      mixer.setTime(swingProgress(age/length,spec.windup/length,spec.source)*clip.duration);asset.scene.updateMatrixWorld(true);
      const actual=[.18,.86].flatMap(y=>blade.localToWorld(new Vector3(0,y,0)).toArray());
      assert.ok(actual.every((v,i)=>Math.abs(v-bladePose('longsword',kind,age)[i])<.00002),`${kind} tick ${age}`);
    }
    action.stop();
  }
});
test('authored strafe loops close cleanly and alternate grounded feet',async()=>{
  const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene);
  for(const name of ['StrafeLeft','StrafeRight']) {
    const clip=asset.animations.find(c=>c.name===name)!,action=mixer.clipAction(clip).play();
    for(let i=0;i<24;i++) {
      mixer.setTime(i/24*clip.duration);asset.scene.updateMatrixWorld(true);
      const feet=['foot_l','foot_r'].map(n=>asset.scene.getObjectByName(n)!.getWorldPosition(new Vector3()));
      assert.ok(feet.every(p=>p.y>-.02&&p.y<.3));
      assert.ok(Math.min(...feet.map(p=>p.y))<.17,`${name} ${i}: ${feet.map(p=>p.y)} at least one supporting foot`);
    }
    for(const track of clip.tracks){const n=track.getValueSize();assert.ok([...track.values.slice(0,n)].every((v,i)=>Math.abs(v-track.values[track.values.length-n+i])<.00001));}
    action.stop();
  }
});

test('authored kick plants its support foot and extends towards its contact range', async()=>{
 const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene),clip=asset.animations.find(a=>a.name==='Kick')!;
 mixer.clipAction(clip).play();mixer.setTime(0);asset.scene.updateMatrixWorld(true);
 const support=asset.scene.getObjectByName('foot_l')!.getWorldPosition(new Vector3());
 mixer.setTime(18/44);asset.scene.updateMatrixWorld(true);
 const foot=asset.scene.getObjectByName('foot_r')!.getWorldPosition(new Vector3());
 assert.ok(foot.z>.6 && foot.y>.5 && foot.y<1.1,`kick contact ${foot.toArray()}`);
 assert.ok(asset.scene.getObjectByName('foot_l')!.getWorldPosition(new Vector3()).distanceTo(support)<.01);
});

test('defence presentation follows confirmed contacts and yields immediately to new actions',()=>{
 const s={...initialPractice(),phase:'guard' as const,result:'parried' as const,reaction:90};
 assert.equal(defenceReaction(s)?.pose,'parry');assert.equal(defenceReaction(s,true)?.pose,'deflected');
 assert.equal(defenceReaction({...s,phase:'attack'}),undefined);assert.equal(defenceReaction({...s,playerHealth:0}),undefined);
 assert.equal(defenceReaction({...s,resultAge:18}),undefined);
 assert.equal(defenceReaction({...s,result:'blocked'})?.pose,'block');
 assert.equal(defenceReaction({...s,result:'enemyBlocked',enemyMode:'guard'},true)?.pose,'block');
});
test('block recoil and parry visibly redirect the shipped blade and recover their guard pose',async()=>{
 const asset=await readWarrior(),mixer=new AnimationMixer(asset.scene),blade=asset.scene.getObjectByName('SwordDrawn')!;
 for(const name of ['BlockImpact','Parry']){
  const clip=asset.animations.find(a=>a.name===name)!;const action=mixer.clipAction(clip).play();mixer.setTime(0);asset.scene.updateMatrixWorld(true);const start=blade.localToWorld(new Vector3(0,.86,0));
  mixer.setTime(.35);asset.scene.updateMatrixWorld(true);assert.ok(blade.localToWorld(new Vector3(0,.86,0)).distanceTo(start)>.08,name+' must move blade');
  mixer.setTime(.99999);asset.scene.updateMatrixWorld(true);assert.ok(blade.localToWorld(new Vector3(0,.86,0)).distanceTo(start)<.005,name+' recovers');action.stop();
 }
});

test('a zero-dt update evaluates the pose for the tick without advancing: the contact pose is applied on the freeze frame, and no trail sample is taken', async () => {
  const { player } = buildWarriors(await readWarrior());
  const drawn = player.anchor.getObjectByName('SwordDrawn')!, tip = () => { player.anchor.updateMatrixWorld(true); return drawn.localToWorld(new Vector3(0, .86, 0)).toArray(); };
  const close = (a: number[], b: number[], eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);
  // Draw, then stand ready so the sword hand settles; the blade sits somewhere definite.
  for (let i = 0; i < 30; i++) player.update(0, 1 / 60, 'draw', Math.min(1, i / 20));
  for (let i = 0; i < 60; i++) player.update(0, 1 / 60, 'ready', 1);
  const rest = tip();
  // The contact tick arrives while the frame loop is frozen: dt 0 with the swing's contact progress must move the blade to the contact pose at once.
  player.update(0, 0, 'attack', .35, 'light', .35);
  const frozen = tip();
  assert.ok(!close(frozen, rest, 1e-3), 'the contact pose is applied at dt 0 (an early return would leave the resting blade)');
  // Repeating the frozen frame changes nothing; a normal frame at the same progress lands on the same pose (dt only advances what progress does not drive).
  player.update(0, 0, 'attack', .35, 'light', .35);
  assert.ok(close(tip(), frozen), 'a repeated frozen frame holds the pose');
  // The trail ribbon only samples on frames that advance: frozen frames at a trailing progress leave it empty; one live frame fills it.
  const ribbon = player.anchor.children.find(c => c !== player.anchor.children[0]) as { geometry: { drawRange: { count: number } } } | undefined;
  assert.ok(ribbon, 'the trail mesh hangs off the anchor');
  player.update(0, 0, 'attack', .4, 'light', .35); player.update(0, 0, 'attack', .4, 'light', .35);
  const drawn3 = ribbon!.geometry.drawRange.count; assert.ok(!(Number.isFinite(drawn3) && drawn3 > 0), `no trail geometry from frozen frames (draw range ${drawn3})`);
  player.update(0, 1 / 60, 'attack', .4, 'light', .35); player.update(0, 1 / 60, 'attack', .42, 'light', .35);
  assert.ok(ribbon!.geometry.drawRange.count > 0, 'a live frame samples the trail');
});

test('the cuts are hooks: the blade tip never passes behind the shoulder line in Attack or Return, swings out wide, and never dips low', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene), drawn = asset.scene.getObjectByName('SwordDrawn')!;
  for (const name of ['Attack', 'Return']) {
    const clip = asset.animations.find(a => a.name === name)!, action = mixer.clipAction(clip).play(); let minZ = Infinity, maxSide = 0, minY = Infinity;
    for (let i = 0; i <= 60; i++) { mixer.setTime(clip.duration * i / 60); asset.scene.updateMatrixWorld(true); const tip = drawn.localToWorld(new Vector3(0, .86, 0)); minZ = Math.min(minZ, tip.z); maxSide = Math.max(maxSide, Math.abs(tip.x)); minY = Math.min(minY, tip.y); }
    action.stop(); mixer.uncacheClip(clip);
    assert.ok(minZ >= 0, `${name}: the tip goes ${(-minZ).toFixed(2)} m behind the body`); assert.ok(maxSide > .9, `${name}: the tip swings out to the side (${maxSide.toFixed(2)} m)`);
    assert.ok(minY >= 1, `${name}: the tip dips to ${minY.toFixed(2)} m (a cut stays at chest height; the retraction lifts, it never drags the blade back low)`);
  }
});

test('one stroke, quantified: the first cut loads on the side the sword rests (the right hip), the sideways travel is all one way inside the cut, it stops at the extended pose, and the return retraces the arc at chest height (no lift over the head)', () => {
  // The baked paths are what the simulation sweeps and what the player sees. x < 0 is the fighter's right; the armed idle holds the sword at the right hip.
  for (const [id, loadSide] of [['light_right', -1], ['light_left', 1]] as const) {
    const t = PATHS[id], p = bladePaths.longsword[id], x = p.map(f => f[3]), y = p.map(f => f[4]);
    const travel = (a: number, b: number) => { let toLeft = 0, toRight = 0; for (let i = a + 1; i <= b; i++) { const d = x[i] - x[i - 1]; if (d > 0) toLeft += d; else toRight -= d; } return { toLeft, toRight }; };
    const load = travel(0, t.windup - 6), cut = travel(t.windup - 6, t.windup + t.active), retract = travel(t.windup + t.active, p.length - 1);
    // Load: the tip stays on its own side and barely moves sideways (a raise, not a swing across the body).
    assert.ok(Math.sign(x[t.windup - 6]) === loadSide, `${id}: the load sits on the ${loadSide < 0 ? 'right' : 'left'} (tip x ${x[t.windup - 6].toFixed(2)})`);
    assert.ok(load.toLeft + load.toRight < .4, `${id}: the load travels ${(load.toLeft + load.toRight).toFixed(2)} m sideways — that is a stroke, not a raise`);
    // The cut: over a metre of sideways travel, essentially all in one direction.
    const [along, against] = loadSide < 0 ? [cut.toLeft, cut.toRight] : [cut.toRight, cut.toLeft];
    assert.ok(along > 1 && against < .1, `${id}: the cut travels ${along.toFixed(2)} m one way and ${against.toFixed(2)} m back`);
    // The return retraces the arc at chest height (owner: stop at the extended pose, then the same path back — no lift over the head), and the tip never dips.
    const [back, onward] = loadSide < 0 ? [retract.toRight, retract.toLeft] : [retract.toLeft, retract.toRight];
    assert.ok(back > 1 && onward < .8, `${id}: the return travels ${back.toFixed(2)} m back along the arc (and ${onward.toFixed(2)} m onward)`);
    assert.ok(Math.max(...y.slice(t.windup + t.active)) < 1.7, `${id}: the return stays at chest height, no lift (peak ${Math.max(...y.slice(t.windup + t.active)).toFixed(2)} m)`);
    assert.ok(Math.min(...y) > 1, `${id}: the tip never dips (${Math.min(...y).toFixed(2)} m)`);
  }
});

const UPRIGHT = ['spine_02', 'spine_03', 'Head'];   // scripts/build-warrior.mjs BUILD.nightborn.hunch — the brute's posture with the signs reversed: chest back, chin up
test('the Nightborn is the warrior\'s rig at OPPONENTS.nightborn.scale, upright and chin-up: same clips and timings, every bone track identical except the three posture bones, the sword in the same hand, and he stands taller by his scale', async () => {
  const [hero, him] = await Promise.all([readWarrior('warrior.glb'), readWarrior('nightborn.glb')]);
  assert.deepEqual(him.animations.map(a => a.name), hero.animations.map(a => a.name));
  let posed = 0;
  for (const [i, clip] of hero.animations.entries()) {
    const other = him.animations[i];
    assert.equal(other.duration, clip.duration, `${clip.name} duration`);
    assert.deepEqual(other.tracks.map(t => t.name).sort(), clip.tracks.map(t => t.name).sort(), `${clip.name} tracks`);
    for (const track of clip.tracks) {
      const twin = other.tracks.find(t => t.name === track.name)!;
      assert.deepEqual(Array.from(twin.times), Array.from(track.times), `${clip.name} ${track.name} times`);
      if (clip.name === 'Death_QuietOne') continue; // authored on each body/weapon; the all-rig throat/ground test below checks this new motion
      if (UPRIGHT.some(b => track.name === `${b}.quaternion`)) { assert.notDeepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} should be re-posed`); posed++; }
      else assert.deepEqual(Array.from(twin.values), Array.from(track.values), `${clip.name} ${track.name} values`);
    }
  }
  assert.ok(posed >= hero.animations.length * UPRIGHT.length * .9, `re-posed tracks ${posed}`);
  for (const name of ['SwordSheathed', 'SwordDrawn', 'hand_r']) {
    const a = hero.scene.getObjectByName(name)!, b = him.scene.getObjectByName(name)!;
    assert.ok(a && b, name);
    assert.deepEqual(b.position.toArray(), a.position.toArray(), `${name} position`); assert.deepEqual(b.quaternion.toArray(), a.quaternion.toArray(), `${name} rotation`); assert.equal(b.parent?.name, a.parent?.name, `${name} parent`);
  }
  const k = OPPONENTS.nightborn.scale, root = (a: typeof hero) => a.scene.children[0].scale;
  for (const axis of ['x', 'y', 'z'] as const) assert.ok(Math.abs(root(him)[axis] / root(hero)[axis] - k) < 1e-3, `root scale ${axis}: ${root(him)[axis]} / ${root(hero)[axis]}`);
  // The crown (material 'Ruby', rigid on Head) rides above the old silhouette — the owner-approved v6, 2026-09-18.
  // The body's proportion invariant is checked without it; the crown is then asserted to add a sane band of height.
  const noCrown = (o: SkinnedMesh) => (Array.isArray(o.material) ? o.material[0] : o.material)?.name === 'Ruby';
  const bodyRatio = standingTop(him, 'Idle', noCrown) / standingTop(hero);
  assert.ok(bodyRatio > k - .03 && bodyRatio <= k + .02, `body height ratio ${bodyRatio.toFixed(3)} for scale ${k} (${standingTop(him, 'Idle', noCrown).toFixed(3)} / ${standingTop(hero).toFixed(3)} m)`);
  const top = standingTop(him), crownRise = top - standingTop(him, 'Idle', noCrown);
  assert.ok(crownRise > .02 && crownRise < .12, `the crown rides ${(crownRise * 100).toFixed(0)} cm above the scaled body (expected 2–12 cm)`);
  assert.ok(top / standingTop(hero) <= k + .05, `silhouette top ${top.toFixed(3)} m stays within the locomotion bounds allowance`);
  console.log(`nightborn stands ${standingTop(him, 'Idle', noCrown).toFixed(3)} m body (${top.toFixed(3)} m with the crown) to the hero's ${standingTop(hero).toFixed(3)} (×${bodyRatio.toFixed(3)}, scale ${k}); ${posed} re-posed tracks`);
});

test('the Run Through hold aims its blade at the victim (owner 2026-09-19): the held blade line passes through the chest at off-axis headings and spacings, and clearing the target is clean', async () => {
  const { player } = buildWarriors(await readWarrior());
  const blade = player.anchor.getObjectByName('SwordDrawn')!;
  for (let i = 0; i < 40; i++) player.update(0, 1 / 60, 'runThroughHold', Math.min(1, i / 30));   // raise into the hold and settle
  for (const [x, z] of [[0, 1.3], [.4, 1.55], [-.55, 1.9]] as const) {
    const chest = new Vector3(x, .95, z);
    player.update(0, 1 / 60, 'runThroughHold', 1);
    player.aimBladeAt(chest);
    player.anchor.updateMatrixWorld(true);
    const grip = blade.localToWorld(new Vector3(0, .24, 0)), tip = blade.localToWorld(new Vector3(0, .85, 0));
    const run = tip.clone().sub(grip), len = run.length(), dir = run.clone().normalize();
    const along = Math.max(0, Math.min(len, chest.clone().sub(grip).dot(dir)));
    const miss = grip.clone().addScaledVector(dir, along).distanceTo(chest);
    assert.ok(miss < .09, `the blade passes within 9 cm of the chest at [${x}, ${z}] (miss ${miss.toFixed(3)} m)`);
    assert.ok(along > .1 && along <= len + .01, 'the chest lies along the blade’s run, not beyond the tip');
  }
  player.update(0, 1 / 60, 'ready', 1);
  assert.deepEqual(player.anchor.position.toArray(), [0, 0, 0], 'rematch clears the presentation step');
  assert.ok(player.boneWorld('spine_02'), 'a chest bone reads back');
  assert.equal(player.boneWorld('no_such_bone'), null, 'a missing bone reports null instead of throwing');
});


test('Run Through stays embedded through every opponent collapse, world heading, held frame and rematch', async () => {
  const hero = await readWarrior();
  for (const file of FIGHTERS.slice(1)) {
    const { player, opponent } = buildWarriors(hero, await readWarrior(file), ['longsword', WEAPON_OF[file]]);
    const stage = new Group(), a = new Group(), b = new Group(); stage.add(a, b); a.add(player.anchor); b.add(opponent.anchor);
    stage.position.set(3.7, 0, -2.8); stage.rotation.y = 1.17;
    const blade = player.anchor.getObjectByName('SwordDrawn')!;
    let random = 731;
    for (let sample = 0; sample < 12; sample++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const yaw = random / 2**32 * Math.PI * 2, gap = .8 + sample * .13;
      a.rotation.y = yaw; b.rotation.y = yaw + Math.PI + .3;
      b.position.set(Math.sin(yaw) * gap, 0, Math.cos(yaw) * gap);
      for (let frame = 0; frame <= 230; frame++) {
        const progress = Math.min(1, frame / 192), dt = frame % 4 === 0 ? 1/30 : 1/60;
        player.update(0, dt, 'runThroughHold', progress); opponent.update(0, dt, 'runThrough', progress);
        const chest = opponent.boneWorld('spine_02')!;
        player.aimBladeAt(chest, Math.min(1, progress / .25));
        if (progress < .25) continue;
        const grip = blade.localToWorld(new Vector3(0, .24, 0)), tip = blade.localToWorld(new Vector3(0, .85, 0));
        const run = tip.clone().sub(grip), along = chest.clone().sub(grip).dot(run) / run.lengthSq();
        assert.ok(grip.clone().addScaledVector(run, along).distanceTo(chest) < .09, `${file} frame ${frame} misses torso`);
        assert.ok(along > .2 && along < .8, `${file}: blade extends both sides of chest`);
        assert.equal(player.anchor.position.y, 0, 'feet remain grounded');
        if (frame === 230) {
          for (let repeat = 0; repeat < 5; repeat++) {
            player.update(0, 0, 'runThroughHold', 1); player.aimBladeAt(chest);
            assert.ok(blade.localToWorld(new Vector3(0, .85, 0)).distanceTo(tip) < 1e-6, 'zero-dt holds do not accumulate rotation');
          }
        }
      }
    }
    player.update(0, 1/60, 'ready', 1);
    assert.deepEqual(player.anchor.position.toArray(), [0, 0, 0], 'rematch clears the approach');
  }
});

test('The Quiet One clutches the throat, pauses upright, then lies still on the sand on every rig', async () => {
  for (const file of FIGHTERS) {
    const asset = await readWarrior(file), weapon = WEAPON_OF[file], { opponent } = buildWarriors(asset, undefined, [weapon, weapon]);
    const at = (name: string) => opponent.anchor.getObjectByName(name)!.getWorldPosition(new Vector3());
    const sample = (progress: number) => { for (let i=0;i<6;i++) opponent.update(0, .1, 'quietOne', progress); opponent.anchor.updateWorldMatrix(true,true); };
    sample(0); const standing = at('Head').y;
    for (const progress of [.22,.32,.42,.55,.7,.9,1]) {
      sample(progress);
      assert.ok(at('hand_l').distanceTo(at('neck_01')) < standing*.1, `${file}: palm stays at the throat at ${progress}`);
      if (progress <= .42) {
        assert.ok(at('Head').y > standing*.85, `${file}: the held beat stays upright`);
        assert.ok(at('lowerarm_l').z > at('neck_01').z+.03, `${file}: clutching elbow stays in front of the chest`);
      }
      for (const name of ['Head','hand_l','hand_r','foot_l','foot_r']) assert.ok(at(name).y > .015, `${file}: ${name} stays above the sand at ${progress}`);
    }
    assert.ok(at('Head').y < standing*.3, `${file}: final collapse reaches the ground`);
    assert.ok(Math.abs(at('Head').x-at('pelvis').x) > standing*.2, `${file}: body settles on its side, not another kneel`);
    let lowest=Infinity;
    opponent.anchor.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();const v=new Vector3();for(let i=0;i<o.geometry.getAttribute('position').count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);lowest=Math.min(lowest,v.y);}}});
    assert.ok(lowest > -.015 && lowest < .045, `${file}: body rests on sand without sinking or floating, lowest vertex ${lowest}`);
    const held = at('Head').clone();
    for(let i=0;i<180;i++) opponent.update(0, 1/30, 'quietOne', 1);
    assert.ok(at('Head').distanceTo(held)<1e-4, 'held corpse does not loop');
    sample(0); opponent.update(0,.1,'ready');
    assert.equal(opponent.anchor.getObjectByName('Head')!.scale.x, 1, 'head remains intact');
  }
});

test('Opened cuts each shipped humanoid at the waist, keeps its materials, grounds both halves and restores cleanly', async () => {
  for (const file of FIGHTERS) {
    const asset = await readWarrior(file), weapon = WEAPON_OF[file];
    const {opponent,player} = buildWarriors(asset,undefined,[weapon,weapon]);
    const placed = new Group(); placed.position.set(5,0,-4); placed.rotation.y=.8; placed.add(opponent.anchor);
    const root = opponent.anchor.children[0], original = new Map();
    root.traverse(o=>{if(o instanceof Mesh)original.set(o.geometry,o.geometry.getAttribute('position').array.slice());});
    opponent.update(0,.1,'opened',.045);
    opponent.openWaist(.045,'off'); assert.equal(opponent.anchor.getObjectByName('Opened'),undefined);
    const before=performance.now(); opponent.prepareOpened();
    assert.equal(root.visible,true,'preparing does not hide the live opponent');
    assert.equal(opponent.anchor.getObjectByName('Opened'),undefined,'prepared parts stay outside the live scene');
    opponent.openWaist(.045,'red');
    const opened=opponent.anchor.getObjectByName('Opened')!;
    assert.ok(opened, file); assert.equal(opened.children.length,3); assert.equal(root.visible,false);
    console.log(`${file}: waist bake ${Math.round(performance.now()-before)} ms`);
    const legs=opened.children[0], torso=opened.children[1];
    for(const half of opened.children.slice(0,2)) {
      assert.ok(half.children.some(o=>o.name==='WaistCut'),'both cut surfaces are closed');
      assert.ok(new Box3().setFromObject(half).getSize(new Vector3()).length()>.3);
    }
    const initialLegs=legs.quaternion.clone(); opponent.openWaist(.28,'red');
    assert.ok(torso.position.x>.1*SCALE[file],'torso slides off the waist during the held beat');
    assert.ok(legs.quaternion.angleTo(initialLegs)<1e-8,'legs stand briefly after the torso starts moving');
    for(const progress of [.4,.66,.84,1]) {
      opponent.openWaist(progress,'red'); placed.updateMatrixWorld(true);
      for(const half of opened.children.slice(0,2)) {
        const box=new Box3().setFromObject(half,true);
        assert.ok(box.min.y>-.012,`${file} ${half.name}: no floor penetration at ${progress} (${box.min.y})`);
        if(progress===1) {
          assert.ok(box.min.y<.04,`${file}: both halves rest on sand`);
          const cut=half.children.find(o=>o.name==='WaistCut')!;
          const bodyOnly=new Box3();for(const part of half.children)if(!part.userData.openedWeapon)bodyOnly.expandByObject(part,true);
          assert.ok(bodyOnly.min.y<.04,'body itself reaches the floor');
          const cutHeight=new Box3().setFromObject(cut,true).getCenter(new Vector3()).y;
          assert.ok(cutHeight<(half.name==='OpenedLegs' ? .3 : .4)*SCALE[file]+.05,`${file} ${half.name}: severed waist itself settles rather than balancing high on a limb (${cutHeight})`);
        }
      }
    }
    const fleshBox=new Box3(); for(const part of torso.children)if(!part.userData.openedWeapon)fleshBox.expandByObject(part,true);
    assert.ok(fleshBox.min.y<.04 && fleshBox.min.y>-.012,`${file}: the torso itself rests on sand, not floating on its weapon`);
    const killer={x:placed.position.x+Math.sin(.8)*1.9,z:placed.position.z+Math.cos(.8)*1.9};
    const cameraPose=finisherSidePose(killer,{x:placed.position.x,z:placed.position.z},393/852,'opened');
    const camera=new PerspectiveCamera(51,393/852,.1,180);camera.position.set(cameraPose.x,cameraPose.y,cameraPose.z);camera.lookAt(cameraPose.lookX,cameraPose.lookY,cameraPose.lookZ);camera.updateMatrixWorld();
    for(const half of opened.children.slice(0,2)) {
      const b=new Box3().setFromObject(half,true);
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]) {
        const p=new Vector3(x,y,z).project(camera);
        assert.ok(Math.abs(p.x)<.975 && p.y>-.64 && p.y<.95,`${file}: whole ${half.name} inside portrait (${p.x},${p.y})`);
      }
    }
    const dropped=opened.getObjectByName('OpenedWeapon')!;const weaponBox=new Box3().setFromObject(dropped,true);
    assert.ok(weaponBox.min.y>-.012 && weaponBox.max.y<.5*SCALE[file],`${file}: released weapon lies flat on the sand (${weaponBox.min.y},${weaponBox.max.y})`);
    const held=opened.children.map(o=>[...o.position.toArray(),...o.quaternion.toArray()]);
    opponent.update(0,.1,'opened',1); opponent.openWaist(1,'dark');
    assert.deepEqual(opened.children.map(o=>[...o.position.toArray(),...o.quaternion.toArray()]),held,'final pose holds');
    opponent.openWaist(1,'off');assert.equal(root.visible,true);assert.equal(opened.visible,false);
    opponent.openWaist(1,'red');assert.equal(root.visible,false);assert.equal(opened.visible,true);
    opponent.update(0,.1,'death',1); assert.equal(opened.visible,false); assert.equal(root.visible,true,'changing the journal pick cannot leave an invisible opponent');
    opponent.update(0,.1,'opened',1); opponent.openWaist(1,'red');
    assert.equal(player.anchor.getObjectByName('Opened'),undefined);
    for(const [geometry,array] of original)assert.deepEqual(geometry.getAttribute('position').array,array,'borrowed source geometry stays intact');
    let disposed=0; (torso.children[0] as Mesh).geometry.addEventListener('dispose',()=>disposed++);
    opponent.unsever();assert.equal(disposed,1);assert.equal(root.visible,true);assert.equal(opponent.anchor.getObjectByName('Opened'),undefined);
    // Enabling gore only after the finish must use the same canonical cut, not sever an already folded pose.
    opponent.update(0,.1,'opened',1);opponent.openWaist(1,'red');
    assert.deepEqual(opponent.anchor.getObjectByName('Opened')!.children.map(o=>[...o.position.toArray(),...o.quaternion.toArray()]),held);
    opponent.unsever();
  }
});

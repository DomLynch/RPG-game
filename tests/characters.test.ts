import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Box3, Vector3, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { SWORD } from '../src/combat.ts';
import { CLIPS, COMBAT_CLIPS, gaitWeights } from '../src/characters.ts';

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
async function readWarrior() {
  const bytes = readFileSync(new URL('../src/assets/warrior.glb', import.meta.url));
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

test('shipped skinned warrior has finite poses, grounded walk and bounded running flight', async () => {
  const asset = await readWarrior();
  assert.deepEqual(asset.animations.map(a => a.name), [...CLIPS, ...COMBAT_CLIPS]);
  const mixer = new AnimationMixer(asset.scene), point = new Vector3();
  let triangles = 0;
  asset.scene.traverse(o => { if (o instanceof SkinnedMesh) triangles += o.geometry.index!.count / 3; });
  assert.ok(triangles < 40000, `Per-character triangle count: ${triangles}`);
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
      assert.ok(bounds.min.y >= -.03, `${clip.name}: underground foot ${bounds.min.y}`);
      assert.ok(bounds.min.y < (clip.name === 'Idle' || clip.name === 'Walk' ? .06 : .32), `${clip.name}: floating ${bounds.min.y}`);
      assert.ok(bounds.max.y < 1.87 && bounds.max.y > 1.4);
      assert.ok(bounds.max.x - bounds.min.x < 1.5 && bounds.max.z - bounds.min.z < 1.6);
    }
    action.stop();
  }
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
  mixer.clipAction(clip).play(); mixer.setTime(clip.duration * SWORD.contact / SWORD.recovery);
  asset.scene.updateMatrixWorld(true);
  const tip = asset.scene.getObjectByName('SwordDrawn')!.localToWorld(new Vector3(0, .86, 0));
  assert.ok(tip.z > .9 && tip.z <= SWORD.reach + .1 && Math.abs(tip.x) < .45 && tip.y > .6 && tip.y < 2, `Contact tip: ${tip.toArray()}`);
});

test('roll and guard keep the shipped body finite, above the floor and within a compact silhouette', async () => {
  const asset = await readWarrior(), mixer = new AnimationMixer(asset.scene), point = new Vector3();
  for (const name of ['Roll', 'Guard']) {
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
      assert.ok(bounds.max.y < 2.2, `${name} height: ${bounds.max.y}`);
      assert.ok(bounds.getSize(point).length() < 3.5, `${name} silhouette: ${point.toArray()}`);
    }
    action.stop();
  }
});

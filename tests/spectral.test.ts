import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, SkinnedMesh, BufferGeometry, MeshStandardMaterial, Points } from 'three';
import { spectralAppearance } from '../src/spectral.ts';

test('only Wraith gets a private transparent material; death fades and rematch restores it', () => {
  const root = new Group(), shared = new MeshStandardMaterial(), body = new SkinnedMesh(new BufferGeometry(), shared);
  body.name = 'CreatureBody'; root.add(body);
  body.userData.creature = 'minotaur'; assert.equal(spectralAppearance(root), undefined);
  assert.equal(body.material, shared); assert.equal(root.children.length, 1);
  assert.deepEqual(root.scale.toArray(), [1, 1, 1]);
  body.userData.creature = 'wraith'; const update = spectralAppearance(root)!;
  assert.deepEqual(root.scale.toArray(), [1.5, 1.5, 1.5]);
  assert.notEqual(body.material, shared); assert.equal(shared.transparent, false);
  assert.equal(body.material.transparent, true); assert.equal(body.material.depthWrite, false);
  assert.equal(body.castShadow, false);
  assert.equal((root.children.find(o => o instanceof Points) as Points).geometry.attributes.position.count, 28);
  update(1 / 60, true, 1); assert.equal(body.material.opacity, 0);
  update(1 / 60, false, 0); assert.equal(body.material.opacity, .86);
  update(0, true, .5); assert(body.material.opacity > 0 && body.material.opacity < .86);
});

test('enlarged Wraith strikes stay at human torso height and reset without scale or arm drift', async () => {
  const { readFileSync } = await import('node:fs');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { Vector3 } = await import('three');
  const { buildWarriors } = await import('../src/characters.ts');
  const { attackSpecs } = await import('../src/combat.ts');
  const bytes = readFileSync(new URL('../src/assets/wraith.glb', import.meta.url)), size = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  const asset = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const actor = buildWarriors(asset, asset, ['claws', 'claws']).opponent;
  const root = actor.anchor.children[0], blade = root.getObjectByName('WeaponDrawn')!, hand = root.getObjectByName('hand_r')!;
  const grip = hand.worldToLocal(blade.getWorldPosition(new Vector3()));
  const point = () => blade.localToWorld(new Vector3(0, blade.userData.contact.to, 0));
  for (const attack of ['light', 'return', 'heavy', 'thrust', 'riposte'] as const) {
    const spec = attackSpecs('claws')[attack], contact = spec.contact / spec.recovery;
    actor.update(0, .1, 'attack', contact, attack, contact);
    const tip = point();
    assert(tip.y > .8 && tip.y < 1.6, `${attack}: strike must cross the hero torso, got ${tip.y}`);
    actor.update(0, 0, 'attack', contact, attack, contact);
    assert(point().distanceTo(tip) < 1e-6, 'hit stop cannot accumulate aim corrections');
    assert(hand.worldToLocal(blade.getWorldPosition(new Vector3())).distanceTo(grip) < 1e-6, 'weapon remains attached');
    actor.update(0, .1, 'attack', 1, attack, contact);
    actor.update(0, .1, 'guard', .5);
  }
  actor.update(0, .1, 'death', 1); actor.unsever(); actor.update(0, .1, 'ready');
  assert.deepEqual(root.scale.toArray(), [1.5, 1.5, 1.5]);
  assert.deepEqual(asset.scene.scale.toArray(), [1, 1, 1], 'source and future actors stay unmodified');
  const fresh = buildWarriors(asset, asset, ['claws', 'claws']).opponent;
  for (let i = 0; i < 30; i++) { actor.update(0, .1, 'guard', .5); fresh.update(0, .1, 'guard', .5); }
  assert(actor.boneWorld('hand_r')!.distanceTo(fresh.boneWorld('hand_r')!) < 1e-6, 'return to guard has no residual correction');
});

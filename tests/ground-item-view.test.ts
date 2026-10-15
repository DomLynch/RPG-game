// The ground-item view (ground loot slice 3): an item lies flat from its row, finished by its finish row, drawn only while shown. A stub model stands for the glb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGroundItemView, lie } from '../origins/preview/ground-item-view.ts';
import { groundLook } from '../origins/preview/ground-looks.ts';

const sword = () => {   // a blade along +Y like the equip file's WeaponDrawn, with the metal material the longsword carries
  const root = new THREE.Group(), part = new THREE.Group(); part.name = 'WeaponDrawn';
  part.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.01), new THREE.MeshStandardMaterial({ name: 'WeaponLongsword', metalness: 0.9, roughness: 0.3 })));
  root.add(part); return root;
};
const ITEM = 'item:starter.rusty-sword', URL = 'sword.glb';
const view = (scene: THREE.Scene, ground?: (x: number, z: number) => number) => createGroundItemView({ scene, loadModel: async () => sword(), assetOf: (i) => (i === ITEM ? URL : undefined), ...(ground ? { groundAt: ground } : {}) });
const settle = () => new Promise((r) => setTimeout(r, 0));

test('the rusty sword has a look row, and an item without one throws', () => {
  assert.equal(groundLook(ITEM).finish, 'rust');
  assert.throws(() => groundLook('item:no-such'), /no row/);
});

test('lie: the long axis runs along the ground, the underside sits liftM above it, centred on the origin', () => {
  const look = groundLook(ITEM), box = new THREE.Box3().setFromObject(lie(sword(), look));
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  assert.ok(size.y < 0.1, `flat (height ${size.y})`);
  assert.ok(Math.hypot(size.x, size.z) > 0.9 * look.scale, 'the blade lies along the ground');
  assert.ok(Math.abs(box.min.y - look.liftM) < 1e-6, 'underside at the lift');
  assert.ok(Math.hypot(mid.x, mid.z) < 1e-6, 'middle over the origin');
});

test('lie: the finish row rusts the blade and leaves the source material alone', () => {
  const model = sword(), source = (model.children[0]!.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const mesh = lie(model, groundLook(ITEM)).getObjectByProperty('type', 'Mesh') as THREE.Mesh, rusted = mesh.material as THREE.MeshStandardMaterial;
  assert.notEqual(rusted, source);
  assert.ok(rusted.userData.rankTint, 'a finish tint on the clone');
  assert.ok(rusted.roughness > source.roughness && rusted.metalness < source.metalness, 'duller');
  assert.equal(source.metalness, 0.9, 'the loaded model is not mutated');
});

test('show draws at the ground height, a second show moves it, hide removes it, clear empties the view', async () => {
  const scene = new THREE.Scene(), v = view(scene, (x) => x * 0.1);
  v.show('ground:a', ITEM, { x: 10, z: 4 }); assert.equal(v.anchor('ground:a'), undefined, 'not drawn until the model lands');
  await settle();
  const first = v.anchor('ground:a')!; assert.ok(Math.abs(first.x - 10) < 1e-6 && Math.abs(first.z - 4) < 1e-6 && first.y > 1);   // ground y at x=10 is 1
  v.show('ground:a', ITEM, { x: 20, z: 4 }); assert.ok(Math.abs(v.anchor('ground:a')!.x - 20) < 1e-6 && scene.children.length === 1);
  v.hide('ground:a'); assert.equal(v.anchor('ground:a'), undefined); assert.equal(scene.children.length, 0);
  v.show('ground:b', ITEM, { x: 0, z: 0 }); await settle(); v.clear(); assert.equal(scene.children.length, 0);
});

test('hidden or cleared while the model loads draws nothing; an item with no asset draws nothing', async () => {
  const scene = new THREE.Scene(), v = view(scene);
  v.show('ground:a', ITEM, { x: 0, z: 0 }); v.hide('ground:a'); await settle(); assert.equal(scene.children.length, 0);
  v.show('ground:b', ITEM, { x: 0, z: 0 }); v.clear(); await settle(); assert.equal(scene.children.length, 0);
  createGroundItemView({ scene, loadModel: async () => sword(), assetOf: () => undefined }).show('ground:c', ITEM, { x: 0, z: 0 }); await settle(); assert.equal(scene.children.length, 0);
});

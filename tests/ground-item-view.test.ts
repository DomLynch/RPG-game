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

const withoutRings = (g: THREE.Object3D) => { for (const r of g.children.filter((c) => c.name === 'ground-beam' || c.children.some((k) => k.name === 'ground-ring'))) r.removeFromParent(); return g; };

test('lie: the long axis runs along the ground, tilted up by its row, the underside liftM above it, centred on the origin', () => {
  const look = groundLook(ITEM), box = new THREE.Box3().setFromObject(withoutRings(lie(sword(), look)));
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3()), blade = 0.95 * look.scale;
  assert.ok(Math.hypot(size.x, size.z) > 0.9 * blade * Math.cos(THREE.MathUtils.degToRad(look.tiltDeg)) - 0.05, 'the blade lies along the ground');
  assert.ok(size.y < blade * Math.sin(THREE.MathUtils.degToRad(look.tiltDeg)) + 0.1, `tilted by its row only (height ${size.y})`);
  assert.ok(Math.abs(box.min.y - look.liftM) < 1e-6, 'underside at the lift');
  assert.ok(Math.hypot(mid.x, mid.z) < 1e-6, 'middle over the origin');
  const flat = new THREE.Box3().setFromObject(withoutRings(lie(sword(), { ...look, tiltDeg: 0 }))).getSize(new THREE.Vector3());
  assert.ok(flat.y < size.y && flat.y < 0.1, 'with no tilt it lies flat, and the row tilt lifts it');
});

test('lie: the pickup ring sits on the ground under the item from its row, additive and shadowless; no ring row, no ring', () => {
  const look = groundLook(ITEM), g = lie(sword(), look), rings = g.getObjectByName('ground-ring') as THREE.Mesh;
  assert.ok(look.ring && rings, 'the rusty sword has a ring row');
  const m = rings.material as THREE.MeshBasicMaterial;
  assert.equal(m.blending, THREE.AdditiveBlending); assert.equal(m.depthWrite, false); assert.ok(m.opacity > 0 && m.opacity <= look.ring.opacity);
  const b = new THREE.Box3().setFromObject(rings.parent!), size = b.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 2 * look.ring.radiusM) < 0.02 && size.y < 0.01, 'a flat ring of the row radius');
  assert.equal(lie(sword(), { ...look, ring: undefined }).getObjectByName('ground-ring'), undefined);
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

test('lie: the beam stands on the item from its row, additive, fading to black at the top; no beam row, no beam', () => {
  const look = groundLook(ITEM), beam = lie(sword(), look).getObjectByName('ground-beam') as THREE.Mesh;
  assert.ok(look.beam && beam, 'the rusty sword has a beam row');
  const m = beam.material as THREE.MeshBasicMaterial, size = new THREE.Box3().setFromObject(beam).getSize(new THREE.Vector3());
  assert.equal(m.blending, THREE.AdditiveBlending); assert.equal(m.depthWrite, false); assert.ok(m.vertexColors);
  assert.ok(Math.abs(size.y - look.beam.heightM) < 1e-6 && Math.abs(size.x - 2 * look.beam.radiusM) < 0.02, 'the row height and radius');
  const pos = beam.geometry.getAttribute('position'), col = beam.geometry.getAttribute('color');
  let top = -1, bottom = -1; for (let i = 0; i < pos.count; i++) { if (Math.abs(pos.getY(i) - look.beam.heightM) < 1e-6) top = col.getX(i); if (pos.getY(i) < 1e-6) bottom = col.getX(i); }
  assert.ok(top === 0 && bottom > 0.5, `fades from the foot (${bottom}) to nothing (${top})`);
  assert.equal(lie(sword(), { ...look, beam: undefined }).getObjectByName('ground-beam'), undefined);
});

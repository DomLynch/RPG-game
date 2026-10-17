// First-person weapon viewmodel (first-person-weapon.ts): the weapon keeps its pose relative to the eye, lifted by the offset, whichever way the hero faces; the clone is drawn on top and the original hidden.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createViewmodel, viewmodelMatrix } from './first-person-weapon.ts';

const LOOK = { metal: 0.7, rough: 0.4, skin: 0xc58b63, forearm: 0.045, fist: 0.055 };
const frame = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
const posOf = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixPosition(m);

test('the viewmodel is the weapon relative to the eye, plus the lift in the eye frame, at any heading', () => {
  for (const yaw of [0, Math.PI / 2, 2.3]) {
    const eye = frame(5, 1.6, -3, yaw), local = new THREE.Matrix4().makeTranslation(0.25, -0.7, 0.3), lift = { x: 0.05, y: 0.55, z: 0.15 };
    const weaponWorld = new THREE.Matrix4().copy(eye).multiply(local);   // the hand at the hip, in front and to the right of the eye
    const got = posOf(viewmodelMatrix(eye, weaponWorld, lift)), want = new THREE.Vector3(0.25 + lift.x, -0.7 + lift.y, 0.3 + lift.z).applyMatrix4(eye);
    assert.ok(got.distanceTo(want) < 1e-9, `yaw ${yaw}: ${got.toArray()} vs ${want.toArray()}`);
  }
});

test('the clone is added once, drawn on top with its own material, the original is hidden, and it all goes away when first person is off', () => {
  const scene = new THREE.Scene(), rig = new THREE.Group(), weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), new THREE.MeshStandardMaterial()); weapon.name = 'SwordDrawn'; rig.add(weapon); scene.add(rig);
  const vm = createViewmodel(scene), eye = frame(0, 1.6, 0, 0), lift = { right: 0.3, up: -0.3, forward: 0.55 };
  vm.update(rig, true, eye, lift, true, LOOK); vm.update(rig, true, eye, lift, true, LOOK);
  assert.equal(scene.children.length, 2, 'the rig and ONE clone'); assert.equal(weapon.visible, false);
  const clone = scene.children[1] as THREE.Mesh; assert.notEqual(clone.material, weapon.material, 'its own material'); assert.equal((clone.material as THREE.Material).depthTest, false); assert.equal(clone.renderOrder, 999);
  assert.equal((weapon.material as THREE.Material).depthTest, true, 'the original material is untouched (the creatures share these)');
  vm.update(rig, false, eye, lift, true, LOOK); assert.equal(scene.children.length, 1); assert.equal(weapon.visible, true);
});

test('at rest the weapon sits exactly at the rest spot in view (right, below, ahead of the eye) wherever the hand is, and a swing moves it by what the hand moves', () => {
  const scene = new THREE.Scene(), rig = new THREE.Group(), weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), new THREE.MeshStandardMaterial()); weapon.name = 'SwordDrawn'; rig.add(weapon); scene.add(rig);
  const vm = createViewmodel(scene), rest = { right: 0.3, up: -0.3, forward: 0.55 };
  for (const yaw of [0, 1.1]) {
    const eye = frame(2, 1.6, 4, yaw), toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(eye);
    weapon.position.copy(toWorld(-0.25, -0.7, 0.05)); weapon.updateMatrixWorld(true);   // the rig's hand at the hip: right of the eye is -x of the eye frame
    vm.update(rig, true, eye, rest, true, LOOK);
    const clone = scene.children[1]!, got = new THREE.Vector3().setFromMatrixPosition(clone.matrix), want = toWorld(-rest.right, rest.up, rest.forward);
    assert.ok(got.distanceTo(want) < 1e-6, `yaw ${yaw}: at rest ${got.toArray()} vs ${want.toArray()}`);
    weapon.position.copy(toWorld(-0.25, -0.7, 0.05 + 0.4)); weapon.updateMatrixWorld(true);   // a thrust: the hand moves 0.4 m ahead
    vm.update(rig, true, eye, rest, false, LOOK);
    const swung = new THREE.Vector3().setFromMatrixPosition(scene.children[1]!.matrix), forward = toWorld(-rest.right, rest.up, rest.forward + 0.4);
    assert.ok(swung.distanceTo(forward) < 1e-6, `yaw ${yaw}: swing ${swung.toArray()} vs ${forward.toArray()}`);
  }
});

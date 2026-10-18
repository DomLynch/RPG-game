// First-person arm (first-person-arm.ts): the two-bone IK puts the hand on a reachable target, the pole bends the elbow its way, and the weight eases between the animation and the pose.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFirstPersonArm, solveTwoBone, type ArmPose } from './first-person-arm.ts';

const arm = () => { const rig = new THREE.Group(), root = new THREE.Object3D(), mid = new THREE.Object3D(), hand = new THREE.Object3D(); root.name = 'upperarm_r'; mid.name = 'lowerarm_r'; hand.name = 'hand_r'; mid.position.set(0, -0.3, 0); hand.position.set(0, -0.28, 0); root.add(mid); mid.add(hand); rig.add(root); rig.updateMatrixWorld(true); return { rig, root, mid, hand }; };
const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

test('the hand lands on a reachable target and the elbow bends towards the pole', () => {
  const { rig, root, mid, hand } = arm(), target = new THREE.Vector3(0.3, -0.25, 0.3);
  solveTwoBone(root, mid, hand, target, new THREE.Vector3(1, -1, 0)); rig.updateMatrixWorld(true);
  assert.ok(at(hand).distanceTo(target) < 1e-3, `hand ${at(hand).toArray()} vs target ${target.toArray()}`);
  assert.ok(Math.abs(at(mid).distanceTo(at(root)) - 0.3) < 1e-6 && Math.abs(at(hand).distanceTo(at(mid)) - 0.28) < 1e-6, 'the bones keep their lengths');
  const toward = at(mid).sub(target.clone().multiplyScalar(0.5)); assert.ok(toward.x > 0 && toward.y < 0, `the elbow is pushed right and down: ${toward.toArray()}`);
});

test('a target out of reach is reached as far as the arm goes, in its direction', () => {
  const { rig, root, mid, hand } = arm(), far = new THREE.Vector3(0, -2, 1);
  solveTwoBone(root, mid, hand, far, new THREE.Vector3(1, 0, 0)); rig.updateMatrixWorld(true);
  assert.ok(Math.abs(at(hand).length() - 0.58) < 0.01 && at(hand).normalize().dot(far.clone().normalize()) > 0.999, `fully stretched towards it: ${at(hand).toArray()}`);
});

const POSE: ArmPose = { handRight: -0.2, handUp: -0.25, handForward: 0.3, poleRight: 0.7, poleUp: -0.9, poleForward: -0.2, bladeRight: -0.3, bladeUp: 0.8, bladeForward: 0.5, rate: 8 };

test('the weight eases in while the hero is ready and back out when he swings; the animation is untouched at weight 0', () => {
  const { rig, root, hand } = arm(), fp = createFirstPersonArm(), eye = new THREE.Matrix4(), animation = root.quaternion.clone();
  fp.update(1 / 60, rig, true, eye, false, POSE); assert.ok(root.quaternion.angleTo(animation) < 1e-9, 'swinging: the animation as it was');
  for (let i = 0; i < 120; i++) fp.update(1 / 60, rig, true, eye, true, POSE); rig.updateMatrixWorld(true);
  const target = new THREE.Vector3(0.2, -0.25, 0.3); assert.ok(at(hand).distanceTo(target) < 0.01, `ready: the hand is at the ready spot ${at(hand).toArray()}`);
  root.quaternion.copy(animation); hand.quaternion.identity();   // the next frame's animation
  for (let i = 0; i < 240; i++) { root.quaternion.copy(animation); fp.update(1 / 60, rig, true, eye, false, POSE); }
  assert.ok(root.quaternion.angleTo(animation) < 1e-2, 'after a swing starts the weight is back at 0');
  root.quaternion.copy(animation); fp.update(1 / 60, rig, false, eye, true, POSE); assert.ok(root.quaternion.angleTo(animation) < 1e-9, 'third person: never touched');
});

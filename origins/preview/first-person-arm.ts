// First person with the hero's OWN arm, hand and sword (zone sandbox, Dom 2026-10-17: "why build custom things? we have the character: the arms, the hands, the real weapons"). The hero's skinned mesh is shown
// as it is (his head collapsed so the eye is not inside it); while he is idle his right arm is posed by a two-bone IK to a first-person ready pose (hand low at the lower right, blade up and forward), and when he swings
// the real attack animation takes over again (blended by weight, so there is no pop). Nothing is cloned or drawn by hand. Run it each frame AFTER the rig's animation and BEFORE the render. Pure: no DOM.
import * as THREE from 'three';

/** The ready pose, all in the eye frame (right, up, ahead of the eye; negative = left, down, behind): where the hand goes, which way the elbow bends (the pole), which way the blade points, and how fast the weight eases. */
export type ArmPose = { handRight: number; handUp: number; handForward: number; poleRight: number; poleUp: number; poleForward: number; bladeRight: number; bladeUp: number; bladeForward: number; rate: number };

const wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), dq = new THREE.Quaternion();

/** Turn `bone` about its own origin so the direction `from` (world) becomes `to` (world); the bone's children follow. */
export function aimBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
  dq.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  bone.getWorldQuaternion(wq); wq.premultiply(dq);
  if (bone.parent) { bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(wq)); } else bone.quaternion.copy(wq);
  bone.updateWorldMatrix(false, true);
}

/** Two-bone IK: put `end` on `target` (as far as the arm reaches) with the middle joint pushed towards `pole`. Roots at `root`. */
export function solveTwoBone(root: THREE.Object3D, mid: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3): void {
  root.updateWorldMatrix(true, true);
  const R = root.getWorldPosition(new THREE.Vector3()), M = mid.getWorldPosition(new THREE.Vector3()), H = end.getWorldPosition(new THREE.Vector3());
  const a = R.distanceTo(M), b = M.distanceTo(H), toT = target.clone().sub(R), d = Math.min(Math.max(toT.length(), Math.abs(a - b) + 1e-3), a + b - 1e-3), dir = toT.normalize();
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(a * a - x * x, 0));
  const ortho = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))); if (ortho.lengthSq() < 1e-9) ortho.set(0, -1, 0).sub(dir.clone().multiplyScalar(-dir.y)); ortho.normalize();
  const Mt = R.clone().add(dir.clone().multiplyScalar(x)).add(ortho.multiplyScalar(h)), Tt = R.clone().add(dir.clone().multiplyScalar(d));
  aimBone(root, M.clone().sub(R), Mt.clone().sub(R));
  const M2 = mid.getWorldPosition(new THREE.Vector3()), H2 = end.getWorldPosition(new THREE.Vector3());
  aimBone(mid, H2.clone().sub(M2), Tt.clone().sub(M2));
}

export function createFirstPersonArm() {
  let w = 0;   // 0 = the rig's own animation, 1 = the ready pose
  return {
    /** `dt`: seconds; `rig`: the hero's anchor; `on`: first person is selected; `eye`: the eye frame (position at the head, rotation = heading about Y); `ready`: the hero is between swings; `pose`: the rows. */
    update(dt: number, rig: THREE.Object3D | undefined, on: boolean, eye: THREE.Matrix4, ready: boolean, pose: ArmPose): void {
      w += (on && ready ? 1 - w : -w) * (1 - Math.exp(-dt * pose.rate));
      const root = rig?.getObjectByName('upperarm_r'), mid = rig?.getObjectByName('lowerarm_r'), hand = rig?.getObjectByName('hand_r'), sword = rig?.getObjectByName('SwordDrawn');
      if (!on || w < 0.002 || !root || !mid || !hand) return;
      rig!.updateWorldMatrix(true, true);
      const saved = [root, mid, hand].map((b) => b.quaternion.clone());   // the animation's pose this frame
      const eq = new THREE.Quaternion().setFromRotationMatrix(eye);
      const target = new THREE.Vector3(-pose.handRight, pose.handUp, pose.handForward).applyMatrix4(eye), pole = new THREE.Vector3(-pose.poleRight, pose.poleUp, pose.poleForward).applyQuaternion(eq);   // right is -x in the eye frame
      solveTwoBone(root, mid, hand, target, pole);
      if (sword) {   // turn the hand so the blade points the way the pose says
        sword.updateWorldMatrix(true, false);
        const blade = new THREE.Vector3(0, 1, 0).transformDirection(sword.matrixWorld), want = new THREE.Vector3(-pose.bladeRight, pose.bladeUp, pose.bladeForward).applyQuaternion(eq).normalize();
        aimBone(hand, blade, want);
      }
      [root, mid, hand].forEach((b, i) => { const ik = b.quaternion.clone(); b.quaternion.copy(saved[i]!).slerp(ik, w); });   // ease between the animation and the pose
      root.updateWorldMatrix(false, true);
    },
  };
}

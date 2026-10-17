// The first-person weapon and arm (zone sandbox, Dom 2026-10-17: "the weapon is see-through, the wrong position, the hand floats: 4 out of 10, get it to 8"). The hero is ONE skinned model, so in first person his
// sword hand sits at the hip below the frame. The donors draw a separate viewmodel (OpenMW: arm meshes in their own render bin with a depth clear; Luanti: the wielded item drawn apart). Here:
//  - the weapon the rig carries (`SwordDrawn`) is CLONED into the scene at the pose it has relative to the eye, shifted so the resting hand sits at `rest` in view; every swing moves it by what the animation moves the
//    hand; it is drawn on top (no depth test, a late render order), so a foe at arm's length or a wall never swallows it; the blade's metal is eased (a fully metallic blade with no environment map renders black and
//    "see-through" against a dark foe);
//  - the hero's own body is not drawn (his hand floated detached in the corner; the bones still animate) and a forearm and fist are drawn instead from the grip back towards where the rig's elbow is, so the hand is joined to the sword;
//  - the sword's trail strip is hidden (a big translucent quad in front of the lens).
// The original sword is hidden while the clone is shown. Pure matrix part in `viewmodelMatrix` (tested).
import * as THREE from 'three';

/** World matrix of the viewmodel: E (the eye frame: the head, yaw only) times a lift in that frame times the weapon's pose relative to the eye. */
export function viewmodelMatrix(eye: THREE.Matrix4, weaponWorld: THREE.Matrix4, lift: { x: number; y: number; z: number }): THREE.Matrix4 {
  const rel = new THREE.Matrix4().copy(eye).invert().multiply(weaponWorld);   // the weapon in the eye's frame
  return new THREE.Matrix4().copy(eye).multiply(new THREE.Matrix4().makeTranslation(lift.x, lift.y, lift.z)).multiply(rel);
}

/** Where the weapon rests in view, in the eye frame (modern first-person games, Oblivion Remastered, Avowed, KCD2, show the weapon held low at the lower right ALL the time): metres right of, above (negative = below) and ahead of the eye. */
export type Rest = { right: number; up: number; forward: number };
/** How the clone looks (rows fp.*): the blade metalness and roughness it is eased to, and the skin tone and radii of the forearm and fist. */
export type Look = { metal: number; rough: number; skin: number; forearm: number; fist: number };

export function createViewmodel(scene: THREE.Scene) {
  const hidden: THREE.Object3D[] = [];   // the hero's skinned meshes hidden while first person is on
  let source: THREE.Object3D | null = null, vm: THREE.Object3D | null = null, restAt: THREE.Vector3 | null = null, arm: THREE.Mesh | null = null, fist: THREE.Mesh | null = null;   // restAt: where the rig's hand holds the weapon at rest, in the eye frame
  const lift = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const drop = (rig?: THREE.Object3D) => {
    if (vm) { scene.remove(vm); vm.traverse((o) => { const m = (o as THREE.Mesh).material; if (m && !Array.isArray(m)) m.dispose(); }); }
    if (source) source.visible = true;
    vm = null; source = null; arm = null; fist = null; restAt = null;
    for (const m of hidden) m.visible = true; hidden.length = 0;
    if (rig) { const trail = rig.getObjectByName('WeaponTrail'); if (trail) trail.visible = true; }
  };
  return {
    /** For a check from the page (originsPreview.fpWeapon()): is a clone up, is it shown, where is it (world) and where the rest pose was taken. */
    debug: () => ({ up: !!vm, shown: !!vm?.visible, at: vm ? new THREE.Vector3().setFromMatrixPosition(vm.matrix).toArray().map((n) => +n.toFixed(2)) : null, rest: restAt ? restAt.toArray().map((n) => +n.toFixed(2)) : null }),
    /** Call each frame. `rig`: the hero's anchor; `on`: first person is selected; `eye`: the eye frame (position at the head, rotation = heading about Y); `rest`: where the weapon should rest in view; `ready`: the hero is between swings (his hand is at rest NOW, so that pose is remembered); `look`: the materials. */
    update(rig: THREE.Object3D | undefined, on: boolean, eye: THREE.Matrix4, rest: Rest, ready: boolean, look: Look): void {
      const weapon = on && rig ? rig.getObjectByName('SwordDrawn') ?? null : null;
      if (!weapon || !rig) { drop(rig); return; }
      rig.traverse((o) => { const sk = o as THREE.SkinnedMesh; if (sk.isSkinnedMesh && sk.visible) { sk.visible = false; hidden.push(sk); } });   // the hero's own body is not drawn (OpenMW and WoWee do the same): its detached hand floated in the corner; the bones still animate, so the sword and the elbow below still follow every swing
      const trail = rig.getObjectByName('WeaponTrail'); if (trail) trail.visible = false;
      if (weapon !== source) {   // first time, or the hero changed weapon: build the clone (its own materials: drawn on top without touching what the creatures share)
        drop(rig); source = weapon; vm = weapon.clone(true);
        vm.traverse((o) => {
          const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
          const mat = (Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material).clone() as THREE.MeshStandardMaterial;
          if (mat.metalness > look.metal) mat.metalness = look.metal; if (mat.roughness > look.rough) mat.roughness = look.rough;   // not a black mirror
          mat.depthTest = false; mesh.material = mat; mesh.renderOrder = 999; mesh.frustumCulled = false; mesh.castShadow = false;
        });
        const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.75, metalness: 0, depthTest: false });
        arm = new THREE.Mesh(new THREE.CapsuleGeometry(look.forearm, 1, 6, 12), skin); fist = new THREE.Mesh(new THREE.SphereGeometry(look.fist, 14, 10), skin);
        for (const m of [arm, fist]) { m.renderOrder = 998; m.frustumCulled = false; m.castShadow = false; vm.add(m); }
        vm.matrixAutoUpdate = false; vm.visible = false; scene.add(vm);
      }
      weapon.updateWorldMatrix(true, false); source!.visible = false;
      const eyeInv = new THREE.Matrix4().copy(eye).invert(), here = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(eyeInv).multiply(weapon.matrixWorld));   // the hand in the eye frame now
      if (!restAt) { if (!ready) return; restAt = here.clone(); }   // no rest pose known yet (the first frames, or a fight that began mid-swing): show nothing rather than a guess
      else if (ready) restAt.lerp(here, 0.25);   // between swings the hand's pose is the rest pose
      lift.set(-rest.right - restAt.x, rest.up - restAt.y, rest.forward - restAt.z);   // right of a heading-yaw frame looking along +z is -x
      vm!.matrix.copy(viewmodelMatrix(eye, weapon.matrixWorld, lift)); vm!.matrixWorldNeedsUpdate = true; vm!.visible = true;
      // The forearm: from the grip (the clone's origin, where its hand is) back towards where the rig's elbow is, in the clone's own space, so it follows every swing; the fist sits on the grip.
      const elbow = rig.getObjectByName('lowerarm_r');
      if (elbow && arm && fist) {
        const e = elbow.getWorldPosition(new THREE.Vector3()), inv = new THREE.Matrix4().copy(weapon.matrixWorld).invert(), local = e.applyMatrix4(inv), len = local.length() || Number.EPSILON;
        const dir = local.clone().normalize(); arm.scale.set(1, len * 1.8, 1); arm.position.copy(dir).multiplyScalar(len * 0.9);   // long enough to leave the bottom of the frame
        arm.quaternion.setFromUnitVectors(up, dir); fist.position.set(0, 0.02, 0);
      }
    },
  };
}

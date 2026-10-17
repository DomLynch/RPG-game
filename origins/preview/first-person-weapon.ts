// The first-person weapon (zone sandbox, Dom 2026-10-17: "get the sword and arms in the view"). The hero is ONE skinned model, so in first person his sword hand sits at the hip, below the frame. The donors draw a
// separate viewmodel (OpenMW: arm meshes in their own render bin with a depth clear; Luanti: the wielded item in its own scene). Here the weapon the rig carries (the `WeaponDrawn` part under hand_r) is CLONED
// into the scene at the pose it has relative to the eye, lifted by an offset so the resting hand sits at the lower right of the view; it moves with every swing because the rig animates the original, and it is
// drawn on top (no depth test, a late render order) so a foe at arm's length or a wall never swallows it. The original is hidden while the clone is shown. Pure matrix part in `viewmodelMatrix` (tested).
import * as THREE from 'three';

/** World matrix of the viewmodel: E (the eye frame: the head, yaw only) times a lift in that frame times the weapon's pose relative to the eye. */
export function viewmodelMatrix(eye: THREE.Matrix4, weaponWorld: THREE.Matrix4, lift: { x: number; y: number; z: number }): THREE.Matrix4 {
  const rel = new THREE.Matrix4().copy(eye).invert().multiply(weaponWorld);   // the weapon in the eye's frame
  return new THREE.Matrix4().copy(eye).multiply(new THREE.Matrix4().makeTranslation(lift.x, lift.y, lift.z)).multiply(rel);
}

/** Where the weapon rests in view, in the eye frame (Dom 2026-10-17: modern first-person games, Oblivion Remastered, Avowed, KCD2, show the weapon held low at the lower right ALL the time, not only mid-swing): metres right of, above (negative = below) and ahead of the eye. */
export type Rest = { right: number; up: number; forward: number };

export function createViewmodel(scene: THREE.Scene) {
  let source: THREE.Object3D | null = null, vm: THREE.Object3D | null = null, restAt: THREE.Vector3 | null = null;   // restAt: where the rig's hand holds the weapon at rest, in the eye frame
  const lift = new THREE.Vector3();
  const drop = () => { if (vm) { scene.remove(vm); vm.traverse((o) => { const m = (o as THREE.Mesh).material; if (m && !Array.isArray(m)) m.dispose(); }); } if (source) source.visible = true; vm = null; source = null; };
  return {
    /** Call each frame. `rig`: the hero's anchor; `on`: first person is selected; `eye`: the eye frame (position at the head, rotation = heading about Y); `rest`: where the weapon should rest in view; `ready`: the hero is between swings (his hand is at rest NOW, so that pose is remembered). The lift is rest minus the remembered hand position, so the weapon sits exactly at `rest` when idle and every swing moves it by what the animation moves the hand. */
    update(rig: THREE.Object3D | undefined, on: boolean, eye: THREE.Matrix4, rest: Rest, ready: boolean): void {
      const weapon = on && rig ? rig.getObjectByName('WeaponDrawn') ?? null : null;
      if (!weapon) { drop(); restAt = null; return; }
      if (weapon !== source) {   // first time, or the hero changed weapon: build the clone (its own materials: drawn on top without touching what the creatures share)
        drop(); source = weapon; vm = weapon.clone(true);
        vm.traverse((o) => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; mesh.material = (Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material).clone(); mesh.material.depthTest = false; mesh.renderOrder = 999; mesh.frustumCulled = false; mesh.castShadow = false; });
        vm.matrixAutoUpdate = false; scene.add(vm);
      }
      weapon.updateWorldMatrix(true, false); source!.visible = false;
      const here = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(eye).invert().multiply(weapon.matrixWorld));   // the hand in the eye frame now
      if (!restAt) restAt = here.clone(); else if (ready) restAt.lerp(here, 0.25);   // between swings the hand's pose is the rest pose
      lift.set(-rest.right - restAt.x, rest.up - restAt.y, rest.forward - restAt.z);   // right of a heading-yaw frame looking along +z is -x
      vm!.matrix.copy(viewmodelMatrix(eye, weapon.matrixWorld, lift)); vm!.matrixWorldNeedsUpdate = true;
    },
  };
}

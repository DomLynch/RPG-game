import * as THREE from 'three';

// `?look=nightrim` (look test, Strategy's brief 2026-10-02): in the Night Pit only, a faint cool light from behind the pair so both fighters keep
// a readable edge against the dark. One shadowless directional light that follows the fighters' heads; nothing else in the scene is touched.
export const RIM_COLOR = '#8aa8ff', RIM_INTENSITY = 0.55;
export function createNightRim(scene: THREE.Scene, camera: THREE.Camera) {
  const light = new THREE.DirectionalLight(RIM_COLOR, RIM_INTENSITY); light.name = 'night rim'; light.castShadow = false; scene.add(light, light.target);
  const mid = new THREE.Vector3(), forward = new THREE.Vector3();
  return {
    // `heads`: each side's Head bone in world space (null while a rig loads). Behind the pair from the camera and a little to the side, low.
    update(heads: readonly [THREE.Vector3 | null, THREE.Vector3 | null]) {
      if (!heads[0] || !heads[1]) return;
      mid.addVectors(heads[0], heads[1]).multiplyScalar(0.5); mid.y = 1;
      forward.subVectors(mid, camera.position).setY(0).normalize();
      light.position.set(mid.x + forward.x * 10 - forward.z * 6, mid.y + 3, mid.z + forward.z * 10 + forward.x * 6); light.target.position.copy(mid);
    },
    dispose() { scene.remove(light, light.target); light.dispose(); }
  };
}

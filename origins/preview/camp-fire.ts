// A camp's fire as the Pit's own flame (?region=1&camps): the arena's `flames` InstancedMesh geometry and additive flame material (src/arena.ts: three crossed quads, the fat orange tongue) drawn once
// more at each camp's fire, swayed with the arena's own lean/breathe/lick formula. No new particle system, no new texture, no new light: the Exchange's braziers' point lights (main.ts `warm`, 2 on the phone
// tier, 4 on desktop) are lent to the nearest camps while the walker is out among them, so the seated figures take a soft, flickering glow, then go home. Presentation only.
import * as THREE from 'three';
import type { Camp } from './frontier-camp.ts';
import { CAMP_KIT } from './frontier-camp.ts';

const SIZE = 1.15;   // the camp's flame vs the brazier's (the quad is 1.3 x .78: this one stands about as tall as a seated member)
const REACH = 36;    // m: a camp this near the walker borrows a light
export type CampFires = { update(time: number, hero: { x: number; z: number }, lights: readonly THREE.PointLight[]): void };

export function campFires(scene: THREE.Scene, camps: readonly Camp[]): CampFires | null {
  const pit = scene.getObjectByName('flames') as THREE.InstancedMesh | undefined;
  if (!pit || !camps.length) return null;
  const flames = new THREE.InstancedMesh(pit.geometry, pit.material, camps.length); flames.name = 'camp-flames'; flames.castShadow = flames.receiveShadow = false; flames.frustumCulled = false; scene.add(flames);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), euler = new THREE.Euler();
  const home = new Map<THREE.PointLight, THREE.Vector3>();
  return {
    update(time, hero, lights) {
      camps.forEach((c, k) => {   // the arena's formula (arena.ts update): a slow lean, a counter-rotation, a breathe, a small fast lick
        const lean = 0.13 * Math.sin(time * 2.2 + k * 1.7) + 0.05 * Math.sin(time * 5.1 + k * 2.9), breathe = 1 + 0.06 * Math.sin(time * 2.9 + k * 2.1) + 0.04 * Math.sin(time * 7.3 + k), lick = 1 + 0.08 * Math.sin(time * 4.7 + k * 3.7);
        position.set(c.at.x, CAMP_KIT.fire.coal[1], c.at.z); quaternion.setFromEuler(euler.set(lean, k * 1.3 + time * 0.35 * (k % 2 ? 1 : -1), 0, 'YXZ')); scale.set(lick * SIZE, breathe * SIZE, lick * SIZE);
        flames.setMatrixAt(k, matrix.compose(position, quaternion, scale));
      });
      flames.instanceMatrix.needsUpdate = true;
      const near = camps.filter((c) => Math.hypot(c.at.x - hero.x, c.at.z - hero.z) < REACH).sort((a, b) => Math.hypot(a.at.x - hero.x, a.at.z - hero.z) - Math.hypot(b.at.x - hero.x, b.at.z - hero.z));
      lights.forEach((l, i) => {
        if (!home.has(l)) home.set(l, l.position.clone());
        const c = near[i];
        if (c) l.position.set(c.at.x, 1.4, c.at.z); else l.position.copy(home.get(l)!);
      });
    },
  };
}

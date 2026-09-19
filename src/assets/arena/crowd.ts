import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Distant spectators, not fighter rigs: opaque, faceted bodies share one material and five instanced meshes.
// Linear colours stay subdued under the arena's sun. The silhouettes carry the roster identity at phone size.
export const CROWD_KINDS = ['human', 'goblin', 'pitborn', 'executioner', 'nightborn'] as const;
export function spectatorGeometry(kind: typeof CROWD_KINDS[number]): THREE.BufferGeometry {
  const goblin = kind === 'goblin', brute = kind === 'pitborn', hood = kind === 'executioner', pale = kind === 'nightborn';
  const height = goblin ? 1.3 : brute ? 2.05 : hood ? 2.15 : pale ? 1.9 : 1.78;
  const width = brute ? 1.32 : hood ? 1.2 : pale ? 0.88 : 1;
  const skin = new THREE.Color(...(goblin ? [0.12, 0.13, 0.085] : brute ? [0.12, 0.085, 0.06] : hood ? [0.075, 0.043, 0.028] : pale ? [0.21, 0.22, 0.21] : [0.13, 0.085, 0.057]) as [number, number, number]);
  const cloth = new THREE.Color(...(goblin || brute ? [0.045, 0.033, 0.023] : pale || hood ? [0.021, 0.023, 0.025] : [0.028, 0.024, 0.02]) as [number, number, number]);
  const leather = new THREE.Color(0.027, 0.022, 0.019), iron = new THREE.Color(0.065, 0.061, 0.055);
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, colour: THREE.Color) => {
    g.translate(x, y, z);
    const colours = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colours.length; i += 3) colour.toArray(colours, i);
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3)); parts.push(g);
  };
  const limb = (a: [number, number, number], b: [number, number, number], top: number, bottom: number, colour: THREE.Color) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(top, bottom, d.length(), 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    const mid = start.add(end).multiplyScalar(0.5); add(g, mid.x, mid.y, mid.z, colour);
  };
  const torso = new THREE.SphereGeometry(1, 8, 5); torso.scale(0.225 * width, 0.31, 0.145);
  add(torso, 0, 1.13, 0, brute ? skin : cloth);
  const skirt = new THREE.CylinderGeometry(0.15 * width, 0.2 * width, pale || hood ? 0.65 : 0.25, 6); skirt.scale(1, 1, 0.75);
  add(skirt, 0, pale || hood ? 0.68 : 0.85, 0, cloth);
  for (const side of [-1, 1]) {
    const shoulder = side * 0.205 * width, elbow = side * 0.27 * width;
    limb([shoulder, 1.31, 0], [elbow, 1.05, 0.025], brute ? 0.075 : 0.055, 0.055, brute || goblin ? skin : cloth);
    limb([elbow, 1.05, 0.025], [side * (pale || hood ? 0.16 : 0.23) * width, pale || hood ? 0.96 : 0.83, 0.13], 0.05, 0.035, skin);
    limb([side * 0.09 * width, 0.8, 0], [side * 0.12 * width, 0.13, 0.02], 0.075, 0.047, cloth);
    add(new THREE.BoxGeometry(0.115, 0.13, 0.21), side * 0.12 * width, 0.065, 0.045, leather);
  }
  limb([0, 1.35, 0], [0, 1.47, goblin || brute ? 0.065 : 0], 0.062, 0.065, skin);
  const head = new THREE.SphereGeometry(1, 7, 4); head.scale(hood ? 0.14 : goblin ? 0.145 : 0.112, hood ? 0.2 : 0.15, 0.115);
  const faceZ = goblin || brute ? 0.07 : 0;
  add(head, 0, 1.58, faceZ, hood ? cloth : skin);
  if (!hood && !goblin && !brute) {
    const hair = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.58); hair.scale(0.115, 0.155, 0.118);
    add(hair, 0, 1.59, faceZ, leather);
  }
  if (hood) add(new THREE.BoxGeometry(0.16, 0.085, 0.035), 0, 1.54, 0.115, iron);
  if (goblin || pale) for (const side of [-1, 1]) {
    const ear = new THREE.ConeGeometry(goblin ? 0.045 : 0.023, goblin ? 0.21 : 0.085, 4); ear.rotateZ(-side * 1.05);
    add(ear, side * (goblin ? 0.19 : 0.12), 1.61, faceZ, skin);
  }
  if (brute) for (const side of [-1, 1]) add(new THREE.ConeGeometry(0.025, 0.085, 4), side * 0.06, 1.52, faceZ + 0.1, new THREE.Color(0.26, 0.23, 0.17));
  const merged = mergeGeometries(parts); for (const part of parts) part.dispose();
  merged.scale(1, height / 1.78, 1); return merged;
}

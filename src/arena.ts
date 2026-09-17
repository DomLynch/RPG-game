import * as THREE from 'three';
import type { CombatEvent } from './combat.ts';

// The arena: everything that is not a fighter, a light, the camera or an effect. Owned by the world lane.
// Contract: the playable surface is a flat circle (sim.ts RADIUS 8.55 m); nothing solid stands inside it above the floor, and
// nothing reaches inside the camera clamp (scene.ts cameraPose, 11.5 m) at fighter height. Lights, fog, tone mapping and the
// camera stay in scene.ts. `update` receives the simulation's events so the arena may react (crowd, banners); never gameplay.
export const PLAY_RADIUS = 8.55, CAMERA_CLAMP = 11.5;
export type Arena = { group: THREE.Group; update(dt: number, events: CombatEvent[]): void; dispose(): void };

export function buildArena(scene: THREE.Scene): Arena {
  const group = new THREE.Group(); group.name = 'arena'; scene.add(group);
  const stone = new THREE.MeshStandardMaterial({ color: '#878579', roughness: 0.98 });
  const darkStone = new THREE.MeshStandardMaterial({ color: '#555b56', roughness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.48 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#3c514e', roughness: 1, side: THREE.DoubleSide });
  const joint = new THREE.MeshStandardMaterial({ color: '#4f514a', roughness: 1 });
  const ringMaterial = new THREE.MeshStandardMaterial({ color: '#bba57b', metalness: 0.35, roughness: 0.7, side: THREE.DoubleSide });
  const ground = new THREE.MeshStandardMaterial({ color: '#555e50', roughness: 1 });
  const materials = [stone, darkStone, brass, cloth, joint, ringMaterial, ground];
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = object.receiveShadow = true; parent.add(object);
    return object;
  }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material = stone, parent: THREE.Object3D = group) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  // The playable surface is flat. All silhouette/detail architecture is outside it.
  mesh(new THREE.CylinderGeometry(9.5, 10, 0.5, 80), darkStone, 0, -0.28, 0);
  mesh(new THREE.CylinderGeometry(9, 9, 0.1, 80), stone, 0, -0.03, 0);
  for (let i = -8; i <= 8; i++) {
    const length = Math.sqrt(81 - i * i) * 2;
    box(length, 0.006, 0.015, 0, 0.025, i, joint);
    for (let j = -8; j <= 8; j += 2) {
      const x = j + (Math.abs(i) % 2 ? 1 : 0);
      if (Math.hypot(x, i + 0.5) < 8.6) box(0.015, 0.006, 0.96, x, 0.025, i + 0.5, joint);
    }
  }
  // The outer ring marks the play boundary; keep one visible at PLAY_RADIUS.
  for (const radius of [3.3, 8.6]) {
    const ring = mesh(new THREE.RingGeometry(radius, radius + 0.035, 96), ringMaterial, 0, 0.033, 0);
    ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  }
  mesh(new THREE.CylinderGeometry(65, 65, 1, 64), ground, 0, -1.1, 0);
  // Repeated stone bays give a recognisable, restrained courtyard silhouette.
  for (let i = 0; i < 18; i++) {
    const angle = i * Math.PI * 2 / 18;
    const bay = new THREE.Group(); group.add(bay);
    bay.position.set(Math.sin(angle) * 13.3, 0, Math.cos(angle) * 13.3); bay.rotation.y = angle;
    box(4.55, 1.3, 0.8, 0, 0.45, 0, darkStone, bay);
    box(0.7, 5.4, 0.9, -2.25, 2.5, 0, stone, bay);
    box(0.95, 0.25, 1.1, -2.25, 5.2, 0, darkStone, bay);
    box(4.5, 0.45, 0.8, 0, 4.9, 0, stone, bay);
    if (i % 3 === 0) {
      box(0.08, 3.1, 0.08, -1.3, 4, -0.8, brass, bay);
      box(1.4, 0.07, 0.07, -0.65, 5.25, -0.8, brass, bay);
      box(1.12, 2.2, 0.035, -0.66, 4.1, -0.8, cloth, bay);
      box(0.07, 1.2, 0.04, -0.66, 4.2, -0.83, brass, bay);
      box(0.6, 0.07, 0.04, -0.66, 4.5, -0.83, brass, bay);
    }
  }
  // Distant faceted terrain is atmospheric scenery, not gameplay collision.
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI * 2 / 24;
    const height = 9 + (Math.sin(i * 7.31) + 1) * 7;
    const mountain = mesh(new THREE.ConeGeometry(12 + i % 5, height, 7), darkStone, Math.sin(angle) * 65, height / 2 - 2, Math.cos(angle) * 65);
    mountain.rotation.y = i; mountain.castShadow = false;
  }
  return {
    group,
    update() { /* nothing in the courtyard moves yet; the world lane hangs crowd/banner reactions here */ },
    dispose() { group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); for (const material of materials) material.dispose(); scene.remove(group); },
  };
}

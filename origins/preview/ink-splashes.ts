// Painted blood splashes on a zone's ground under the Inkverse look (a look test, preview only): the look row's `splashes` block names the zone, the decal pictures (the game's own floor splash and pool art, src/assets/blood), how many, how big and
// where. They are plain decals named 'blood decal', so the look's red tag paints them red and nothing else about the page changes. No look, or another zone, adds nothing.
import * as THREE from 'three';
import { prng } from '../world/generate.ts';
import type { InkLook } from './inkverse.ts';

/** The decals for this look and zone, ready to add to the scene (an empty group when the row names another zone or no pictures). */
export function createInkSplashes(look: InkLook, groundAt: (x: number, z: number) => number): THREE.Group {
  const S = look.splashes, group = new THREE.Group(); group.name = 'ink splashes';
  if (!S.files.length || S.count <= 0) return group;
  const loader = new THREE.TextureLoader(), rnd = prng(S.seed), mats = S.files.map((file) => {
    const map = loader.load(new URL(`../../src/assets/blood/${file}`, import.meta.url).href); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ name: 'blood decal', map, transparent: true, opacity: S.opacity, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -look.tagPass.pull, polygonOffsetUnits: -look.tagPass.pull });
  });
  const geometry = new THREE.PlaneGeometry(1, 1), tilt = S.rotationDeg * Math.PI / 180;
  for (let i = 0; i < S.count; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * S.radiusM, x = S.cx + Math.cos(a) * r, z = S.cz + Math.sin(a) * r, size = S.sizeMinM + rnd() * (S.sizeMaxM - S.sizeMinM);
    const mesh = new THREE.Mesh(geometry, mats[Math.floor(rnd() * mats.length)]!);
    mesh.rotation.set(tilt, 0, rnd() * Math.PI * 2, 'YXZ'); mesh.scale.setScalar(size); mesh.position.set(x, groundAt(x, z) + S.lift, z);
    mesh.renderOrder = 1; mesh.frustumCulled = false; group.add(mesh);
  }
  return group;
}

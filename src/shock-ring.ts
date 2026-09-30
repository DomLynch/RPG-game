// Shock ring LOOK TEST (Lead 2026-09-30, for Dom; `?look=hitfx-ring`, not approved for build): one small, fast heat-haze-style ring at the
// blade contact point of a steel-on-steel block or parry, ~0.15 s. A pale additive sprite that grows and fades; no screen-space distortion
// pass. Without the flag this module is never fetched.
import * as THREE from 'three';

export const RING_S = 0.15, RING_FROM = 0.06, RING_TO = 0.5;   // seconds; metres across at the start and the end

export function createShockRing(scene: THREE.Scene) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - 31.5, y - 31.5) / 31.5, band = Math.max(0, 1 - Math.abs(r - 0.78) / 0.16);   // a soft band near the rim
    pixels.set([255, 246, 228, 255 * band ** 1.5], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false; sprite.renderOrder = 5;
  scene.add(sprite);
  let age = RING_S;
  const log: { at: number }[] = [];
  (globalThis as { __ring?: typeof log }).__ring = log;   // the clip recorder reads when each ring fired
  return {
    burst(at: THREE.Vector3, tick: number) { sprite.position.copy(at); age = 0; sprite.visible = true; log.push({ at: tick }); },
    update(dt: number) {
      if (!sprite.visible) return;
      age += dt;
      const k = Math.min(1, age / RING_S), ease = 1 - (1 - k) ** 2;
      sprite.scale.setScalar(RING_FROM + (RING_TO - RING_FROM) * ease);
      material.opacity = 0.55 * (1 - k);
      if (k >= 1) sprite.visible = false;
    },
  };
}

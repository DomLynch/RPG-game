import * as THREE from 'three';
import type { CombatEvent } from './duel.ts';
import type { Weapon } from './moves.ts';

// Presentation only: metal sparks for a blade meeting a blade. A few hot fragments thrown from the contact point along the blow, falling
// under gravity, bouncing once off the sand, cooling white → orange → dark as they die. Drawn unmapped (they are hotter than anything the
// tone mapper sees) as short streaks: each spark is three points along its last two frames. Readable brutality: ≤ 8 sparks, ≤ 0.4 s, nothing
// that covers a pose. Steel on steel only — the caller decides (a shaft guard, a fist, flesh: no sparks).
// Steel on steel: the strength of the sparks a contact deserves, or 0 for none. Only a block or parry of a metal blade by a blade guard
// (a shaft catching a blade, a wooden weapon, a kick, a landed blow: nothing). A parry strikes hardest, then a heavy, then a perfect block.
export const HEAVY_CLASS = new Set<string>(['heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical']);
export function clashStrength(event: CombatEvent, defender: Weapon): number {
  if ((event.type !== 'Blocked' && event.type !== 'Parried') || event.target === undefined) return 0;
  if (!['iron', 'steel', 'bronze'].includes(event.material ?? '') || defender.guard !== 'blade' || defender.material === 'wood') return 0;
  return event.type === 'Parried' ? 0.9 : HEAVY_CLASS.has(event.move ?? '') ? 0.8 : event.perfect ? 0.65 : 0.4;
}
export function createClashSparks(scene: THREE.Scene) {
  const pool = 24, trail = 4, count = pool * trail, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), sizes = new Float32Array(count);
  const life = new Float32Array(pool), span = new Float32Array(pool), velocity = new Float32Array(pool * 3), history = new Float32Array(pool * trail * 3), bounced = new Uint8Array(pool);
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const u = (x - 7.5) / 7.5, v = (y - 7.5) / 7.5, edge = Math.max(0, 1 - u * u - v * v); pixels.set([255, 255, 255, 255 * edge ** 1.2], (y * 16 + x) * 4); }
  const map = new THREE.DataTexture(pixels, 16, 16); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('sparkSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({ map, size: 0.085, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float sparkSize;').replace('gl_PointSize = size;', 'gl_PointSize = size * sparkSize;');
  };
  material.customProgramCacheKey = () => 'clash-sparks-v1';
  const points = new THREE.Points(geometry, material); points.name = 'clash sparks'; points.frustumCulled = false; points.visible = false; scene.add(points);
  let cursor = 0, seed = 1; const last = new THREE.Vector3(NaN, NaN, NaN);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };   // seeded: a capture is a capture
  return {
    // `at`: the contact point (world). `heading`: the blow's direction (the attacker's facing). `strength` 0..1 scales count, speed and life.
    burst(at: THREE.Vector3, heading: number, strength: number) {
      last.copy(at);
      const n = Math.round(4 + strength * 4), along = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      for (let j = 0; j < n; j++) {
        const p = cursor++ % pool, yaw = (random() - 0.5) * 2.6, rise = 0.5 + random() * 1.1, speed = (2.8 + random() * 3) * (0.75 + strength * 0.5);
        const side = new THREE.Vector3(along.z, 0, -along.x), dir = along.clone().multiplyScalar(0.6 + random() * 0.5).addScaledVector(side, Math.sin(yaw) * 1.2).setY(rise).normalize();
        life[p] = span[p] = 0.24 + random() * 0.16 + strength * 0.06; bounced[p] = 0;
        for (let axis = 0; axis < 3; axis++) { velocity[p * 3 + axis] = dir.getComponent(axis) * speed; for (let t = 0; t < trail; t++) history[(p * trail + t) * 3 + axis] = at.getComponent(axis); }
      }
    },
    update(dt: number) {
      if (dt <= 0) return;   // a pause (dt 0) holds the sparks; a hit-stop passes dt, and sparks fly while the fighters hold (the impact frame)
      dt = Math.min(dt, 0.1); let active = false;
      for (let p = 0; p < pool; p++) {
        life[p] = Math.max(0, life[p] - dt);
        if (life[p] <= 0) { for (let t = 0; t < trail; t++) sizes[p * trail + t] = 0; continue; }
        active = true;
        for (let t = trail - 1; t > 0; t--) for (let axis = 0; axis < 3; axis++) history[(p * trail + t) * 3 + axis] = history[(p * trail + t - 1) * 3 + axis];
        velocity[p * 3 + 1] -= 9.8 * dt;
        for (let axis = 0; axis < 3; axis++) history[p * trail * 3 + axis] += velocity[p * 3 + axis] * dt;
        if (history[p * trail * 3 + 1] < 0.01 && velocity[p * 3 + 1] < 0) {   // one bounce off the sand, then it dies there
          history[p * trail * 3 + 1] = 0.01; velocity[p * 3 + 1] *= bounced[p] ? 0 : -0.35; velocity[p * 3] *= 0.6; velocity[p * 3 + 2] *= 0.6;
          if (bounced[p]) life[p] = Math.min(life[p], 0.05); bounced[p] = 1;
        }
        const heat = life[p] / span[p];   // 1 = white-hot, 0 = out
        for (let t = 0; t < trail; t++) {
          const i = p * trail + t, fade = heat * (1 - t * 0.22);
          positions.set([history[i * 3], history[i * 3 + 1], history[i * 3 + 2]], i * 3);
          colors.set([Math.min(1, fade * 1.6), fade * fade * 0.85 + fade * 0.1, fade * fade * fade * 0.5], i * 3);
          sizes[i] = (0.55 + heat * 0.75) * (1 - t * 0.2);
        }
      }
      if (active) for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;   // nothing to upload once the last spark is out
      points.visible = active;
    },
    alive(): number { let n = 0; for (let p = 0; p < pool; p++) if (life[p] > 0) n++; return n; },
    last(): [number, number, number] { return [last.x, last.y, last.z]; },   // debug probe: where the latest burst was born
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); map.dispose(); },
  };
}

import * as THREE from 'three';

// Presentation only: a small, fixed pool at descending foot plants. No idle haze or motion trails.
export function createFootDust(scene: THREE.Scene) {
  const count = 48, lifetime = 1, positions = new Float32Array(count * 3), fades = new Float32Array(count), sizes = new Float32Array(count);
  const life = new Float32Array(count), velocity = new Float32Array(count * 3), previous: (THREE.Vector3 | null)[] = [], cooldown: number[] = [];
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const u = (x - 15.5) / 15.5, v = (y - 15.5) / 15.5, edge = Math.max(0, 1 - u * u - v * v), i = (y * 32 + x) * 4;
    pixels.set([255, 255, 255, 255 * edge ** 1.5 * (0.65 + 0.35 * Math.sin(x * 0.9 + Math.sin(y * 0.6)) ** 2)], i);
  }
  const map = new THREE.DataTexture(pixels, 32, 32); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('dustFade', new THREE.BufferAttribute(fades, 1)); geometry.setAttribute('dustSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({ map, color: '#b99a68', size: 0.52, opacity: 0.6, transparent: true, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float dustFade; attribute float dustSize; varying float dustAlpha;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * dustSize; dustAlpha = dustFade;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float dustAlpha;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= dustAlpha;');
  };
  material.customProgramCacheKey = () => 'foot-dust-v1';
  const points = new THREE.Points(geometry, material); points.name = 'foot dust'; points.frustumCulled = false; points.visible = false; scene.add(points);
  let cursor = 0;
  return {
    update(dt: number, feet: readonly (THREE.Vector3 | null)[], moving: readonly boolean[]) {
      if (dt <= 0) return; // hit-stop and pause hold both contacts and particles
      dt = Math.min(dt, 0.1);
      feet.forEach((foot, i) => {
        cooldown[i] = Math.max(0, (cooldown[i] || 0) - dt);
        const old = previous[i];
        if (foot && old && moving[i] && cooldown[i] === 0 && foot.y < 0.18 && foot.y < old.y - 0.0005 && foot.distanceTo(old) < 0.3) {
          cooldown[i] = 0.28;
          for (let j = 0; j < 5; j++) {
            const p = cursor++ % count, angle = cursor * 2.4;
            life[p] = lifetime; sizes[p] = 0.65;
            positions[p * 3] = foot.x + Math.sin(angle) * 0.075; positions[p * 3 + 1] = 0.035; positions[p * 3 + 2] = foot.z + Math.cos(angle) * 0.075;
            velocity[p * 3] = Math.sin(angle) * 0.32; velocity[p * 3 + 1] = 0.14; velocity[p * 3 + 2] = Math.cos(angle) * 0.32;
          }
        }
        previous[i] = foot ? (old ?? new THREE.Vector3()).copy(foot) : null;
      });
      let active = false;
      for (let p = 0; p < count; p++) {
        life[p] = Math.max(0, life[p] - dt); const age = lifetime - life[p];
        fades[p] = Math.min(1, age / 0.06) * (life[p] / lifetime) ** 0.7; sizes[p] = 0.65 + age * 0.6;
        if (life[p] > 0) {
          active = true;
          const turn = dt * (p % 2 ? 1.8 : -1.8), c = Math.cos(turn), s = Math.sin(turn), drag = Math.exp(-dt * 1.1), x = velocity[p * 3], z = velocity[p * 3 + 2];
          velocity[p * 3] = (x * c - z * s) * drag; velocity[p * 3 + 2] = (x * s + z * c) * drag;
          for (let axis = 0; axis < 3; axis++) positions[p * 3 + axis] += velocity[p * 3 + axis] * dt;
        }
      }
      points.visible = active;
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    },
    dispose() { scene.remove(points); geometry.dispose(); material.dispose(); map.dispose(); }
  };
}

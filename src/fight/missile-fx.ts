import * as THREE from 'three';
import type { Fighter } from './duel.ts';
import { missileOf } from './sandbox-rules.ts';

// sandbox-mech: missiles, the bolt in flight. A small cold core with a soft halo and a short fading trail, drawn from the fighter's `missile` state (position by tick along its line), so it always matches the sim's arrival. Presentation only:
// it reads the duel, never changes it, allocates once, draws nothing while no missile is in flight (so with no missile rows this file draws nothing).
const HEIGHT = 1.2, TRAIL = 3, TRAIL_GAP = 0.22;   // metres
export function createMissileFx(scene: THREE.Scene) {
  const n = 64, pixels = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x - (n - 1) / 2, y - (n - 1) / 2) / ((n - 1) / 2); pixels.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 2], (y * n + x) * 4); }
  const glow = new THREE.DataTexture(pixels, n, n); glow.needsUpdate = true; glow.magFilter = glow.minFilter = THREE.LinearFilter;
  const sprite = (size: number, color: string, opacity: number) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); s.visible = false; s.frustumCulled = false; scene.add(s); return s; };
  const bolts = [0, 1].map(() => ({ core: sprite(0.2, '#e8f3ff', 1), halo: sprite(0.65, '#6aa8ff', 0.55), trail: Array.from({ length: TRAIL }, (_, k) => sprite(0.4 - k * 0.08, '#6aa8ff', 0.4 - k * 0.1)) }));
  return {
    update(tick: number, fighters: readonly Pick<Fighter, 'missile' | 'weapon'>[]): void {
      fighters.forEach((f, i) => {
        const b = bolts[i]!, m = f.missile, live = !!m && tick < m.arrives;
        b.core.visible = b.halo.visible = live; for (const t of b.trail) t.visible = live;
        if (!m || !live) return;
        const tint = missileOf(f.weapon)?.tint;   // the row's colour for this weapon's bolt (staff blue, arrow tan, crossbow bolt amber)
        if (tint) { (b.halo.material as THREE.SpriteMaterial).color.set(tint); for (const t of b.trail) (t.material as THREE.SpriteMaterial).color.set(tint); }
        const along = m.range * Math.min(1, Math.max(0, (tick - m.launched) / Math.max(1, m.arrives - m.launched)));
        b.core.position.set(m.x + m.dx * along, HEIGHT, m.z + m.dz * along); b.halo.position.copy(b.core.position);
        b.trail.forEach((t, k) => { const back = Math.max(0, along - (k + 1) * TRAIL_GAP); t.position.set(m.x + m.dx * back, HEIGHT, m.z + m.dz * back); });
      });
    },
  };
}

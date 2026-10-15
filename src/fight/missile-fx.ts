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
  // Bow arrow / crossbow bolt: a simple shaft + head + fins mesh (staff keeps the white orb). One per fighter, pointing along the flight line; shapes are rows-free presentation only.
  const SHAPE = { bow: { len: 0.95, r: 0.013, shaft: '#c9a46a', head: '#b8bcc4', fin: '#e8e2d0' }, crossbow: { len: 0.48, r: 0.024, shaft: '#4a4038', head: '#9aa0a8', fin: '#2a2420' } } as const;
  const shafts = [0, 1].map(() => {
    const g = new THREE.Group(), mat = (c: string) => new THREE.MeshBasicMaterial({ color: c });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat('#fff')), head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), mat('#fff')), fins = [0, 1].map(() => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide })));
    fins[1]!.rotation.x = Math.PI / 2;   // two crossed fins at the tail
    g.add(shaft, head, ...fins); g.visible = false; scene.add(g); return { g, shaft, head, fins };
  });
  const dress = (s: (typeof shafts)[number], kind: 'bow' | 'crossbow') => {
    const k = SHAPE[kind], headLen = k.r * 6;
    s.shaft.scale.set(k.r, k.len, k.r); s.shaft.rotation.z = Math.PI / 2; (s.shaft.material as THREE.MeshBasicMaterial).color.set(k.shaft);   // lies along +x
    s.head.scale.set(k.r * 2, headLen, k.r * 2); s.head.rotation.z = -Math.PI / 2; s.head.position.x = k.len / 2 + headLen / 2; (s.head.material as THREE.MeshBasicMaterial).color.set(k.head);
    s.fins.forEach((f) => { f.scale.set(k.r * 9, k.r * 9, 1); f.position.x = -k.len / 2 + k.r * 5; (f.material as THREE.MeshBasicMaterial).color.set(k.fin); });
  };
  const dressed = [undefined, undefined] as (string | undefined)[];
  return {
    update(tick: number, fighters: readonly Pick<Fighter, 'missile' | 'weapon'>[]): void {
      fighters.forEach((f, i) => {
        const b = bolts[i]!, m = f.missile, live = !!m && tick < m.arrives;
        const kind = missileOf(f.weapon)?.kind, arrow = kind === 'bow' || kind === 'crossbow' ? kind : undefined, sh = shafts[i]!;
        b.core.visible = live && !arrow; b.halo.visible = live; for (const t of b.trail) t.visible = live; sh.g.visible = live && !!arrow;
        if (!m || !live) return;
        if (arrow && dressed[i] !== arrow) { dress(sh, arrow); dressed[i] = arrow; }
        const tint = missileOf(f.weapon)?.tint;   // the row's colour for this weapon's bolt (staff blue, arrow tan, crossbow bolt amber)
        if (tint) { (b.halo.material as THREE.SpriteMaterial).color.set(tint); for (const t of b.trail) (t.material as THREE.SpriteMaterial).color.set(tint); }
        const along = m.range * Math.min(1, Math.max(0, (tick - m.launched) / Math.max(1, m.arrives - m.launched)));
        b.core.position.set(m.x + m.dx * along, HEIGHT, m.z + m.dz * along); b.halo.position.copy(b.core.position);
        sh.g.position.set(b.core.position.x, HEIGHT, b.core.position.z); sh.g.rotation.y = Math.atan2(-m.dz, m.dx);
        if (arrow) b.halo.scale.setScalar(0.3);
        b.trail.forEach((t, k) => { const back = Math.max(0, along - (k + 1) * TRAIL_GAP); t.position.set(m.x + m.dx * back, HEIGHT, m.z + m.dz * back); });
      });
    },
  };
}

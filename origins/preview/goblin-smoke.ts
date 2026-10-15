// The smoking fires' smoke (?look=goblin, World lane): a column of soft translucent sprites per fire, each rising, widening and fading on its own phase. View only (no sim, no record); the fires' places
// come from the kit (goblin-field.ts) and every number is a row (smokeCount, smokeRise, smokeSpeed, smokeSize0/1, smokeOpacity). `smokePuff` is pure and tested.
import * as THREE from 'three';
import { goblinRule as R } from '../world/goblin-field-rules.ts';

/** One puff's state at clock t (s): its height above the fire, size and opacity, from its place in the column (0..1). Rises, widens and fades in then out. Pure. */
export function smokePuff(t: number, slot: number) {
  const p = ((t * R('smokeSpeed')) / R('smokeRise') + slot) % 1;   // 0 at the embers, 1 at the top of the column
  return { p, y: 0.4 + p * R('smokeRise'), size: R('smokeSize0') + (R('smokeSize1') - R('smokeSize0')) * p, opacity: R('smokeOpacity') * Math.sin(Math.PI * Math.min(1, p * 1.15)), drift: p * 1.6 };
}

export function createGoblinSmoke(scene: THREE.Scene, fires: readonly { x: number; z: number }[]) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(120,108,100,0.9)'); grad.addColorStop(1, 'rgba(120,108,100,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), group = new THREE.Group(); group.name = 'goblin-smoke'; scene.add(group);
  const puffs = fires.flatMap((f, fi) => Array.from({ length: R('smokeCount') }, (_, i) => { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }), s = new THREE.Sprite(m); group.add(s); return { s, m, f, slot: (i + fi * 0.37) / R('smokeCount') }; }));
  let t = 0;
  return { group, update(dt: number) { t += dt; for (const q of puffs) { const p = smokePuff(t, q.slot); q.s.position.set(q.f.x + p.drift, p.y, q.f.z); q.s.scale.setScalar(p.size); q.m.opacity = p.opacity; } }, dispose() { scene.remove(group); tex.dispose(); for (const q of puffs) q.m.dispose(); } };
}

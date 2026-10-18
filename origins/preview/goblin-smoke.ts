// The smoking fires' smoke and light (?look=goblin, World lane; light: Zone sandbox): a column of soft translucent sprites per fire, each rising, widening and fading on its own phase, and a
// flickering point light per fire when the palette's torchPower is above 0. View only (no sim, no record); the fires' places come from the kit (goblin-field.ts), every number is a row
// (smokeCount, smokeRise, smokeSpeed, smokeSize0/1, smokeOpacity, smokeBase, smokeDrift, smokeFadeIn, puffCore, torch*, flicker*), the colours are the palette's. `smokePuff` is pure and tested.
import * as THREE from 'three';
import { goblinRule as R, type GoblinPalette } from '../world/goblin-field-rules.ts';

/** One puff's state at clock t (s): its height above the fire, size and opacity, from its place in the column (0..1). Rises, widens and fades in then out. Pure. */
export function smokePuff(t: number, slot: number) {
  const p = ((t * R('smokeSpeed')) / R('smokeRise') + slot) % 1;   // 0 at the embers, 1 at the top of the column
  return { p, y: R('smokeBase') + p * R('smokeRise'), size: R('smokeSize0') + (R('smokeSize1') - R('smokeSize0')) * p, opacity: R('smokeOpacity') * Math.sin(Math.PI * Math.min(1, p * R('smokeFadeIn'))), drift: p * R('smokeDrift') };
}
/** A fire light's intensity at clock t: torchPower with two slow sines beating against each other (the Exchange braziers' flicker). Pure. */
export const fireFlicker = (t: number, i: number, power: number): number => power * (1 - R('flickerDepth') + R('flickerDepth') * Math.sin(t * R('flickerFast') + i * 2.1) * Math.sin(t * R('flickerSlow') + i));

export function createGoblinSmoke(scene: THREE.Scene, fires: readonly { x: number; z: number }[], palette: GoblinPalette) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 2, 32, 32, 32), puff = new THREE.Color(palette.puff), rgb = `${Math.round(puff.r * 255)},${Math.round(puff.g * 255)},${Math.round(puff.b * 255)}`;
  grad.addColorStop(0, `rgba(${rgb},${R('puffCore')})`); grad.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), group = new THREE.Group(); group.name = 'goblin-smoke'; scene.add(group);
  const puffs = fires.flatMap((f, fi) => Array.from({ length: R('smokeCount') }, (_, i) => { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }), s = new THREE.Sprite(m); group.add(s); return { s, m, f, slot: (i + fi * 0.37) / R('smokeCount') }; }));
  const lights = palette.torchPower > 0 ? fires.map((f) => { const l = new THREE.PointLight(palette.torch, palette.torchPower, R('torchRange'), R('torchDecay')); l.position.set(f.x, R('torchY'), f.z); group.add(l); return l; }) : [];   // none at torchPower 0: the light count (and every shader program) stays as it was
  let t = 0;
  return { group, lights, update(dt: number) { t += dt; for (const q of puffs) { const p = smokePuff(t, q.slot); q.s.position.set(q.f.x + p.drift, p.y, q.f.z); q.s.scale.setScalar(p.size); q.m.opacity = p.opacity; } lights.forEach((l, i) => { l.intensity = fireFlicker(t, i, palette.torchPower); }); }, dispose() { scene.remove(group); tex.dispose(); for (const q of puffs) q.m.dispose(); for (const l of lights) l.dispose(); } };
}

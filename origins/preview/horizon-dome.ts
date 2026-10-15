// The painted horizon dome (?look=goblin, World lane): the Pit's 2D-sky trick for a zone: one canvas painting (a gradient sky, a glow on the horizon, two ridge silhouettes and a few far smoke columns)
// on the inside of a big dome that follows the camera, drawn first with no depth, so the ground's fog meets the painting's horizon colour without a line. Every colour and number is a row
// (origins/world/goblin-field-defs.json). `ridgeProfile` and `smokeColumns` are pure and tested; the painting and the mesh are browser-only (stills check them).
import * as THREE from 'three';
import { goblinRule as R, goblinSky as S } from '../world/goblin-field-rules.ts';

const mulberry = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** A closed (wraps at the seam) ridge line, n samples in 0..1: a few sine harmonics with seeded phases, whole periods per turn so the ends meet. Pure. */
export function ridgeProfile(seed: number, n: number): number[] {
  const rnd = mulberry(seed), harm = [[2, 0.5], [5, 0.3], [11, 0.15], [23, 0.07]].map(([k, a]) => ({ k: k!, a: a!, ph: rnd() * Math.PI * 2 }));
  const raw = Array.from({ length: n }, (_, i) => harm.reduce((s, h) => s + h.a * Math.sin((i / n) * Math.PI * 2 * h.k + h.ph), 0));
  const lo = Math.min(...raw), hi = Math.max(...raw);
  return raw.map((v) => (v - lo) / (hi - lo || 1));
}
/** Where the far smoke columns stand across the painting, as fractions of its width. Pure. */
export const smokeColumns = (seed: number, count: number): number[] => { const rnd = mulberry(seed ^ 0x9e3779b9); return Array.from({ length: count }, () => rnd()); };

function paint(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  const yh = (0.5 / R('domeHalf')) * h, sky = g.createLinearGradient(0, 0, 0, yh);   // the cap's top is the zenith, the horizon row is where the polar angle is 90 degrees
  sky.addColorStop(0, S('zenith')); sky.addColorStop(0.55, S('mid')); sky.addColorStop(1, S('horizon')); g.fillStyle = sky; g.fillRect(0, 0, w, yh);
  g.fillStyle = S('horizon'); g.fillRect(0, yh, w, h - yh);
  const glow = g.createRadialGradient(w * 0.3, yh, 0, w * 0.3, yh, w * 0.16); glow.addColorStop(0, S('glow')); glow.addColorStop(1, 'rgba(240,192,128,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const seed = R('ridgeSeed'), amp = R('ridgeAmp') * h, n = 256;
  const ridge = (prof: number[], colour: string, lift: number) => { g.fillStyle = colour; g.beginPath(); g.moveTo(0, yh + 2); for (let i = 0; i <= n; i++) g.lineTo((i / n) * w, yh - lift - prof[i % n]! * amp); g.lineTo(w, yh + 2); g.closePath(); g.fill(); };
  ridge(ridgeProfile(seed + 1, n), S('ridgeFar'), amp * R('ridgeFarShift')); ridge(ridgeProfile(seed, n), S('ridge'), 0);
  for (const fx of smokeColumns(seed, R('smokeColumns'))) {   // far smoke: a soft column rising from the ridge, fading with height
    const x = fx * w, col = g.createLinearGradient(0, yh - amp * 3, 0, yh - amp * 0.4); col.addColorStop(0, 'rgba(92,76,68,0)'); col.addColorStop(1, S('smoke') + 'aa'); g.fillStyle = col; g.fillRect(x - w * 0.006, yh - amp * 3, w * 0.012, amp * 2.6);
  }
  return c;
}

/** The dome: add it to the scene once; call follow(camera) each frame. dispose() frees the texture. */
export function createHorizonDome(scene: THREE.Scene) {
  const tex = new THREE.CanvasTexture(paint(R('texW'), R('texH'))); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthTest: false, depthWrite: false }), geo = new THREE.SphereGeometry(R('domeRadius'), 64, 32, 0, Math.PI * 2, 0, Math.PI * R('domeHalf'));
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'horizon-dome'; mesh.renderOrder = -1000; mesh.frustumCulled = false; scene.add(mesh);
  return { mesh, follow(camera: THREE.Camera) { mesh.position.set(camera.position.x, 0, camera.position.z); }, dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); } };
}

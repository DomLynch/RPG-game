// The goblin field's ground (?look=goblin / a zone row that sets look.sky, Zone sandbox): a richer dirt than the Frontier's grey speckle, painted from one ground row (goblin-field-defs.json grounds):
// painting-matched browns, soft blotches, wet dark patches, pebbles, cracks and grain on a texN tile, and the same tile as a bump map so the low sun picks it out. Browser-only (a canvas); every
// number and colour is the row's. The Frontier's own dirt (frontier.ts dirtMaterial) is untouched when no ground row is asked for.
import * as THREE from 'three';
import type { GoblinGround } from '../world/goblin-field-rules.ts';

export function goblinDirtMaterial(r: GoblinGround): THREE.MeshStandardMaterial {
  const N = r.texN, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d')!; let seed = r.seed;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, between = (lo: number, hi: number) => lo + (hi - lo) * rnd();
  const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  const wrapped = (draw: (ox: number, oy: number) => void) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) draw(ox, oy); };   // drawn nine times: the tile has no seam
  const soft = (hex: string, a: number, min: number, max: number, count: number) => { for (let i = 0; i < count; i++) { const x = rnd() * N, y = rnd() * N, rad = between(min, max); wrapped((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, rgba(hex, a)); gr.addColorStop(1, rgba(hex, 0)); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); }); } };
  g.fillStyle = r.base; g.fillRect(0, 0, N, N);
  soft(r.dark, 0.4, r.blotchMin, r.blotchMax, r.blotches / 2); soft(r.light, 0.35, r.blotchMin, r.blotchMax, r.blotches / 2);
  soft(r.wet, 0.55, r.wetMin, r.wetMax, r.wetPatches);   // the wet mud: dark, large, soft
  for (let i = 0; i < r.speckles; i++) { const s = between(r.speckleMin, r.speckleMax); g.fillStyle = rgba(rnd() < 0.5 ? r.dark : r.light, 0.25 + rnd() * 0.4); g.fillRect(rnd() * N, rnd() * N, s, s); }
  for (let i = 0; i < r.pebbles; i++) { const x = rnd() * N, y = rnd() * N, s = between(r.pebbleMin, r.pebbleMax); wrapped((ox, oy) => { g.fillStyle = rgba(r.dark, 0.5); g.beginPath(); g.ellipse(x + ox + s * 0.25, y + oy + s * 0.3, s, s * 0.7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = rgba(r.light, 0.6); g.beginPath(); g.ellipse(x + ox, y + oy, s, s * 0.7, 0, 0, Math.PI * 2); g.fill(); }); }   // a lit pebble on its own shadow
  g.strokeStyle = rgba(r.dark, 0.6); g.lineWidth = 1.5;
  for (let i = 0; i < r.cracks; i++) { let x = rnd() * N, y = rnd() * N; const pts: [number, number][] = [[x, y]]; for (let k = 0; k < r.crackSteps; k++) { x += (rnd() - 0.5) * r.crackStep; y += (rnd() - 0.5) * r.crackStep; pts.push([x, y]); } wrapped((ox, oy) => { g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy))); g.stroke(); }); }
  const img = g.getImageData(0, 0, N, N), px = img.data; for (let i = 0; i < px.length; i += 4) { const n = (rnd() - 0.5) * r.noise; px[i]! += n; px[i + 1]! += n * 0.8; px[i + 2]! += n * 0.6; } g.putImageData(img, 0, 0);   // grain
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2 / r.tileM, 2 / r.tileM); map.anisotropy = 8;   // piece() UVs are metres / 2: one tile per tileM metres
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: r.bump, roughness: r.roughness });
}

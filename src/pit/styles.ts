// The Pit's dressing (D3 direction a, "under the arena", Dom's pick from the 2026-09-30 look mocks): a stone vault, torch smoke, sand
// tracked in from the gate, an iron rack, cloth behind the trophies, the arena's light spilling through the bars. All in the arena's
// material set and grain (the ring's own surfaces via Stage.arenaMaterials, plus sRGB DataTextures like arena/textures.ts, generated here
// because src/pit/ may not import the arena). room.ts reads DRESSING while it builds.
import * as THREE from 'three';


const hw = 4;
// The dressing: the height, four wall torches, and the torch light's intensity.
export const DRESSING = { height: 3.4, torch: 6, sconces: [[-hw + 0.08, 2.2, -2.2], [-hw + 0.08, 2.2, 2.2], [hw - 0.08, 2.2, -2.5], [hw - 0.08, 2.2, 2.5]] as THREE.Vector3Tuple[] };

const hash = (x: number, y: number, s: number) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function texture(size: number, pixel: (x: number, y: number) => [number, number, number, number]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.set(pixel(x, y).map((v) => Math.max(0, Math.min(255, v))), (y * size + x) * 4);
  const t = new THREE.DataTexture(data, size, size);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
// Cloth: a heraldic field with a pale chevron and a fray at the hem; the base colour is the legend's (per banner).
export const clothTexture = (base: [number, number, number], seed = 9) => texture(64, (x, y) => {
  const u = x / 64, v = y / 64, weave = 0.86 + 0.14 * hash(x, y, seed), chevron = Math.abs(u - 0.5) < 0.3 - Math.abs(v - 0.45) * 0.55 && Math.abs(u - 0.5) > 0.22 - Math.abs(v - 0.45) * 0.55;
  const fray = v > 0.94 && hash(x, 0, seed + 1) > 0.5;
  const c = chevron ? [0.85, 0.8, 0.7] : base;
  return [c[0]! * 255 * weave, c[1]! * 255 * weave, c[2]! * 255 * weave, fray ? 0 : 255];
});
// A soft round puff for smoke and the light spill (alpha falls off from the centre).
export const puffTexture = (size = 32) => texture(size, (x, y) => {
  const a = Math.max(0, 1 - Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1)) ** 1.8;
  return [255, 255, 255, 255 * a];
});
// A sand patch: warm grain, densest at the middle.
export const sandTexture = (seed = 3) => texture(64, (x, y) => {
  const d = Math.hypot(x / 64 - 0.5, y / 64 - 0.5) * 2, g = 0.8 + 0.3 * hash(x, y, seed);
  return [200 * g, 175 * g, 130 * g, 255 * Math.max(0, 1 - d) ** 0.7];
});
// The vault: a barrel across x, `n` flat strips from wall to wall, rising `rise` above the wall top; UVs in metres over `tile`.
export function vaultStrips(width: number, depth: number, top: number, rise: number, n: number, tile: number): THREE.BufferGeometry[] {
  const strips: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
    const x0 = -Math.cos(a0) * width / 2, x1 = -Math.cos(a1) * width / 2, y0 = top + Math.sin(a0) * rise, y1 = top + Math.sin(a1) * rise;
    const w = Math.hypot(x1 - x0, y1 - y0), g = new THREE.PlaneGeometry(w, depth);
    const uv = g.getAttribute('uv'); for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / tile, uv.getY(k) * depth / tile);
    g.rotateX(Math.PI / 2);   // flat, facing down
    g.rotateZ(-Math.atan2(y1 - y0, x1 - x0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    strips.push(g);
  }
  return strips;
}
// A vertical fade (alpha 1 at the bottom, 0 at the top): the dark foot of a wall, a contact shadow's edge.
export const fadeTexture = (size = 32) => texture(size, (_x, y) => [0, 0, 0, 255 * (1 - (y + 0.5) / size) ** 1.6]);
// Dust in a torch's cone: `count` points inside a cone from `apex` opening downward along `dir` with half-angle `angle`, radius `reach`.
export function dustPoints(apex: THREE.Vector3Tuple, dir: THREE.Vector3, angle: number, reach: number, count: number, seed: number): THREE.BufferGeometry {
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(dir, up).normalize(), lift = new THREE.Vector3().crossVectors(side, dir).normalize();
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.sqrt(hash(i, 0, seed)) * reach, r = Math.tan(angle) * t * Math.sqrt(hash(i, 1, seed)), a = hash(i, 2, seed) * Math.PI * 2;
    const p = new THREE.Vector3(...apex).addScaledVector(dir, t).addScaledVector(side, Math.cos(a) * r).addScaledVector(lift, Math.sin(a) * r);
    positions.push(p.x, Math.max(0.05, p.y), p.z);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

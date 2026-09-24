// Scratch: rain fragments blended per frame on the phone canvas (375x812 CSS at the game's 1.25 cap = 469x1015), fight lock camera at the start.
// node rainfill.ts <repoRoot>   — counts screen-clipped sprite/quad area; the GPU blends every one of those fragments (alpha 0 or not).
import * as THREE from 'three';
const root = process.argv[2];
const { hash } = await import(`${root}/src/assets/arena/textures.ts`);
const { cameraPose } = await import(`${root}/src/camera.ts`);
const { initialState, TARGET } = await import(`${root}/src/sim.ts`);
const W = 469, H = 1015, TAU = Math.PI * 2, count = 1500;
const state = initialState(), yaw = Math.atan2(state.x - TARGET.x, state.z - TARGET.z), pose = cameraPose(state, yaw, 0.45, true, TARGET);
const camera = new THREE.PerspectiveCamera(51, W / H, 0.1, 180); camera.position.set(pose.x, pose.y, pose.z); camera.lookAt(pose.lookX, 0.8, pose.lookZ); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
const k = 1 / Math.tan(THREE.MathUtils.degToRad(51) / 2);   // world metres → NDC per metre of depth
function drop(i: number, t: number) {
  const a = hash(i, 0, 61) * TAU, r = Math.sqrt(hash(i, 1, 61)) * 11, y0 = hash(i, 2, 61) * 8, ph = hash(i, 3, 61) * TAU, sp = 0.5 + hash(i, 4, 61);
  const y = (((y0 - t * 9 * (0.8 + 0.3 * sp) + ph) % 8) + 8) % 8;
  return new THREE.Vector3(r * Math.sin(a) + 0.12 * y, y, r * Math.cos(a));
}
const clipArea = (cx: number, cy: number, w: number, h: number) => Math.max(0, Math.min(W, cx + w / 2) - Math.max(0, cx - w / 2)) * Math.max(0, Math.min(H, cy + h / 2) - Math.max(0, cy - h / 2));
export function fill(kind: 'points' | 'quads', size: number, width: number, n = count) {
  let total = 0, drawn = 0; const frames = 30;
  for (let f = 0; f < frames; f++) for (let i = 0; i < n; i++) {
    const p = drop(i, f * 0.137), v = p.clone().applyMatrix4(camera.matrixWorldInverse), depth = -v.z;
    if (depth < 0.1) continue;
    const ndc = p.clone().project(camera), cx = (ndc.x + 1) / 2 * W, cy = (1 - ndc.y) / 2 * H;
    const a = kind === 'points' ? (s => clipArea(cx, cy, s, s))(Math.min(511, size * (H / 2) / depth)) : clipArea(cx, cy, width * k * (H / 2) / depth, size * k * (H / 2) / depth);
    if (a > 0) drawn++; total += a;
  }
  return { fragments: Math.round(total / frames), screens: +(total / frames / (W * H)).toFixed(2), onScreen: Math.round(drawn / frames) };
}
console.log('points 0.5 (trunk):', fill('points', 0.5, 0));
console.log('quads  L .233 w .028:', fill('quads', 0.233, 0.028));

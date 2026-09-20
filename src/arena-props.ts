import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { budgetTextures } from './quality.ts';
// Asset URLs the way scene.ts resolves the rigs (an expression, so Node tests can import this module without a bundler).
const url = (file: string) => new URL(`./assets/arena/props/${file}.glb`, import.meta.url).href;
const portcullisUrl = url('portcullis'), rackUrl = url('weapon-rack'), shieldUrl = url('shield'), drumUrl = url('column-drum'), bonesUrl = url('bone-pile');

// Authored arena props (presentation lane, 2026-09-20): generated with TRELLIS.2 from prompted reference images, decimated and
// re-textured in Blender (artifacts/presentation/props-v1), loaded after the procedural arena so nothing waits on them. Each entry
// carries the GLB's unit size so tests/arena-props.test.ts can hold the placement to the arena contract without loading a file:
// nothing inside the play circle, nothing 0.5–6 m high inside the camera clamp (11.5 m). `size` is the unscaled [w, h, d] in metres.
export type ArenaProp = { id: string; url: string; size: [number, number, number]; r: number; angle: number; y: number; yaw: number; pitch?: number; scale: number; replaces?: 'gateBars' };
export const PROPS: readonly ArenaProp[] = [
  { id: 'portcullis', url: portcullisUrl, size: [1, 0.82, 0.15], r: 12.15, angle: Math.PI, y: 1.31, yaw: Math.PI, scale: 3.2, replaces: 'gateBars' },   // the gate's lattice, 3.2 m wide
  { id: 'weapon-rack', url: rackUrl, size: [0.5, 0.99, 0.31], r: 12.1, angle: Math.PI + 0.7, y: 2.6 + 0.745, yaw: Math.PI + 0.7 + Math.PI / 2, scale: 1.5 },   // on the wall walkway beside the gate
  { id: 'shield', url: shieldUrl, size: [0.94, 1, 0.26], r: 9.7, angle: 0.62, y: 0.115, yaw: 0.62, pitch: -Math.PI / 2, scale: 0.9 },   // lying face up in the sand band
  { id: 'column-drum', url: drumUrl, size: [0.81, 0.78, 1.01], r: 10.9, angle: 2.35, y: 0.235, yaw: 2.35 + 0.6, scale: 0.6 },              // a fallen drum, on its side
  { id: 'bone-pile', url: bonesUrl, size: [0.99, 0.52, 0.99], r: 10.4, angle: 4.55, y: 0.21, yaw: 4.55, scale: 0.8 },                        // half-buried
];
// World-space extent of a placed prop: its scaled box, the horizontal reach taken as the box's diagonal (the yaw makes the exact
// footprint irrelevant to the contract). A pitched prop swaps its height for its depth.
export function extent(p: ArenaProp): { rMin: number; yMin: number; yMax: number } {
  const [w, h, d] = p.size, height = (p.pitch ? d : h) * p.scale, depth = (p.pitch ? h : d) * p.scale, width = w * p.scale;
  // The reach toward the centre: a prop laid along the wall (yaw = its angle, mod π) reaches by its depth, one set across by its width,
  // anything else by its diagonal.
  const turn = ((p.yaw - p.angle) % Math.PI + Math.PI) % Math.PI, along = turn < 1e-6 || Math.PI - turn < 1e-6, across = Math.abs(turn - Math.PI / 2) < 1e-6;
  const reach = (along ? depth : across ? width : Math.hypot(width, depth)) / 2;
  return { rMin: p.r - reach, yMin: p.y - height / 2, yMax: p.y + height / 2 };
}

export function loadArenaProps(group: THREE.Group, phone: boolean, replaced: (what: NonNullable<ArenaProp['replaces']>) => void) {
  const roots: THREE.Object3D[] = [];
  let disposed = false;
  // Props are presentation: without a document (Node tests) there is nothing to decode them into, and a prop that fails to load leaves
  // the procedural arena standing (the bars stay until the portcullis really arrives). Never a thrown error out of the arena.
  if (typeof document === 'undefined') return { ready: Promise.resolve(), dispose() { disposed = true; } };
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ready = Promise.all(PROPS.map(async (p) => {
    const gltf = await loader.loadAsync(p.url).catch((error: unknown) => { console.warn(`arena prop ${p.id} did not load`, error); return null; });
    if (!gltf || disposed) return;
    const root = gltf.scene; root.name = `prop ${p.id}`;
    root.position.set(p.r * Math.sin(p.angle), p.y, p.r * Math.cos(p.angle)); root.rotation.set(p.pitch ?? 0, p.yaw, 0, 'YXZ'); root.scale.setScalar(p.scale);
    root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true; const m = o.material as THREE.MeshStandardMaterial; if (m.isMeshStandardMaterial) m.envMapIntensity = 0.6; } });
    if (phone) budgetTextures(root, 512);   // the phone tier's GPU memory (quality.ts): 768² hero maps become 512²
    group.add(root); roots.push(root);
    if (p.replaces) replaced(p.replaces);
  })).then(() => undefined);
  return {
    ready,
    dispose() {
      disposed = true;
      for (const root of roots) { root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of [o.material].flat() as THREE.MeshStandardMaterial[]) { for (const t of [m.map, m.normalMap, m.metalnessMap, m.roughnessMap]) t?.dispose(); m.dispose(); } } }); group.remove(root); }
    },
  };
}

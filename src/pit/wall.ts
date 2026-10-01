// The skull wall (Strategy GO 2026-09-30, Lead's conditions): one skull per legend beaten, 10 opponents × 10 ranks, on the far wall's two
// panels either side of the gate, one row per opponent in LEGEND order (legends.ts PORTRAIT_KEYS: `<opponent>-<rank>`), ranks left to
// right. Every slot is a dark niche (the silhouette); a beaten legend's slot carries the skull. The skull is a SWAPPABLE ASSET: the
// Stage's prop('skull') (public/pit/props/skull.glb, World's / GPT's model) fills the slots when it is there; until it lands a beaten slot
// shows a bone marker in the niche, never a primitive skull (Lead: the plank + egg is not to be multiplied). One InstancedMesh each, so
// the wall is two draws whatever the count. `defeats` is read DEFENSIVELY: absent, or a key that is not a slot, means no skull.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PickTarget } from './picker.ts';
import type { SceneStage } from './stage.ts';

export type Slot = { key: string; x: number; y: number };
export const RANKS = 10;
const OPPONENTS = 10, PER_PANEL = 5;
export const PANEL = { inner: 1.7, outer: 4.5, top: 3.05, rowPitch: 0.5, colPitch: 0.28 };   // x from the gate's side (the arch is 2.8 m wide) out to the wall's corner (the room is 10 m across); rows down from the top
export const NICHE = { w: 0.2, h: 0.3, d: 0.06, lip: 0.015 };   // a carved cell proud of the wall: its lit arris, its inner sides, its dark back; the lip stays inside colPitch so cells never join into a grid
// Vertex colours, so one material draws the whole cell (Lead 2026-09-30: an EMPTY niche must read as carved stone, not a black square,
// since most players see mostly empty niches for a while). Linear values against the WALL's own tone (the ashlar map reads ~0.12 linear
// under the torch): the arris one step lighter than the wall, never a white frame (Lead's still 7cd69a29); the inner sides a shadowed
// cavity, no lit face inside the opening that could read as a pane divider; the back darkest.
const RIM: [number, number, number] = [0.14, 0.13, 0.115], SIDE: [number, number, number] = [0.06, 0.055, 0.05], BACK: [number, number, number] = [0.03, 0.028, 0.025];
export function nicheGeometry(): THREE.BufferGeometry {
  const { w, h, d, lip } = NICHE, W = w + 2 * lip, H = h + 2 * lip;
  const paint = (g: THREE.BufferGeometry, [r, gr, b]: [number, number, number]) => {
    const n = g.attributes.position!.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gr; c[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  };
  const parts = [
    paint(new THREE.PlaneGeometry(w, h).translate(0, 0, 0.004), BACK),   // the back, a hair in front of the wall plane
    paint(new THREE.PlaneGeometry(d, h).rotateY(Math.PI / 2).translate(-w / 2, 0, d / 2), SIDE),   // inner sides face inward
    paint(new THREE.PlaneGeometry(d, h).rotateY(-Math.PI / 2).translate(w / 2, 0, d / 2), SIDE),
    paint(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2).translate(0, h / 2, d / 2), SIDE),
    paint(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, -h / 2, d / 2), SIDE),   // the cell's floor, in shadow like its sides
    // The arris: four strips in the cell's front plane; the frame's outer sides back to the wall stay in shadow.
    paint(new THREE.PlaneGeometry(W, lip).translate(0, h / 2 + lip / 2, d), RIM), paint(new THREE.PlaneGeometry(W, lip).translate(0, -h / 2 - lip / 2, d), RIM),
    paint(new THREE.PlaneGeometry(lip, h).translate(-w / 2 - lip / 2, 0, d), RIM), paint(new THREE.PlaneGeometry(lip, h).translate(w / 2 + lip / 2, 0, d), RIM),
    paint(new THREE.PlaneGeometry(d, H).rotateY(-Math.PI / 2).translate(-W / 2, 0, d / 2), SIDE), paint(new THREE.PlaneGeometry(d, H).rotateY(Math.PI / 2).translate(W / 2, 0, d / 2), SIDE),
    paint(new THREE.PlaneGeometry(W, d).rotateX(-Math.PI / 2).translate(0, H / 2, d / 2), SIDE), paint(new THREE.PlaneGeometry(W, d).rotateX(Math.PI / 2).translate(0, -H / 2, d / 2), SIDE),
  ];
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}
// The 100 slots, in PORTRAIT_KEYS order: the wall's data path needs no legends import (the keys are the Stage's, tests pin the order).
export function slots(keys: readonly string[]): Slot[] {
  if (keys.length !== OPPONENTS * RANKS) throw new Error(`the skull wall wants ${OPPONENTS * RANKS} keys, got ${keys.length}`);
  return keys.map((key, i) => {
    const opponent = Math.floor(i / RANKS), rank = i % RANKS, side = opponent < PER_PANEL ? -1 : 1, row = opponent % PER_PANEL;
    const x = side * (PANEL.inner + PANEL.colPitch / 2 + rank * PANEL.colPitch), y = PANEL.top - row * PANEL.rowPitch;
    return { key, x, y };
  });
}

export type Wall = {
  targets: PickTarget<`skull:${string}`>[];
  ready: Promise<void>;   // the skull asset answered (present or not) and the first stock is placed
  restock(defeats: readonly string[] | undefined): void;   // the beaten keys now: sets which slots carry a skull
  dispose(): void;   // the wall's own geometry and materials; the asset's stay the scene's
};

export function buildWall(stage: SceneStage, group: THREE.Group, keys: readonly string[], wallZ: number, bone: THREE.Material): Wall {
  const list = slots(keys), n = list.length, z = wallZ;   // the cell stands on the wall plane and comes forward NICHE.d
  const niche = nicheGeometry(), marker = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12).rotateX(Math.PI / 2);
  const dark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const niches = new THREE.InstancedMesh(niche, dark, n);
  niches.name = 'skull-niches'; niches.receiveShadow = true;
  const m = new THREE.Matrix4();
  list.forEach((s, i) => { m.makeTranslation(s.x, s.y, z); niches.setMatrixAt(i, m); });
  niches.instanceMatrix.needsUpdate = true;
  group.add(niches);
  // The skulls: the asset's geometry when it is there, else the bone marker. Built once the asset has answered, so restock() has a mesh.
  const index = new Map(list.map((s, i) => [s.key, i] as const));
  let skulls: THREE.InstancedMesh | undefined, wanted: readonly string[] = [];
  const place = () => {
    if (!skulls) return;
    const beaten = wanted.filter((k) => index.has(k));
    beaten.forEach((k, i) => { const s = list[index.get(k)!]!; m.makeTranslation(s.x, s.y, z + NICHE.d / 2); if (skulls!.userData.fit) m.multiply(skulls!.userData.fit as THREE.Matrix4); skulls!.setMatrixAt(i, m); });
    skulls.count = beaten.length; skulls.visible = beaten.length > 0; skulls.instanceMatrix.needsUpdate = true;
  };
  // A skull that is absent, 404s or throws is no skull: the wall keeps its silhouettes and markers, and ready still resolves.
  const ready = new Promise<THREE.Mesh | null>((load) => load(stage.prop?.('skull') ?? null)).catch(() => null).then((asset) => {
    let geometry: THREE.BufferGeometry = marker, material: THREE.Material = bone;
    const fit = new THREE.Matrix4();
    if (asset) {   // fitted into the niche: centred, its largest side NICHE.w, facing the room (+z)
      geometry = asset.geometry; material = asset.material instanceof THREE.Material ? asset.material : bone;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
      const k = NICHE.w / Math.max(size.x, size.y, size.z, 1e-3);
      fit.makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));
    }
    skulls = new THREE.InstancedMesh(geometry, material, n);
    skulls.name = asset ? 'skulls' : 'skull-markers'; skulls.castShadow = !!asset; skulls.userData.fit = asset ? fit : null; skulls.userData.asset = !!asset;
    group.add(skulls);
    place();
  });
  return {
    targets: list.map((s) => ({ id: `skull:${s.key}` as const, box: new THREE.Box3(new THREE.Vector3(s.x - PANEL.colPitch / 2, s.y - PANEL.rowPitch / 2, wallZ - 0.05), new THREE.Vector3(s.x + PANEL.colPitch / 2, s.y + PANEL.rowPitch / 2, wallZ + 0.06)) })),   // thin: a slanted ray must not clip the neighbour's box first
    ready,
    restock(defeats) { wanted = Array.isArray(defeats) ? defeats.filter((k) => typeof k === 'string') : []; place(); },
    dispose() { niche.dispose(); marker.dispose(); dark.dispose(); niches.dispose(); skulls?.dispose(); },
  };
}

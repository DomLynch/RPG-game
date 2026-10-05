// The skull wall (Dom 2026-10-04, docs/briefs/pit-walls/BRIEF.md section 1): ONE wall, the far wall's right panel, 6 x 5 = 30 niches. Every kill
// (a computer opponent or a real player) hangs one skull, newest first, capped at 30. Every niche, filled or empty, is a tap target (`skull:<i>`). The skull is a SWAPPABLE ASSET: the Stage's prop('skull') (public/pit/props/skull.glb) fills
// the niches when it is there; until it lands a beaten niche shows a bone marker, never a primitive skull (Lead: the plank + egg is not to be
// multiplied). One InstancedMesh for the niches and one for the skulls, so the wall is two draws whatever the count (skulls.ts is the data).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PickTarget } from './picker.ts';
import type { SceneStage } from './stage.ts';
import type { Kills } from './skulls.ts';

export type Slot = { id: string; x: number; y: number };
const ROWS = 5, COLUMNS = 6, SLOTS = COLUMNS * ROWS;
export const PANEL = { inner: 2.3, outer: 4.7, top: 3.05, rowPitch: 0.5, colPitch: 0.24 };   // x from the gate's side (the arch is 2.8 m wide and the counterweight falls just outside it) out to the wall's corner (the room is 10 m across); rows down from the top
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
// The 30 slots: 6 columns x 5 rows from the panel's inner edge, filled row by row, newest kill first. Ids are `skull:<i>`.
export function slots(): Slot[] {
  return Array.from({ length: SLOTS }, (_, i) => ({ id: `skull:${i}`, x: PANEL.inner + PANEL.colPitch / 2 + (i % COLUMNS) * PANEL.colPitch, y: PANEL.top - Math.floor(i / COLUMNS) * PANEL.rowPitch }));
}

export type Wall = {
  targets: PickTarget<`skull:${string}`>[];
  ready: Promise<void>;   // the skull asset answered (present or not) and the first stock is placed
  restock(kills: Kills | undefined): void;   // what hangs now: a skull on the first kills.length niches (newest first)
  dispose(): void;   // the wall's own geometry and materials; the asset's stay the scene's
};

export function buildWall(stage: SceneStage, group: THREE.Group, wallZ: number, bone: THREE.Material): Wall {
  const list = slots(), n = list.length, z = wallZ;   // the cell stands on the wall plane and comes forward NICHE.d
  const niche = nicheGeometry(), marker = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12).rotateX(Math.PI / 2);
  const dark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const niches = new THREE.InstancedMesh(niche, dark, n);
  niches.name = 'skull-niches'; niches.receiveShadow = true;
  const m = new THREE.Matrix4();
  list.forEach((s, i) => { m.makeTranslation(s.x, s.y, z); niches.setMatrixAt(i, m); });
  niches.instanceMatrix.needsUpdate = true;
  group.add(niches);
  // The skulls: the asset's geometry when it is there, else the bone marker. Built once the asset has answered, so restock() has a mesh.
  let skulls: THREE.InstancedMesh | undefined, wanted: Slot[] = [];
  let disposed = false;
  const place = () => {
    if (disposed || !skulls) return;
    const beaten = wanted;
    beaten.forEach((s, i) => { m.makeTranslation(s.x, s.y, z + NICHE.d / 2); if (skulls!.userData.fit) m.multiply(skulls!.userData.fit as THREE.Matrix4); skulls!.setMatrixAt(i, m); });
    skulls.count = beaten.length; skulls.visible = beaten.length > 0; skulls.instanceMatrix.needsUpdate = true;
  };
  // A skull that is absent, 404s or throws is no skull: the wall keeps its silhouettes and markers, and ready still resolves.
  const ready = new Promise<THREE.Mesh | null>((load) => load(stage.prop?.('skull') ?? null)).catch(() => null).then((asset) => {
    if (disposed) return;   // the prop is cached by the scene; ignore it without disposing its shared resources
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
    targets: list.map((s) => ({ id: s.id as `skull:${string}`, box: new THREE.Box3(new THREE.Vector3(s.x - PANEL.colPitch / 2, s.y - PANEL.rowPitch / 2, wallZ - 0.05), new THREE.Vector3(s.x + PANEL.colPitch / 2, s.y + PANEL.rowPitch / 2, wallZ + 0.06)) })),   // thin: a slanted ray must not clip the neighbour's box first
    ready,
    restock(kills) {
      wanted = list.slice(0, Math.min(Array.isArray(kills) ? kills.length : 0, SLOTS));
      place();
    },
    dispose() { if (disposed) return; disposed = true; niche.dispose(); marker.dispose(); dark.dispose(); niches.dispose(); skulls?.dispose(); },
  };
}

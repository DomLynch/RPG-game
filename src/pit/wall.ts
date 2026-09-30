// The skull wall (Strategy GO 2026-09-30, Lead's conditions): one skull per legend beaten, 10 opponents × 10 ranks, on the far wall's two
// panels either side of the gate, one row per opponent in LEGEND order (legends.ts PORTRAIT_KEYS: `<opponent>-<rank>`), ranks left to
// right. Every slot is a dark niche (the silhouette); a beaten legend's slot carries the skull. The skull is a SWAPPABLE ASSET: the
// Stage's prop('skull') (public/pit/props/skull.glb, World's / GPT's model) fills the slots when it is there; until it lands a beaten slot
// shows a bone marker in the niche, never a primitive skull (Lead: the plank + egg is not to be multiplied). One InstancedMesh each, so
// the wall is two draws whatever the count. `defeats` is read DEFENSIVELY: absent, or a key that is not a slot, means no skull.
import * as THREE from 'three';
import type { PickTarget } from './picker.ts';
import type { SceneStage } from './stage.ts';

export type Slot = { key: string; x: number; y: number };
export const RANKS = 10;
const OPPONENTS = 10, PER_PANEL = 5;
export const PANEL = { inner: 1.35, outer: 3.75, top: 3.05, rowPitch: 0.5, colPitch: 0.24 };   // x from the gate's side out to the wall's corner; rows down from the top
export const NICHE = { w: 0.2, h: 0.3, d: 0.05 };
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
  const list = slots(keys), n = list.length, z = wallZ + NICHE.d / 2;
  const niche = new THREE.BoxGeometry(NICHE.w, NICHE.h, NICHE.d), marker = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12).rotateX(Math.PI / 2);
  const dark = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 1 });
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
    beaten.forEach((k, i) => { const s = list[index.get(k)!]!; m.makeTranslation(s.x, s.y, z + NICHE.d / 2 + 0.01); if (skulls!.userData.fit) m.multiply(skulls!.userData.fit as THREE.Matrix4); skulls!.setMatrixAt(i, m); });
    skulls.count = beaten.length; skulls.visible = beaten.length > 0; skulls.instanceMatrix.needsUpdate = true;
  };
  const ready = Promise.resolve(stage.prop?.('skull') ?? null).then((asset) => {
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
  }, () => { /* no asset: the wall stays silhouettes and markers */ });
  return {
    targets: list.map((s) => ({ id: `skull:${s.key}` as const, box: new THREE.Box3(new THREE.Vector3(s.x - PANEL.colPitch / 2, s.y - PANEL.rowPitch / 2, wallZ - 0.05), new THREE.Vector3(s.x + PANEL.colPitch / 2, s.y + PANEL.rowPitch / 2, wallZ + 0.25)) })),
    ready,
    restock(defeats) { wanted = Array.isArray(defeats) ? defeats.filter((k) => typeof k === 'string') : []; place(); },
    dispose() { niche.dispose(); marker.dispose(); dark.dispose(); niches.dispose(); skulls?.dispose(); },
  };
}

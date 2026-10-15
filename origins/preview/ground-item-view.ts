// Draws ground items (ground loot slice 3, Backend's #2775 brief): an item lying on the ground at a world point, from its own model, at the pose and finish its ground-looks.json row gives.
// Presentation only: the page's ground_state read decides WHICH rows are there (it calls show for those the server says are available, hide on a take or when the respawn window closes); this
// draws and answers where. Same seam as mobs-view: the scene, a ground height function, and a model loader the page hands in.
import * as THREE from 'three';
import { finishedAs } from '../../src/fight/rank-tint.ts';
import { groundLook, type GroundLook } from './ground-looks.ts';

export type GroundItemViewOptions = {
  scene: THREE.Scene;
  /** The model behind an asset url (a glTF scene root); called once per url. */
  loadModel: (assetUrl: string) => Promise<THREE.Object3D>;
  /** The item's asset url (its `appearance.asset` row); undefined = nothing to draw. */
  assetOf: (itemId: string) => string | undefined;
  /** The ground's height at a point (the preview's groundY); 0 on flat ground. */
  groundAt?: (x: number, z: number) => number;
};
export type GroundItemView = {
  /** Draw `itemId` lying at (x, z); a second call with the same id moves it. */
  show(id: string, itemId: string, at: { x: number; z: number }): void;
  hide(id: string): void;
  clear(): void;
  /** Where it lies (its middle, for the reach check and the tap), or undefined while it is not drawn. */
  anchor(id: string): { x: number; y: number; z: number } | undefined;
};

// The weapon part of a model file: its `WeaponDrawn` node (a player weapon's equip file, scripts/build-player-weapon.mjs), else the whole scene (a one-mesh shape file).
const partOf = (model: THREE.Object3D): THREE.Object3D => model.getObjectByName('WeaponDrawn') ?? model;

/** The item as it lies: a pivot at the origin whose model's long axis runs along +X, rolled and turned by the look, scaled, with its underside `liftM` above y = 0 and its middle over x = z = 0. */
export function lie(model: THREE.Object3D, look: GroundLook): THREE.Group {
  const inner = partOf(model).clone(true), holder = new THREE.Group(), pivot = new THREE.Group();
  inner.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = false; if (look.finish) o.material = Array.isArray(o.material) ? o.material.map((m) => (m instanceof THREE.MeshStandardMaterial ? finishedAs(m, look.finish!) : m)) : o.material instanceof THREE.MeshStandardMaterial ? finishedAs(o.material, look.finish) : o.material; } });
  holder.add(inner); holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  const long = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  if (long === 'y') holder.rotation.z = -Math.PI / 2; else if (long === 'z') holder.rotation.y = Math.PI / 2;
  holder.updateMatrixWorld(true);
  pivot.add(holder);
  pivot.rotation.x = THREE.MathUtils.degToRad(look.rollDeg);   // about the long axis (now +X)
  const yawed = new THREE.Group(); yawed.add(pivot); yawed.rotation.y = THREE.MathUtils.degToRad(look.yawDeg); yawed.scale.setScalar(look.scale); yawed.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(yawed), middle = box.getCenter(new THREE.Vector3());
  pivot.position.set(-middle.x, look.liftM - box.min.y, -middle.z).applyQuaternion(yawed.quaternion.clone().invert()).divideScalar(look.scale);   // the world shift, taken into the turned and scaled frame
  yawed.updateMatrixWorld(true);
  const root = new THREE.Group(); root.add(yawed);
  return root;
}

export function createGroundItemView(opts: GroundItemViewOptions): GroundItemView {
  const groundAt = opts.groundAt ?? (() => 0), models = new Map<string, Promise<THREE.Object3D>>(), drawn = new Map<string, THREE.Group>(), asked = new Map<string, number>();
  let serial = 0;
  const modelOf = (url: string) => { let m = models.get(url); if (!m) models.set(url, (m = opts.loadModel(url))); return m; };
  const place = (g: THREE.Group, at: { x: number; z: number }) => g.position.set(at.x, groundAt(at.x, at.z), at.z);
  const hide = (id: string) => { asked.delete(id); const g = drawn.get(id); if (g) { g.removeFromParent(); drawn.delete(id); } };   // free functions: the page hands them around unbound
  return {
    show(id, itemId, at) {
      const look = groundLook(itemId), url = opts.assetOf(itemId), now = drawn.get(id);
      if (now) { place(now, at); return; }
      if (!url) return;
      const ticket = ++serial; asked.set(id, ticket);
      void modelOf(url).then((model) => {
        if (asked.get(id) !== ticket) return;   // hidden or shown again while the model loaded
        const g = lie(model, look); place(g, at); g.name = id; opts.scene.add(g); drawn.set(id, g);
      }).catch(() => { models.delete(url); asked.delete(id); });   // a failed file draws nothing and may be asked again
    },
    hide,
    clear: () => { for (const id of [...drawn.keys(), ...asked.keys()]) hide(id); },
    anchor(id) { const g = drawn.get(id); if (!g) return undefined; const b = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()); return { x: b.x, y: b.y, z: b.z }; },
  };
}

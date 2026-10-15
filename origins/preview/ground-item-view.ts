// Draws ground items (ground loot slice 3, Backend's #2775 brief): an item lying on the ground at a world point, from its own model, at the pose and finish its ground-looks.json row gives.
// Presentation only: the page's ground_state read decides WHICH rows are there (it calls show for those the server says are available, hide on a take or when the respawn window closes); this
// draws and answers where. Same seam as mobs-view: the scene, a ground height function, and a model loader the page hands in.
import * as THREE from 'three';
import { finishedAs } from '../../src/fight/index.ts';
import { groundLook, type GroundBeam, type GroundLook, type GroundRing } from './ground-looks.ts';

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
// A row's `piece` is the node's name in the glb file; GLTFLoader strips the dots, brackets and slashes from node names (PropertyBinding.sanitizeNodeName), so it is looked up that way. A named piece the file lacks throws: drawing the whole file instead is a wall of armour.
const partOf = (model: THREE.Object3D, piece?: string): THREE.Object3D => {
  if (!piece) return model.getObjectByName('WeaponDrawn') ?? model;
  const found = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(piece));
  if (!found) throw new Error(`ground look: no piece "${piece}" in the model`);
  return found;
};

// An armour piece from loot.glb is a SkinnedMesh bound to the big rig, so on its own it draws at the rig's scale and offset or not at all. Lay-down needs a plain mesh: take each skinned vertex as the
// skeleton poses it (bind pose, bones at rest), keep the geometry's other attributes, drop the skin. The result is a Group of plain Meshes sharing the source materials (finishedAs clones them in lie()).
export function bakeSkinned(src: THREE.Object3D): THREE.Object3D {
  src.updateWorldMatrix(true, true);
  const meshes: THREE.SkinnedMesh[] = []; src.traverse((o) => { if (o instanceof THREE.SkinnedMesh) meshes.push(o); });
  if (!meshes.length) return src.clone(true);   // a weapon's equip file: plain meshes already
  const out = new THREE.Group(), v = new THREE.Vector3();
  for (const sm of meshes) {
    sm.skeleton.update();
    const g = sm.geometry.clone(), pos = g.getAttribute('position'), p = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); p.set([v.x, v.y, v.z], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight'); g.computeVertexNormals(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, sm.material); m.name = sm.name; out.add(m);
  }
  return out;
}

// The pickup ring: flat additive rings on the ground under the item (the bands of its row: a bright thin one and a faint wide one), so a thin object reads from the walk camera. Never casts or receives shadow.
// Everything made here is OWNED by the drawn item (`userData.owned`): hide() disposes it. The item's own meshes are not: their geometry is the loaded model's and their materials are the cached finish clones.
function ring(r: GroundRing): THREE.Group {
  const g = new THREE.Group(), color = new THREE.Color(r.color);
  for (const [inner, outer, k] of r.bands) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r.radiusM * inner, r.radiusM * outer, r.segments).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: r.opacity * k, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    m.position.y = r.liftM; m.renderOrder = 2; m.name = 'ground-ring'; m.userData.owned = true; g.add(m);
  }
  return g;
}

// The beam: a thin open cone of additive light standing on the item, bright at the foot and fading to nothing at the top (additive, so the fade is the vertex colour going to black). Owned like the ring.
function beam(b: GroundBeam): THREE.Mesh {
  const g = new THREE.CylinderGeometry(b.radiusM * b.topRatio, b.radiusM, b.heightM, b.segments, 1, true).translate(0, b.heightM / 2, 0), c = new THREE.Color(b.color), pos = g.getAttribute('position'), cols: number[] = [];
  for (let i = 0; i < pos.count; i++) { const k = Math.max(0, 1 - pos.getY(i) / b.heightM); cols.push(c.r * k, c.g * k, c.b * k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: b.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.name = 'ground-beam'; m.renderOrder = 3; m.userData.owned = true; return m;
}

// Free what a drawn item owns on the GPU (its ring and beam); never the shared model geometry or the cached finish materials its item meshes use.
function disposeOwned(g: THREE.Object3D) {
  g.traverse((o) => { if (o instanceof THREE.Mesh && o.userData.owned) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
}

/** The item as it lies: a pivot at the origin whose model's long axis runs along +X, rolled and turned by the look, scaled, with its underside `liftM` above y = 0 and its middle over x = z = 0. */
export function lie(model: THREE.Object3D, look: GroundLook): THREE.Group {
  const inner = bakeSkinned(partOf(model, look.piece)), holder = new THREE.Group(), pivot = new THREE.Group();
  inner.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = false; if (look.finish) o.material = Array.isArray(o.material) ? o.material.map((m) => (m instanceof THREE.MeshStandardMaterial ? finishedAs(m, look.finish!) : m)) : o.material instanceof THREE.MeshStandardMaterial ? finishedAs(o.material, look.finish) : o.material; } });
  holder.add(inner); holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  const long = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  if (long === 'y') holder.rotation.z = -Math.PI / 2; else if (long === 'z') holder.rotation.y = Math.PI / 2;
  holder.updateMatrixWorld(true);
  pivot.add(holder);
  pivot.rotation.x = THREE.MathUtils.degToRad(look.rollDeg);   // about the long axis (now +X)
  pivot.rotation.z = THREE.MathUtils.degToRad(look.tiltDeg);   // the long axis rises off the ground
  const yawed = new THREE.Group(); yawed.add(pivot); yawed.rotation.y = THREE.MathUtils.degToRad(look.yawDeg); yawed.scale.setScalar(look.scale); yawed.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(yawed), middle = box.getCenter(new THREE.Vector3());
  pivot.position.set(-middle.x, look.liftM - box.min.y, -middle.z).applyQuaternion(yawed.quaternion.clone().invert()).divideScalar(look.scale);   // the world shift, taken into the turned and scaled frame
  yawed.updateMatrixWorld(true);
  const root = new THREE.Group(); root.add(yawed);
  if (look.ring) root.add(ring(look.ring));
  if (look.beam) root.add(beam(look.beam));
  return root;
}

export function createGroundItemView(opts: GroundItemViewOptions): GroundItemView {
  const groundAt = opts.groundAt ?? (() => 0), models = new Map<string, Promise<THREE.Object3D>>(), drawn = new Map<string, THREE.Group>(), asked = new Map<string, number>();
  let serial = 0;
  const modelOf = (url: string) => { let m = models.get(url); if (!m) models.set(url, (m = opts.loadModel(url))); return m; };
  const place = (g: THREE.Group, at: { x: number; z: number }) => g.position.set(at.x, groundAt(at.x, at.z), at.z);
  const hide = (id: string) => { asked.delete(id); const g = drawn.get(id); if (g) { g.removeFromParent(); disposeOwned(g); drawn.delete(id); } };   // free functions: the page hands them around unbound
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

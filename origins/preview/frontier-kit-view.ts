// The kit (?region=1, World lane; ON, ?kit=0|off kills it): draws frontier-kit.ts's placements from the Characters kit, public/world/kit/zone1-kit.glb (one file, one atlas material, a mesh per node).
// One InstancedMesh per kit node, so the whole kit is at most 14 draw calls whatever the count. Which kinds cast shadows, and within what radius they cast and are drawn, are rows (kit-view.json, kit-view-rules.ts); the defaults are the old look: trees, boulders and landmarks cast, scrub and tufts do not, no radius.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Kit, KitPlacement } from './frontier-kit.ts';
import { loadZone } from '../zones/loader.ts';
import { KIT_VIEW, kitViewFor, type KitViewRule } from './kit-view-rules.ts';

export const KIT_URL = loadZone().kit.url;   // public/world: served by URL, never bundled

type Radii = { shadowRadius?: number; drawRadius?: number };
/** A preview test link, not a row: ?kitshadow=<m>&kitdraw=<m> sets both radii on every kind that casts a shadow (the frame A/B's other arm); absent = the kit-view.json rows. Pure. */
export function kitRadiusOverride(search: string = typeof location === 'undefined' ? '' : location.search): Radii {
  const q = new URLSearchParams(search), n = (k: string): number | undefined => { const v = q.get(k); return v === null || v === '' || !(Number(v) >= 0) ? undefined : Number(v); };
  return { shadowRadius: n('kitshadow'), drawRadius: n('kitdraw') };
}

// Per-instance radius state: a kind with a shadowRadius or a drawRadius keeps its full instance matrices here, and updateKitViews re-packs the near ones as the walker moves. Nothing is registered for a kind with both at 0 (today's kit).
// A kind with a far body (building-skins.json `lod: { url, dist }`, skinLod) also keeps a far InstancedMesh: instances within `dist` metres of the camera draw the full mesh, the rest draw the far one; the shadow proxy then casts the far geometry.
export type KitLod = { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material | THREE.Material[]; readonly dist: number; /** the far mesh's own matrixWorld (its node transform in the lod file; absent = the full mesh's) */ readonly matrix?: THREE.Matrix4 };
type KitView = { inst: THREE.InstancedMesh; far: THREE.InstancedMesh | null; farSrc: Float32Array | null; lodDist: number; proxy: THREE.InstancedMesh | null; src: Float32Array; xs: number[]; zs: number[]; drawR: number; shadowR: number };
const VIEWS: KitView[] = []; let lastAt: { x: number; z: number } | null = null, lastEye: { x: number; z: number } | null = null, stale = false;
const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });   // the proxy draws nothing in the picture: only the shadow pass (the depth material) reads its geometry
/** Writes the instances `keep(i)` accepts to the front of the target's matrix buffer and returns how many. */
const pack = (target: THREE.InstancedMesh, src: Float32Array, n: number, keep: (i: number) => boolean): number => {
  const arr = target.instanceMatrix.array as Float32Array, size = target.instanceMatrix.itemSize; let out = 0;   // itemSize: the floats of one instance's matrix
  for (let i = 0; i < n; i++) if (keep(i)) { arr.set(src.subarray(i * size, (i + 1) * size), out * size); out++; }
  target.instanceMatrix.needsUpdate = true; return out;
};
/** Once per frame from the page's loop: the instances within drawRadius (of the walker) are the ones drawn, the ones within shadowRadius the ones cast, and a kind with a far body draws the full mesh within its lod distance of `eye` (the camera; the walker when absent) and the far one beyond. Re-packs only after the walker moved `stepM` (a row: previewRule kitViewStepM) or a kind was added. */
export function updateKitViews(hero: { x: number; z: number }, stepM: number, eye: { x: number; z: number } = hero): void {
  if (!VIEWS.length) return;
  if (!stale && lastAt && lastEye && Math.hypot(hero.x - lastAt.x, hero.z - lastAt.z) < stepM && Math.hypot(eye.x - lastEye.x, eye.z - lastEye.z) < stepM) return;   // the eye counts too: the camera eases after the walker, so a jump of the walker leaves it behind for a moment
  lastAt = { x: hero.x, z: hero.z }; lastEye = { x: eye.x, z: eye.z }; stale = false;
  for (const v of VIEWS) {
    const n = v.xs.length, dHero = (i: number) => Math.hypot(v.xs[i] - hero.x, v.zs[i] - hero.z), dEye = (i: number) => Math.hypot(v.xs[i] - eye.x, v.zs[i] - eye.z), drawn = (i: number) => v.drawR <= 0 || dHero(i) <= v.drawR;
    if (v.far && v.farSrc) { v.inst.count = pack(v.inst, v.src, n, (i) => drawn(i) && dEye(i) <= v.lodDist); v.far.count = pack(v.far, v.farSrc, n, (i) => drawn(i) && dEye(i) > v.lodDist); }
    else if (v.drawR > 0) v.inst.count = pack(v.inst, v.src, n, drawn);
    if (v.proxy) v.proxy.userData.near = pack(v.proxy, v.farSrc ?? v.src, n, (i) => dHero(i) <= v.shadowR);   // the proxy holds the far geometry when there is one, so it takes the far matrices
  }
}

export function kitGroup(root: THREE.Object3D, kit: Pick<Kit, 'placements' | 'landmarks'>, groundAt: (x: number, z: number) => number = () => 0, opts: { rules?: readonly KitViewRule[]; override?: Radii; lods?: ReadonlyMap<string, KitLod> } = {}): THREE.Group {
  const group = new THREE.Group(); group.name = 'zone1-kit';
  const all: KitPlacement[] = [...kit.placements, ...kit.landmarks], byNode = new Map<string, KitPlacement[]>();
  for (const p of all) byNode.set(p.node, [...(byNode.get(p.node) ?? []), p]);
  root.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh, list = byNode.get(o.name);
    if (!mesh.isMesh || !list?.length) return;
    const tint = loadZone().kit.tint?.[o.name], base = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
    let material: THREE.Material | THREE.Material[] = mesh.material;
    if (tint && (base as THREE.MeshStandardMaterial).isMeshStandardMaterial) {   // the zone row's look for this node, on a clone: the model's own material (shared by the other nodes) is never touched
      const m2 = (base as THREE.MeshStandardMaterial).clone(); m2.color.setRGB(tint.color[0], tint.color[1], tint.color[2]); if (tint.roughness !== undefined) m2.roughness = tint.roughness; material = m2;
    }
    const inst = new THREE.InstancedMesh(mesh.geometry, material, list.length);
    const rule = kitViewFor(o.name, opts.rules ?? KIT_VIEW), ov = rule.castShadow ? opts.override ?? kitRadiusOverride() : {}, shadowR = ov.shadowRadius ?? rule.shadowRadius, drawR = ov.drawRadius ?? rule.drawRadius, proxied = rule.castShadow && shadowR > 0;
    inst.name = o.name; inst.castShadow = rule.castShadow && !proxied; inst.receiveShadow = true;   // a kind with a shadowRadius casts through its proxy, not itself
    const lod = opts.lods?.get(o.name) ?? null, farArr = lod ? new Float32Array(list.length * inst.instanceMatrix.itemSize) : null;
    list.forEach((p, i) => {   // the node's own transform in the file first, then the placement on the ground
      place.compose(new THREE.Vector3(p.x, groundAt(p.x, p.z) + (p.y ?? 0), p.z), q.setFromAxisAngle(up, p.rotY), new THREE.Vector3(p.scale, p.scale, p.scale));
      inst.setMatrixAt(i, m.multiplyMatrices(place, mesh.matrixWorld));
      if (lod && farArr) m.multiplyMatrices(place, lod.matrix ?? mesh.matrixWorld).toArray(farArr, i * inst.instanceMatrix.itemSize);   // the far body's own node transform (a quantized or re-baked file carries its own scale and offset in the node), then the same placement
    });
    inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); group.add(inst);
    if (drawR > 0 || proxied || lod) {
      let far: THREE.InstancedMesh | null = null, proxy: THREE.InstancedMesh | null = null;
      if (lod && farArr) {   // the far body, drawn beyond lod.dist; it is not drawn until the first update has bucketed the instances
        far = new THREE.InstancedMesh(lod.geometry, lod.material, list.length); far.name = `${o.name}__far`; far.castShadow = rule.castShadow && !proxied; far.receiveShadow = true; far.count = 0;
        far.instanceMatrix.copyArray(farArr); far.computeBoundingSphere(); group.add(far);
      }
      if (proxied) {   // only the instances near the walker cast: a second InstancedMesh (the far geometry when there is one) that is empty in the picture (count 0) and fills only for the shadow pass
        proxy = new THREE.InstancedMesh(lod?.geometry ?? mesh.geometry, SHADOW_ONLY, list.length); proxy.name = `${o.name}__shadow`; proxy.castShadow = true; proxy.receiveShadow = false; proxy.frustumCulled = false; proxy.count = 0; proxy.userData.near = 0;
        const own = proxy; own.onBeforeShadow = () => { own.count = own.userData.near as number; }; own.onAfterShadow = () => { own.count = 0; };
        group.add(proxy);
      }
      VIEWS.push({ inst, far, farSrc: farArr, lodDist: lod?.dist ?? 0, proxy, src: new Float32Array(inst.instanceMatrix.array), xs: list.map((p) => p.x), zs: list.map((p) => p.z), drawR, shadowR }); stale = true;
    }
  });
  return group;
}

export async function loadKit(kit: Pick<Kit, 'placements' | 'landmarks'>, url = KIT_URL, groundAt?: (x: number, z: number) => number): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  return kitGroup(gltf.scene, kit, groundAt);
}

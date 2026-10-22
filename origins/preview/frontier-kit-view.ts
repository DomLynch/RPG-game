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
type KitView = { inst: THREE.InstancedMesh; proxy: THREE.InstancedMesh | null; src: Float32Array; xs: number[]; zs: number[]; drawR: number; shadowR: number };
const VIEWS: KitView[] = []; let lastAt: { x: number; z: number } | null = null, stale = false;
const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });   // the proxy draws nothing in the picture: only the shadow pass (the depth material) reads its geometry
const pack = (target: THREE.InstancedMesh, src: Float32Array, xs: number[], zs: number[], hero: { x: number; z: number }, radius: number): number => {
  const arr = target.instanceMatrix.array as Float32Array, r2 = radius * radius; let n = 0;
  for (let i = 0; i < xs.length; i++) if ((xs[i] - hero.x) ** 2 + (zs[i] - hero.z) ** 2 <= r2) { arr.set(src.subarray(i * 16, i * 16 + 16), n * 16); n++; }
  target.instanceMatrix.needsUpdate = true; return n;
};
/** Once per frame from the page's loop: the instances within drawRadius are the ones drawn, the ones within shadowRadius the ones cast. Re-packs only after the walker moved `stepM` (a row: previewRule kitViewStepM) or a kind was added. */
export function updateKitViews(hero: { x: number; z: number }, stepM: number): void {
  if (!VIEWS.length) return;
  if (!stale && lastAt && Math.hypot(hero.x - lastAt.x, hero.z - lastAt.z) < stepM) return;
  lastAt = { x: hero.x, z: hero.z }; stale = false;
  for (const v of VIEWS) {
    if (v.drawR > 0) v.inst.count = pack(v.inst, v.src, v.xs, v.zs, hero, v.drawR);
    if (v.proxy) v.proxy.userData.near = pack(v.proxy, v.src, v.xs, v.zs, hero, v.shadowR);
  }
}

export function kitGroup(root: THREE.Object3D, kit: Pick<Kit, 'placements' | 'landmarks'>, groundAt: (x: number, z: number) => number = () => 0, opts: { rules?: readonly KitViewRule[]; override?: Radii } = {}): THREE.Group {
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
    list.forEach((p, i) => {   // the node's own transform in the file first, then the placement on the ground
      place.compose(new THREE.Vector3(p.x, groundAt(p.x, p.z) + (p.y ?? 0), p.z), q.setFromAxisAngle(up, p.rotY), new THREE.Vector3(p.scale, p.scale, p.scale));
      inst.setMatrixAt(i, m.multiplyMatrices(place, mesh.matrixWorld));
    });
    inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); group.add(inst);
    if (drawR > 0 || proxied) {
      let proxy: THREE.InstancedMesh | null = null;
      if (proxied) {   // only the instances near the walker cast: a second InstancedMesh on the same geometry that is empty in the picture (count 0) and fills only for the shadow pass
        proxy = new THREE.InstancedMesh(mesh.geometry, SHADOW_ONLY, list.length); proxy.name = `${o.name}__shadow`; proxy.castShadow = true; proxy.receiveShadow = false; proxy.frustumCulled = false; proxy.count = 0; proxy.userData.near = 0;
        const own = proxy; own.onBeforeShadow = () => { own.count = own.userData.near as number; }; own.onAfterShadow = () => { own.count = 0; };
        group.add(proxy);
      }
      VIEWS.push({ inst, proxy, src: new Float32Array(inst.instanceMatrix.array), xs: list.map((p) => p.x), zs: list.map((p) => p.z), drawR, shadowR }); stale = true;
    }
  });
  return group;
}

export async function loadKit(kit: Pick<Kit, 'placements' | 'landmarks'>, url = KIT_URL, groundAt?: (x: number, z: number) => number): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  return kitGroup(gltf.scene, kit, groundAt);
}

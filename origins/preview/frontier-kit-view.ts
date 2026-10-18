// The kit (?region=1, World lane; ON, ?kit=0|off kills it): draws frontier-kit.ts's placements from the Characters kit, public/world/kit/zone1-kit.glb (one file, one atlas material, a mesh per node).
// One InstancedMesh per kit node, so the whole kit is at most 14 draw calls whatever the count. Trees, boulders and landmarks cast shadows; scrub and tufts do not.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Kit, KitPlacement } from './frontier-kit.ts';
import { loadZone } from '../zones/loader.ts';
import { kitLights } from './kit-light.ts';

export const KIT_URL = loadZone().kit.url;   // public/world: served by URL, never bundled
/** The kit's address against the build's base: the zone row names it from the site root (`/world/kit/...`); a build served under /preview/<x>/ carries its own copy (vite.config.mjs zone-kits-public) and reads it there. Pure. */
export const kitUrlAt = (url: string, base: string | undefined = '/'): string => `${base.endsWith('/') ? base : `${base}/`}${url.replace(/^\//, '')}`;
const NO_SHADOW = /^(bush_|tuft_)/;

export function kitGroup(root: THREE.Object3D, kit: Pick<Kit, 'placements' | 'landmarks'>, groundAt: (x: number, z: number) => number = () => 0): THREE.Group {
  const group = new THREE.Group(); group.name = 'zone1-kit';
  const all: KitPlacement[] = [...kit.placements, ...kit.landmarks], byNode = new Map<string, KitPlacement[]>();
  for (const p of all) byNode.set(p.node, [...(byNode.get(p.node) ?? []), p]);
  root.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  root.traverse((o) => {
    const list = byNode.get(o.name);
    if (!list?.length) return;
    const origin = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);   // a prop node of several meshes (a sconce: bracket and torch under one node) draws each mesh at its place inside the node
    const meshes: THREE.Mesh[] = []; o.traverse((c) => { if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); });
    for (const mesh of meshes) {
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
      inst.name = o.name; inst.castShadow = !NO_SHADOW.test(o.name); inst.receiveShadow = true;
      const bare = mesh.matrixWorld.clone(); bare.elements[12] -= origin.x; bare.elements[13] -= origin.y; bare.elements[14] -= origin.z;   // a hand-stood piece (kit.fixed) stands where its row says: the node's authored position in the kit file (a landmark node sits 37 m off the origin) is dropped
      list.forEach((p, i) => {   // the node's own transform in the file first, then the placement on the ground
        place.compose(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z), q.setFromAxisAngle(up, p.rotY), new THREE.Vector3(p.scale, p.scale, p.scale));
        inst.setMatrixAt(i, m.multiplyMatrices(place, p.fixed ? bare : mesh.matrixWorld));
      });
      inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); group.add(inst);
    }
  });
  return group;
}

export async function loadKit(kit: Pick<Kit, 'placements' | 'landmarks'>, url = KIT_URL, groundAt?: (x: number, z: number) => number): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(kitUrlAt(url, import.meta.env?.BASE_URL));
  const group = kitGroup(gltf.scene, kit, groundAt), lights = kitLights(gltf.scene, [...kit.placements, ...kit.landmarks], groundAt);
  if (lights) group.userData.lights = lights;   // the kit's torches, read as a row (kit-light.ts): main.ts lends the page's own lights to them
  return group;
}

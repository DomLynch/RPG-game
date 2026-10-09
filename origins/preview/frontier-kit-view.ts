// The kit (?region=1, World lane; ON, ?kit=0|off kills it): draws frontier-kit.ts's placements from the Characters kit, public/world/kit/zone1-kit.glb (one file, one atlas material, a mesh per node).
// One InstancedMesh per kit node, so the whole kit is at most 14 draw calls whatever the count. Trees, boulders and landmarks cast shadows; scrub and tufts do not.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Kit, KitPlacement } from './frontier-kit.ts';
import { loadZone } from '../zones/loader.ts';

export const KIT_URL = loadZone().kit.url;   // public/world: served by URL, never bundled
const NO_SHADOW = /^(bush_|tuft_)/;

export function kitGroup(root: THREE.Object3D, kit: Pick<Kit, 'placements' | 'landmarks'>, groundAt: (x: number, z: number) => number = () => 0): THREE.Group {
  const group = new THREE.Group(); group.name = 'zone1-kit';
  const all: KitPlacement[] = [...kit.placements, ...kit.landmarks], byNode = new Map<string, KitPlacement[]>();
  for (const p of all) byNode.set(p.node, [...(byNode.get(p.node) ?? []), p]);
  root.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh, list = byNode.get(o.name);
    if (!mesh.isMesh || !list?.length) return;
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
    inst.name = o.name; inst.castShadow = !NO_SHADOW.test(o.name); inst.receiveShadow = true;
    list.forEach((p, i) => {   // the node's own transform in the file first, then the placement on the ground
      place.compose(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z), q.setFromAxisAngle(up, p.rotY), new THREE.Vector3(p.scale, p.scale, p.scale));
      inst.setMatrixAt(i, m.multiplyMatrices(place, mesh.matrixWorld));
    });
    inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); group.add(inst);
  });
  return group;
}

export async function loadKit(kit: Pick<Kit, 'placements' | 'landmarks'>, url = KIT_URL, groundAt?: (x: number, z: number) => number): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  return kitGroup(gltf.scene, kit, groundAt);
}

// A skin's model nodes on the ground (World, slice B): the frontier build lists ModelPlacements (a node, where, how turned, how scaled); each node lives in its own small file (building-skins.json models), so a
// zone fetches only the files its buildings use, and only when the zone is entered. Pure grouping here; the loader below is browser-only and reuses the kit's instancing (frontier-kit-view.ts kitGroup).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { modelOfNode, skinLod } from '../world/building-skins-rules.ts';
import type { KitPlacement } from './frontier-kit.ts';
import { kitGroup, type KitLod } from './frontier-kit-view.ts';
import type { ModelPlacement } from './frontier-skin.ts';

/** The placements by the file that holds their node (a node no model row holds is dropped: nothing to draw). Pure. */
export function placementsByFile(models: readonly ModelPlacement[]): Map<string, ModelPlacement[]> {
  const byFile = new Map<string, ModelPlacement[]>();
  for (const p of models) { const url = modelOfNode(p.node)?.url; if (url) byFile.set(url, [...(byFile.get(url) ?? []), p]); }
  return byFile;
}

/** The far bodies of these nodes (the model's `lod` row, skinLod): each lod file is fetched once, its meshes are read by node name. A node with no lod row, a failed file, or a node the file does not hold stays at full detail at every distance. */
const farFiles = new Map<string, Promise<THREE.Object3D | null>>();
export async function loadFarBodies(nodes: readonly string[]): Promise<Map<string, KitLod>> {
  const out = new Map<string, KitLod>();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('kitlod') === '0') return out;   // ?kitlod=0: full detail at every distance (the frame A/B's other arm)
  for (const node of new Set(nodes)) {
    const lod = skinLod(node); if (!lod) continue;
    if (!farFiles.has(lod.url)) farFiles.set(lod.url, new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/${lod.url}`).then((g) => g.scene, () => null));
    const scene = await farFiles.get(lod.url); if (!scene) continue;
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.position.set(0, 0, 0); });   // as the full file: a node stands at its own origin (its scale and rotation stay: a quantized file keeps its dequantizing scale there)
    scene.updateMatrixWorld(true);
    const forced = typeof location === 'undefined' ? NaN : Number(new URLSearchParams(location.search).get('kitlodist') ?? NaN);   // ?kitlodist=<m>: the swap distance for every node (a preview test link: ~0 draws every instance as its far body, to look at it up close); absent = the row
    scene.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh && mesh.name === node && !out.has(node)) out.set(node, { geometry: mesh.geometry, material: mesh.material, dist: forced >= 0 ? forced : lod.dist, matrix: mesh.matrixWorld.clone() }); });
  }
  return out;
}

/** Fetch each needed file once and stand its placements as instanced meshes. A failed file leaves its buildings undrawn, never the zone. */
export async function loadSkinModels(models: readonly ModelPlacement[], groundAt?: (x: number, z: number) => number, pace?: () => Promise<void>, loaded?: (url: string) => void): Promise<THREE.Group> {   // loaded: called with a file's url once its buildings are in the group (the Exchange hides the greybox it stood in for)
  const group = new THREE.Group(); group.name = 'skin-models';
  // pace: when given, the files go ONE AT A TIME with `await pace()` before each (the page passes a few frames), so a file's parse and instancing never lands beside another's or beside the player's first taps (Z1b: row 57 on software GL)
  const each = async <T>(items: T[], one: (item: T) => Promise<void>) => { if (!pace) return void (await Promise.all(items.map(one))); for (const item of items) { await pace(); await one(item); } };
  await each([...placementsByFile(models)], async ([url, list]) => {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/${url}`);   // public/world is served from the site root, like the kit (frontier-kit-view.ts KIT_URL), not under the preview's base
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.position.set(0, 0, 0); });   // the kit files lay their nodes in a row to look at (x offsets): a placement stands the node where the plan says, from its own origin
      group.add(kitGroup(gltf.scene,{ placements: list as unknown as KitPlacement[], landmarks: [] }, groundAt, { lods: await loadFarBodies(list.map((p) => p.node)) }));
      loaded?.(url);
    } catch { /* this file only: its buildings stay undrawn */ }
  });
  return group;
}

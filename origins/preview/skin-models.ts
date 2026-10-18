// A skin's model nodes on the ground (World, slice B): the frontier build lists ModelPlacements (a node, where, how turned, how scaled); each node lives in its own small file (building-skins.json models), so a
// zone fetches only the files its buildings use, and only when the zone is entered. Pure grouping here; the loader below is browser-only and reuses the kit's instancing (frontier-kit-view.ts kitGroup).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { modelOfNode } from '../world/building-skins-rules.ts';
import type { KitPlacement } from './frontier-kit.ts';
import { kitGroup } from './frontier-kit-view.ts';
import type { ModelPlacement } from './frontier-skin.ts';

/** The placements by the file that holds their node (a node no model row holds is dropped: nothing to draw). Pure. */
export function placementsByFile(models: readonly ModelPlacement[]): Map<string, ModelPlacement[]> {
  const byFile = new Map<string, ModelPlacement[]>();
  for (const p of models) { const url = modelOfNode(p.node)?.url; if (url) byFile.set(url, [...(byFile.get(url) ?? []), p]); }
  return byFile;
}

/** Fetch each needed file once and stand its placements as instanced meshes. A failed file leaves its buildings undrawn, never the zone. */
export async function loadSkinModels(models: readonly ModelPlacement[], groundAt?: (x: number, z: number) => number): Promise<THREE.Group> {
  const group = new THREE.Group(); group.name = 'skin-models';
  await Promise.all([...placementsByFile(models)].map(async ([url, list]) => {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/${url}`);   // public/world is served from the site root, like the kit (frontier-kit-view.ts KIT_URL), not under the preview's base
      group.add(kitGroup(gltf.scene, { placements: list as unknown as KitPlacement[], landmarks: [] }, groundAt));
    } catch { /* this file only: its buildings stay undrawn */ }
  }));
  return group;
}

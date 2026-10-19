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
export async function loadSkinModels(models: readonly ModelPlacement[], groundAt?: (x: number, z: number) => number, pace?: () => Promise<void>): Promise<THREE.Group> {
  const group = new THREE.Group(); group.name = 'skin-models';
  // pace: when given, the files go ONE AT A TIME with `await pace()` before each (the page passes a few frames), so a file's parse and instancing never lands beside another's or beside the player's first taps (Z1b: row 57 on software GL)
  const each = async <T>(items: T[], one: (item: T) => Promise<void>) => { if (!pace) return void (await Promise.all(items.map(one))); for (const item of items) { await pace(); await one(item); } };
  await each([...placementsByFile(models)], async ([url, list]) => {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/${url}`);   // public/world is served from the site root, like the kit (frontier-kit-view.ts KIT_URL), not under the preview's base
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.position.set(0, 0, 0); });   // the kit files lay their nodes in a row to look at (x offsets): a placement stands the node where the plan says, from its own origin
      group.add(kitGroup(gltf.scene,{ placements: list as unknown as KitPlacement[], landmarks: [] }, groundAt));
    } catch { /* this file only: its buildings stay undrawn */ }
  });
  return group;
}

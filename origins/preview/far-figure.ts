// The merged remote figure (Characters' #2998: hero-near.glb 2 draws / ~20k tris, hero-far.glb 2 draws / ~4.9k, both on the hero's own 65-bone rig, one vertex-colour material; today's figure is 17 draws /
// ~60k). The DEFAULT figure for every remote player (Strategy): remote-heroes.ts shows the near or the far one by distance (a row). They have no textures, so `loadWarriors` / `loadFighter` would refuse
// them (MissingTextures): each is parsed with GLTFLoader and built with `buildWarriors(asset, ..., solo)` exactly as the hero's own second actor is (main.ts secondActor). They ship NO clips (smaller
// files): they have the hero's 65 bones, so the hero's own AnimationClips are set on them and bind by bone name (`makeFigures`). A load that fails returns null and the page keeps today's rig for every
// remote (nothing is ever missing). Kits (dressRemote) stay on today's rig until Characters' per-kit merge lands.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildWarriors } from '../../src/fight/index.ts';

export type Figure = ReturnType<typeof buildWarriors>['player'];
export type Figures = { near: () => Figure; far: () => Figure };
type Asset = Parameters<typeof buildWarriors>[0];
export type FigureAssets = { near: Asset; far: Asset };

/** Parse both LODs (the page passes the two glb urls, which only the bundler can resolve; started with the hero's own load, in parallel); null when either fails. */
export async function loadFigureAssets(urls: { near: string; far: string }, load: (url: string) => Promise<Asset> = (url) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url) as Promise<Asset>): Promise<FigureAssets | null> {
  try {
    const [near, far] = await Promise.all([load(urls.near), load(urls.far)]);
    return { near, far };
  } catch (error) { console.warn('merged remote figures did not load; remotes keep the hero rig', error); return null; }
}

/** Give both LODs the hero's clips, then each call of `near()` / `far()` builds one more actor from the parsed asset (shared geometry, material and clips: no new program). */
export function makeFigures(assets: FigureAssets, animations: Asset['animations']): Figures {
  assets.near.animations = animations; assets.far.animations = animations;
  return { near: () => buildWarriors(assets.near, undefined, undefined, true).player, far: () => buildWarriors(assets.far, undefined, undefined, true).player };
}

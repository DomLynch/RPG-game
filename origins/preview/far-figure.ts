// The merged remote figure (Characters' #2998: hero-near.glb 2 draws / ~20k tris, hero-far.glb 2 draws / ~4.9k, both on the hero's own 65-bone rig with all its clips, one vertex-colour material; today's
// figure is 17 draws / ~60k). The DEFAULT figure for every remote player (Strategy): remote-heroes.ts shows the near or the far one by distance (a row). They have no textures, so `loadWarriors` /
// `loadFighter` would refuse them (MissingTextures): each is parsed with GLTFLoader and built with `buildWarriors(asset, ..., solo)` exactly as the hero's own second actor is (main.ts secondActor).
// A load that fails returns null and the page keeps today's rig for every remote (nothing is ever missing). Kits (dressRemote) stay on today's rig until Characters' per-kit merge lands.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildWarriors } from '../../src/fight/index.ts';
import NEAR_URL from '../../src/assets/hero-near.glb?url';
import FAR_URL from '../../src/assets/hero-far.glb?url';

export type Figure = ReturnType<typeof buildWarriors>['player'];
export type Figures = { near: () => Figure; far: () => Figure };
type Asset = Parameters<typeof buildWarriors>[0];

/** Parse both LODs now (at zone warm-up, so their one program is compiled before [zone ready]); each call of `near()` / `far()` builds one more actor from the parsed asset (shared geometry and material, no new program). */
export async function loadFigures(load: (url: string) => Promise<Asset> = (url) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url) as Promise<Asset>): Promise<Figures | null> {
  try {
    const [near, far] = await Promise.all([load(NEAR_URL), load(FAR_URL)]);
    return { near: () => buildWarriors(near, undefined, undefined, true).player, far: () => buildWarriors(far, undefined, undefined, true).player };
  } catch (error) { console.warn('merged remote figures did not load; remotes keep the hero rig', error); return null; }
}

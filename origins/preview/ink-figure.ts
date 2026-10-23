// A test figure beside the hero (a look test, preview only, Lead 2026-10-23): the Inkverse row's `testFigure` names a zone, a spot, a scale, the clip to loop and a file per variant; `?fig=<variant>` picks one (no `fig` = nothing is added), so
// stills can set the warrior | Kachujin (red) | Kachujin (grey) at the same camera. It idles in place: no AI, no collision, nothing the game's rules see. A file that cannot be fetched adds nothing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { InkLook } from './inkverse.ts';

export type InkFigure = { readonly root: THREE.Object3D; update(dt: number): void };

/** The figure for this look, zone and `?fig=` variant, added to the scene, or null (no row for the zone, no variant asked for, an unknown variant, or a file that did not load). */
export async function createInkFigure(look: InkLook, scene: THREE.Scene, groundAt: (x: number, z: number) => number, search: string, base: string): Promise<InkFigure | null> {
  const F = look.testFigure, variant = new URLSearchParams(search).get('fig'), file = variant ? F.variants[variant] : undefined;
  if (!file) return null;
  let gltf; try { gltf = await new GLTFLoader().loadAsync(`${base}${file}`); } catch { return null; }
  const root = gltf.scene, mixer = new THREE.AnimationMixer(root), clip = THREE.AnimationClip.findByName(gltf.animations, F.clip) ?? gltf.animations[0];
  if (clip) mixer.clipAction(clip).play();
  root.scale.setScalar(F.scale); root.rotation.y = F.facingDeg * Math.PI / 180; root.position.set(F.x, groundAt(F.x, F.z), F.z); root.name = 'ink test figure';
  root.traverse((o) => { o.frustumCulled = false; });   // a skinned figure's bounds follow its bind pose, not the clip
  scene.add(root);
  return { root, update: (dt) => mixer.update(dt) };
}

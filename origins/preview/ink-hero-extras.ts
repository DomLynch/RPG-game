// Extra pieces on the hero for an Inkverse look (a look test, preview only, Lead 2026-10-23): each file in the row's `heroExtras` is a skinned mesh authored on the hero's own skeleton (bone names match), added beside his
// body draw so it follows his joints. It is not loot: no gear rule, no slot, nothing the game's rules see. A file that cannot be fetched or a bone the rig lacks adds nothing and says why on window.inkHeroExtras.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { InkLook } from './inkverse.ts';

/** Dress the hero rig (his anchor group) with the look's extras; resolves to the pieces added (empty when the look has none). */
export async function addHeroExtras(look: InkLook, anchor: THREE.Object3D, base: string): Promise<THREE.SkinnedMesh[]> {
  const added: THREE.SkinnedMesh[] = [], report: string[] = [];
  (window as unknown as { inkHeroExtras?: unknown }).inkHeroExtras = report;   // 'loaded <file>' | 'failed <file>: <why>', for stills to wait on
  let body: THREE.SkinnedMesh | undefined;
  anchor.traverse((o) => { if (!body && o instanceof THREE.SkinnedMesh && (o.userData.slot === 'Body' || o.name === 'CreatureBody')) body = o; });
  body ??= (() => { let first: THREE.SkinnedMesh | undefined; anchor.traverse((o) => { if (!first && o instanceof THREE.SkinnedMesh) first = o; }); return first; })();
  if (!body?.parent) { report.push('failed: the hero has no body draw'); return added; }
  const bones = new Map(body.skeleton.bones.map((b) => [b.name, b]));
  for (const file of look.heroExtras) {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${base}${file}`);
      gltf.scene.traverse((o) => {
        if (!(o instanceof THREE.SkinnedMesh)) return;
        const rig = o.skeleton.bones.map((b) => { const bone = bones.get(b.name); if (!bone) throw new Error(`bone ${b.name} is not on the hero`); return bone; });
        const piece = new THREE.SkinnedMesh(o.geometry, o.material);
        piece.name = o.name; piece.userData = { ...o.userData }; piece.frustumCulled = false; piece.castShadow = piece.receiveShadow = true;
        piece.bind(new THREE.Skeleton(rig, o.skeleton.boneInverses), body!.bindMatrix);
        body!.parent!.add(piece); added.push(piece);
      });
      report.push(`loaded ${file}`);
    } catch (e) { report.push(`failed ${file}: ${String(e).slice(0, 160)}`); }
  }
  return added;
}

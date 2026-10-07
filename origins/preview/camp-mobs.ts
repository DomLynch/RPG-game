// SCRATCH (stills only, not for the PR): the camp's members drawn on their spots with the roster goblin body, dressed by mob-looks/mob-dress (#1636).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import goblinUrl from '../../src/assets/goblin.glb?url';
import type { Camp } from './frontier-camp.ts';
import { dressMob } from './mob-dress.ts';
import { mobLook } from './mob-looks.ts';

export function campMobs(scene: THREE.Scene, camps: readonly Camp[]): void {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(goblinUrl, (gltf) => {
    for (const c of camps) c.spots.forEach((s, i) => {
      const m = clone(gltf.scene), look = mobLook(s.pose === 'stand' ? 'character:ruin-ghoul' : i ? 'character:mere-brood' : 'character:cinder-scavenger');
      if (look) dressMob(m, look);
      m.position.set(s.x, s.pose === 'sit' ? -0.38 : 0, s.z); m.rotation.y = s.facing;
      m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const mixer = new THREE.AnimationMixer(m), idle = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
      if (idle) { mixer.clipAction(idle).play(); mixer.update(0.4); }
      scene.add(m);
    });
  });
}

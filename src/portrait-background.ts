import * as THREE from 'three';
import type { Arena } from './arena.ts';

// A screen background only. The scene keeps its existing camera, lights, environment and effects.
export function addPortraitBackground(scene: THREE.Scene, base: Arena, load: () => Promise<THREE.Texture> = () => new THREE.TextureLoader().loadAsync(new URL('./assets/arena/portrait.webp', import.meta.url).href)) {
  base.group.visible = false;
  const group = new THREE.Group(); group.name = 'arena-portrait'; scene.add(group);
  const shadow = new THREE.ShadowMaterial({ opacity: .42, depthWrite: false });
  const floor = base.floor.clone(); floor.material = shadow; floor.receiveShadow = true; group.add(floor);
  const texture = new THREE.Texture(); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, fog: false, toneMapped: false, depthTest: false, depthWrite: false });
  material.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'gl_Position = vec4(position.xy, 1.0, 1.0);'); };
  const image = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  image.name = 'portrait-background'; image.frustumCulled = false; image.renderOrder = -10000; group.add(image);
  let pending: Promise<void> | undefined, disposed = false;
  const ready = () => pending ??= Promise.all([base.ready, load().then(loaded => {
    if (!disposed) { texture.image = loaded.image; texture.needsUpdate = true; }
    loaded.dispose();
  })]).then(() => {}).catch((error: unknown) => { pending = undefined; throw error; });
  return {
    ...base, group, floor, get sky() { return base.sky; }, get ready() { return ready(); },
    resize(width: number, height: number) {
      const aspect = width / height, imageAspect = 941 / 1672;
      // Crop around the painted fighting floor, behind the original full-size fighters.
      texture.repeat.set(.5 * Math.min(1, aspect / imageAspect), .5 * Math.min(1, imageAspect / aspect));
      texture.offset.set((1 - texture.repeat.x) / 2, 1 - .59 - texture.repeat.y / 2);
    },
    dispose() { disposed = true; image.geometry.dispose(); material.dispose(); shadow.dispose(); texture.dispose(); scene.remove(group); base.dispose(); },
  };
}

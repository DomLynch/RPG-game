// The warm-up's proxy: the cheap basic material the zone's geometries are drawn with, off-screen into a 4x4 target, to upload them (main.ts planUpload, mobs-view.ts warmKind). It used to be made and
// disposed at each use. A plain MeshBasicMaterial (no map, no vertex colours) drawn into a render target keys one program ("srgb-linear", map false); disposing the material drops that program, so a proxy
// alive at one of the seamless row's two readings and gone at the other was a program that "no scene material uses": 71 before the tap, 72 after the engage (seamless #87/#HG). One shared proxy, drawn
// once before [zone ready] (`linkProxy`) and never disposed, keeps that program in the baseline: every later proxy draw finds it linked and adds nothing.
import * as THREE from 'three';

let shared: { material: THREE.MeshBasicMaterial; scene: THREE.Scene; target: THREE.WebGLRenderTarget } | undefined;
export const warmProxy = () => (shared ??= { material: new THREE.MeshBasicMaterial(), scene: new THREE.Scene(), target: new THREE.WebGLRenderTarget(4, 4) });

/** Draw a geometry with the shared proxy into its target (the draw that uploads it); the renderer's own target is put back. */
export function drawProxy(renderer: THREE.WebGLRenderer, camera: THREE.Camera, geometry: THREE.BufferGeometry): void {
  const { material, scene, target } = warmProxy(), mesh = new THREE.Mesh(geometry, material), prev = renderer.getRenderTarget();
  mesh.frustumCulled = false; scene.add(mesh); renderer.setRenderTarget(target);
  try { renderer.render(scene, camera); } finally { renderer.setRenderTarget(prev); scene.remove(mesh); }
}

let linked = false;
/** Link the proxy's program once, in the configuration it is used in (the render target bound, no map): called before the zone is ready, so the program is in the baseline count. */
export function linkProxy(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
  if (linked) return; linked = true;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  try { drawProxy(renderer, camera, g); } finally { g.dispose(); }
}

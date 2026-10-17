// The far tier of the remote heroes: an IMPOSTOR, one instanced billboard per figure drawn from a baked atlas of the hero seen from `atlasCells` angles. No skeleton, no bone texture, no per-figure
// matrix walk, no per-figure draw call: one InstancedMesh, one draw for every impostor in the zone (the crowd's measured cost per full figure is ~1.4-1.8 ms at 4x CPU, mostly the bone hierarchy walk
// and the bone-texture upload; this tier has neither). The atlas is baked ONCE, before [zone ready] (a bake after ready would link the lit programs at the first far figure), from the same rig the
// full figure uses, so the look matches. Which tier a figure takes is remote-tiers.ts (pure); every number is a row (remote-impostor-defs.json). Billboards turn about Y only, so a figure stays upright.
import * as THREE from 'three';
import { impostorRule } from './remote-impostor-rules.ts';

/** Bake `cells` views of `figure` (a rig clone the caller made; it is posed as it stands, idle) into one render target, cell k = the figure seen at k/cells of a turn from its front. Returns the atlas texture. */
export function bakeAtlas(renderer: THREE.WebGLRenderer, figure: THREE.Object3D): { texture: THREE.Texture; target: THREE.WebGLRenderTarget } {
  const cells = impostorRule('atlasCells'), cw = impostorRule('atlasCellW'), ch = impostorRule('atlasCellH'), h = impostorRule('figureHeight');
  const target = new THREE.WebGLRenderTarget(cells * cw, ch, { colorSpace: THREE.SRGBColorSpace }), scene = new THREE.Scene();
  scene.add(figure, new THREE.HemisphereLight(0xfff4e0, 0x6b5a48, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 3); scene.add(sun);
  const fov = impostorRule('bakeFov'), cam = new THREE.PerspectiveCamera(fov, cw / ch, 0.1, 100), dist = (h * 1.08) / 2 / Math.tan((fov * Math.PI) / 360);
  cam.position.set(0, h / 2, dist); cam.lookAt(0, h / 2, 0);   // the camera sits in front (+z) looking back at the figure at the origin
  const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevClear = renderer.getClearAlpha(), prevColor = new THREE.Color(); renderer.getClearColor(prevColor);
  renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.clear();
  try {
    for (let k = 0; k < cells; k++) {
      figure.rotation.y = -(k * Math.PI * 2) / cells;   // the viewer's angle round the figure grows with k
      target.viewport.set(k * cw, 0, cw, ch); target.scissor.set(k * cw, 0, cw, ch); target.scissorTest = true;
      renderer.render(scene, cam);
    }
  } finally { target.scissorTest = false; renderer.setRenderTarget(prevTarget); renderer.autoClear = prevAuto; renderer.setClearColor(prevColor, prevClear); scene.remove(figure); }
  return { texture: target.texture, target };
}

const VERT = /* glsl */ `
attribute float aHeading;
varying vec2 vUv; varying float vCell;
uniform float uCells; uniform vec2 uSize;
void main() {
  vec3 pos = instanceMatrix[3].xyz, toCam = cameraPosition - pos;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
  float camYaw = atan(toCam.x, toCam.z), turn = fract((camYaw - aHeading) / 6.28318530718);   // the same rule as remote-tiers.ts viewCell
  vCell = mod(floor(turn * uCells + 0.5), uCells);
  vUv = position.xy + vec2(0.5, 0.0);
  vec3 world = pos + right * position.x * uSize.x + vec3(0.0, position.y * uSize.y, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D uAtlas; uniform float uCells; uniform float uAlphaCut;
varying vec2 vUv; varying float vCell;
void main() {
  vec4 c = texture2D(uAtlas, vec2((vCell + vUv.x) / uCells, vUv.y));
  if (c.a < uAlphaCut) discard;
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <colorspace_fragment>
}`;

export type ImpostorFigure = { readonly x: number; readonly y: number; readonly z: number; readonly heading: number };
/** One InstancedMesh for every impostor. `update(list)` sets the instances (up to `capacity`); the mesh draws `list.length` of them. */
export function createImpostors(d: { scene: THREE.Object3D; atlas: THREE.Texture; capacity: number }) {
  const cells = impostorRule('atlasCells'), w = impostorRule('figureWidth'), h = impostorRule('figureHeight');
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);   // origin at the feet, x -0.5..0.5, y 0..1
  const heading = new THREE.InstancedBufferAttribute(new Float32Array(d.capacity), 1); geo.setAttribute('aHeading', heading);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: false, depthWrite: true,
    uniforms: { uAtlas: { value: d.atlas }, uCells: { value: cells }, uSize: { value: new THREE.Vector2(w, h) }, uAlphaCut: { value: impostorRule('alphaCut') } } });
  const mesh = new THREE.InstancedMesh(geo, mat, d.capacity), m = new THREE.Matrix4(); mesh.frustumCulled = false; mesh.count = 0; d.scene.add(mesh);
  return {
    mesh,
    update(list: readonly ImpostorFigure[]): void {
      const n = Math.min(list.length, d.capacity);
      for (let i = 0; i < n; i++) { const f = list[i]!; m.makeTranslation(f.x, f.y, f.z); mesh.setMatrixAt(i, m); heading.setX(i, f.heading); }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; heading.needsUpdate = true;
    },
    drawn: (): number => mesh.count,
    dispose(): void { d.scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}

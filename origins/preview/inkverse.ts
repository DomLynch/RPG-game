// The Inkverse look (Dom 2026-10-22/23, a look test: `?ink=<row id>` on the existing scene, nothing else changes; flag absent = main.ts never imports this file and the frame is today's). A post pass behind a look ROW (inkverse.json, loaded through
// the registry like warm-kits.json): outlines from depth and normals, the lit shading quantised to ink and paper with a halftone only in the mid band (a plain threshold lost the characters, Lead's 2D test), and a colour kept for the tagged materials
// (red: blood sand, banners, hit effects and decals; blue: AI/tech, wired and unused). Every number below is the row's. The HUD is DOM, drawn above the canvas, so the pass never sees it. Donors: three's SobelOperatorShader / HalftonePass idea (a
// rotated dot grid sized by luma), the Obra Dinn dither lineage; the normals are rebuilt from the depth buffer, so there is no second scene draw for them.
import * as THREE from 'three';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './inkverse.manifest.json' with { type: 'json' };
import ROWS from './inkverse.json' with { type: 'json' };

type Rgb = readonly [number, number, number];
export type InkTag = { readonly color: Rgb; readonly keepLuma: number; readonly materials: readonly string[]; readonly objects: readonly string[] };
export type InkLook = {
  readonly id: string; readonly paper: Rgb; readonly ink: Rgb;
  readonly tone: { readonly gamma: number; readonly exposure: number; readonly pivot: number; readonly contrast: number; readonly low: number; readonly high: number; readonly cellPx: number; readonly angleDeg: number };
  readonly edges: { readonly thicknessPx: number; readonly depthRel: number; readonly normalDot: number; readonly strength: number; readonly darkBelow: number };
  readonly tags: { readonly red: InkTag; readonly blue: InkTag };
};

const num = (id: string, what: string, v: unknown): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`ink look "${id}": ${what} is a number`); return v; };
const rgb = (id: string, what: string, v: unknown): Rgb => { if (!Array.isArray(v) || v.length !== 3) throw new Error(`ink look "${id}": ${what} is [r, g, b]`); return [num(id, what, v[0]), num(id, what, v[1]), num(id, what, v[2])]; };
const names = (id: string, what: string, v: unknown): readonly string[] => { if (!Array.isArray(v) || !v.every((s) => typeof s === 'string' && s)) throw new Error(`ink look "${id}": ${what} is a list of names`); return v as string[]; };
const tag = (id: string, what: string, v: unknown): InkTag => { const t = v as Record<string, unknown> | undefined; if (!t || typeof t !== 'object') throw new Error(`ink look "${id}": ${what} is an object`); return { color: rgb(id, `${what}.color`, t.color), keepLuma: num(id, `${what}.keepLuma`, t.keepLuma), materials: names(id, `${what}.materials`, t.materials), objects: names(id, `${what}.objects`, t.objects) }; };
const group = (id: string, what: string, v: unknown, keys: readonly string[]): Record<string, number> => {
  const g = v as Record<string, unknown> | undefined; if (!g || typeof g !== 'object') throw new Error(`ink look "${id}": ${what} is an object`);
  return Object.fromEntries(keys.map((k) => [k, num(id, `${what}.${k}`, g[k])]));
};

/** The one loader: the registry's duplicate / missing checks, then the row rules the manifest cannot say (every number a number, every colour three channels, both tags present). */
export function loadInkLooks(raw: unknown): ReadonlyMap<string, InkLook> {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'inkverse.json');
  loadRegistry([table]);
  const out = new Map<string, InkLook>();
  for (const { id, fields } of table.rows as unknown as { id: string; fields: Record<string, unknown> }[]) {
    const tone = group(id, 'tone', fields.tone, ['gamma', 'exposure', 'pivot', 'contrast', 'low', 'high', 'cellPx', 'angleDeg']);
    const edges = group(id, 'edges', fields.edges, ['thicknessPx', 'depthRel', 'normalDot', 'strength', 'darkBelow']), tags = fields.tags as Record<string, unknown> | undefined;
    if (!tags || typeof tags !== 'object') throw new Error(`ink look "${id}": tags is missing`);
    out.set(id, { id, paper: rgb(id, 'paper', fields.paper), ink: rgb(id, 'ink', fields.ink), tone: tone as InkLook['tone'], edges: edges as InkLook['edges'], tags: { red: tag(id, 'tags.red', tags.red), blue: tag(id, 'tags.blue', tags.blue) } });
  }
  return out;
}

const LOOKS = loadInkLooks(ROWS);
/** The row a `?ink=<id>` names, or null (an unknown id leaves the plain frame). */
export const inkLook = (id: string | null): InkLook | null => (id ? LOOKS.get(id) ?? null : null);

const FULLSCREEN_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const INK_FRAG = `
uniform sampler2D tColor, tDepth, tTag;
uniform vec2 texel, projScale; uniform float ratio, cameraNear, cameraFar;
uniform float gamma, exposure, pivot, contrast, lowCut, highCut, cellPx, angle;
uniform float thick, depthRel, normalDot, edgeStrength, darkBelow;
uniform vec3 paper, inkCol, redCol, blueCol; uniform float redKeep, blueKeep;
varying vec2 vUv;
float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).x; return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar); }   // perspective: negative view-space z
vec3 viewPos(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * projScale * -z, z); }
void main() {
  vec3 hdr = texture2D(tColor, vUv).rgb * exposure;
  float lin = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  float l = pow(max(lin, 0.0), 1.0 / gamma);
  l = clamp((l - pivot) * contrast + 0.5, 0.0, 1.0);   // the S-curve about the scene's own mid tone
  // Halftone only in the mid band: below lowCut ink, above highCut paper, between a dot grid (rotated, cell in CSS px) whose dot grows as the light rises.
  vec2 p = gl_FragCoord.xy / (cellPx * ratio); float ca = cos(angle), sa = sin(angle);
  vec2 q = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); vec2 f = fract(q) - 0.5;
  float dotR = length(f) / 0.7071, t = clamp((l - lowCut) / (highCut - lowCut), 0.0, 1.0);
  float lit = l <= lowCut ? 0.0 : l >= highCut ? 1.0 : step(dotR, t);
  // Edges: depth jump (relative to depth) or a turn in the surface normal, both read off the depth buffer.
  float z0 = viewZ(vUv); vec2 o = texel * thick;
  float zl = viewZ(vUv - vec2(o.x, 0.0)), zr = viewZ(vUv + vec2(o.x, 0.0)), zd = viewZ(vUv - vec2(0.0, o.y)), zu = viewZ(vUv + vec2(0.0, o.y));
  float depthEdge = max(max(abs(zl - z0), abs(zr - z0)), max(abs(zd - z0), abs(zu - z0))) / max(-z0, 0.001);
  vec3 P = viewPos(vUv, z0);
  vec3 dxl = P - viewPos(vUv - vec2(o.x, 0.0), zl), dxr = viewPos(vUv + vec2(o.x, 0.0), zr) - P;
  vec3 dyd = P - viewPos(vUv - vec2(0.0, o.y), zd), dyu = viewPos(vUv + vec2(0.0, o.y), zu) - P;
  vec3 dx = abs(zr - z0) < abs(zl - z0) ? dxr : dxl, dy = abs(zu - z0) < abs(zd - z0) ? dyu : dyd;
  vec3 n = normalize(cross(dx, dy));
  vec3 nA = normalize(cross(dxl, dyd)), nB = normalize(cross(dxr, dyu));
  float turn = 1.0 - abs(dot(nA, nB));   // the surface turns across the pixel (a fold or a corner), not a depth step
  float edge = edgeStrength * max(step(depthRel, depthEdge), step(1.0 - normalDot, turn));
  vec3 col = mix(inkCol, paper, lit);
  col = mix(col, l < darkBelow ? paper : inkCol, edge);   // an outline in the dark is paper-coloured, or a figure in shadow would vanish into the ink
  // Selective colour: the tag buffer holds 1 in .r for red, 1 in .b for blue where a tagged material is the nearest surface.
  vec3 tg = texture2D(tTag, vUv).rgb;
  col = mix(col, redCol * (redKeep + (1.0 - redKeep) * l), tg.r * (1.0 - edge));
  col = mix(col, blueCol * (blueKeep + (1.0 - blueKeep) * l), tg.b * (1.0 - edge));
  gl_FragColor = vec4(col, 1.0);
}`;

/** The pass for the walk's frame: same shape as the graphics lift (`render()` replaces renderer.render(scene, camera)), so main.ts holds one slot for either. */
export function createInkverse(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, look: InkLook) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const depth = new THREE.DepthTexture(size.x, size.y); depth.type = THREE.UnsignedIntType;
  const color = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthTexture: depth });
  const tagged = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, depthTexture: depth });   // shares the scene's depth: a tagged surface behind a wall is hidden
  const u = (v: unknown) => ({ value: v });
  const rad = Math.PI / 180, T = look.tone, E = look.edges;
  const mat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: INK_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: u(color.texture), tDepth: u(depth), tTag: u(tagged.texture), texel: u(new THREE.Vector2(1 / size.x, 1 / size.y)), projScale: u(new THREE.Vector2(1, 1)), ratio: u(renderer.getPixelRatio()), cameraNear: u(camera.near), cameraFar: u(camera.far),
      gamma: u(T.gamma), exposure: u(T.exposure), pivot: u(T.pivot), contrast: u(T.contrast), lowCut: u(T.low), highCut: u(T.high), cellPx: u(T.cellPx), angle: u(T.angleDeg * rad),
      thick: u(E.thicknessPx), depthRel: u(E.depthRel), normalDot: u(E.normalDot), edgeStrength: u(E.strength), darkBelow: u(E.darkBelow),
      paper: u(new THREE.Vector3(...look.paper)), inkCol: u(new THREE.Vector3(...look.ink)), redCol: u(new THREE.Vector3(...look.tags.red.color)), blueCol: u(new THREE.Vector3(...look.tags.blue.color)), redKeep: u(look.tags.red.keepLuma), blueKeep: u(look.tags.blue.keepLuma),
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tagMats = new Map<number, THREE.MeshBasicMaterial>([[1, new THREE.MeshBasicMaterial({ color: 0xff0000, fog: false })], [2, new THREE.MeshBasicMaterial({ color: 0x0000ff, fog: false })]]);
  // The tag pass: each tagged object is on a camera layer (1 red, 2 blue) as well as 0; the scene draws once more through those layers with a flat colour over the scene's own depth.
  let tagCount = 0;
  const nameIn = (list: readonly string[], n: string | undefined): boolean => !!n && list.includes(n);
  const retag = (): void => {
    tagCount = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh, drawn = m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite, mats = drawn ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      const layer = nameIn(look.tags.red.objects, o.name) || mats.some((x) => nameIn(look.tags.red.materials, x?.name)) ? 1 : nameIn(look.tags.blue.objects, o.name) || mats.some((x) => nameIn(look.tags.blue.materials, x?.name)) ? 2 : 0;
      if (layer) { o.layers.enable(layer); tagCount++; }
    });
  };
  let frames = 0;
  const render = (): void => {
    if (frames++ % 30 === 0) retag();   // pooled decals and effects are made lazily: look again twice a second
    const before = renderer.getRenderTarget(), autoClear = renderer.autoClear, clear = renderer.getClearColor(new THREE.Color()), clearA = renderer.getClearAlpha();
    camera.layers.set(0); renderer.setRenderTarget(color); renderer.render(scene, camera);
    renderer.setRenderTarget(tagged); renderer.setClearColor(0x000000, 1); renderer.autoClear = false; renderer.clear(true, false, false);
    if (tagCount) {
      const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
      for (const layer of [1, 2]) { camera.layers.set(layer); scene.overrideMaterial = tagMats.get(layer)!; renderer.render(scene, camera); }
      scene.overrideMaterial = null; scene.background = bg; scene.fog = fog; camera.layers.set(0);
    }
    (mat.uniforms.projScale!.value as THREE.Vector2).set(1 / camera.projectionMatrix.elements[0]!, 1 / camera.projectionMatrix.elements[5]!);
    mat.uniforms.cameraNear!.value = camera.near; mat.uniforms.cameraFar!.value = camera.far;
    renderer.setRenderTarget(before); renderer.autoClear = true; renderer.render(post, postCam);
    renderer.autoClear = autoClear; renderer.setClearColor(clear, clearA);
  };
  for (const name of ['compile', 'compileAsync'] as const) {   // a program is keyed on its render target: the warm-ups compile for the pass's own target (the gfx lift's rule)
    const original = renderer[name].bind(renderer) as (...args: unknown[]) => unknown;
    (renderer as unknown as Record<string, unknown>)[name] = (...args: unknown[]): unknown => { const before = renderer.getRenderTarget(); renderer.setRenderTarget(color); try { return original(...args); } finally { renderer.setRenderTarget(before); } };
  }
  return {
    render,
    compile(): void { const before = renderer.getRenderTarget(); renderer.setRenderTarget(color); try { renderer.compile(scene, camera); } finally { renderer.setRenderTarget(before); } },
    setSize(w: number, h: number): void {
      const ratio = renderer.getPixelRatio(), pw = Math.round(w * ratio), ph = Math.round(h * ratio);
      color.setSize(pw, ph); tagged.setSize(pw, ph); depth.image.width = pw; depth.image.height = ph;
      (mat.uniforms.texel!.value as THREE.Vector2).set(1 / pw, 1 / ph); mat.uniforms.ratio!.value = ratio;
    },
  };
}

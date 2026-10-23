// The Inkverse look (Dom 2026-10-22/23, a look test: `?ink=<row id>` on the existing scene, nothing else changes; flag absent = main.ts never imports this file and the frame is today's). A post pass behind a look ROW (inkverse.json, loaded through
// the registry like warm-kits.json): outlines from depth and normals, the lit shading quantised to ink and paper with a halftone only in the mid band (a plain threshold lost the characters, Lead's 2D test), and a colour kept for the tagged materials
// (red: blood sand, banners, hit effects and decals; blue: AI/tech, wired and unused). Every number below is the row's. The HUD is DOM, drawn above the canvas, so the pass never sees it. Donors: three's SobelOperatorShader / HalftonePass idea (a
// rotated dot grid sized by luma), the Obra Dinn dither lineage; the normals are rebuilt from the depth buffer, so there is no second scene draw for them.
import * as THREE from 'three';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './inkverse.manifest.json' with { type: 'json' };
import ROWS from './inkverse.json' with { type: 'json' };
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { hudPieces, withoutHud } from './hud-tag.ts';

type Rgb = readonly [number, number, number];
/** A tag's colour: `gain` makes it emissive (above 1 it reads as light), `glowPx` and `glowStrength` are the bloom around the tagged pixels only. */
export type InkTag = { readonly color: Rgb; readonly keepLuma: number; readonly gain: number; readonly glowPx: number; readonly glowStrength: number; readonly materials: readonly string[]; readonly objects: readonly string[]; readonly userData: readonly string[] };
export type InkLook = {
  readonly id: string; readonly paper: Rgb; readonly ink: Rgb;
  /** Continuous greyscale from the lit frame through one S-curve: `pivot`/`contrast` bend it, `low`/`high` crush the blacks and lift the paper whites. */
  readonly tone: { readonly gamma: number; readonly exposure: number; readonly pivot: number; readonly contrast: number; readonly low: number; readonly high: number };
  /** A faint dot texture in the deep shadows only (strength 0 = none). */
  readonly halftone: { readonly strength: number; readonly below: number; readonly cellPx: number; readonly angleDeg: number };
  /** Thin outlines: `thicknessPx` in device pixels, fading to nothing between `fadeNear` and `fadeFar` metres. */
  /** A skinned character against the floor: `silhouetteOnly` 1 drops its interior creases (only the outline stays), `darken` and `contrast` push it darker and harder, `rimStrength`/`rimPow` a faint rim light on its edges. */
  readonly character: { readonly silhouetteOnly: number; readonly darken: number; readonly contrast: number; readonly rimStrength: number; readonly rimPow: number };
  /** `fxaa` 1 smooths the finished picture's lines (an FXAA pass after the ink pass). */
  readonly aa: { readonly fxaa: number };
  readonly edges: { readonly soft: number; readonly thicknessPx: number; readonly silhouetteMul: number; readonly depthRel: number; readonly normalDot: number; readonly strength: number; readonly darkBelow: number; readonly fadeNear: number; readonly fadeFar: number };
  /** Screen-space occlusion darkening the lit frame BEFORE the curve (strength 0 = off): `radiusPx` the tap ring, `range` metres a neighbour may stand in front, `bias` metres below which it does not count. */
  readonly ao: { readonly strength: number; readonly radiusPx: number; readonly range: number; readonly bias: number };
  /** Hatching in the dark band only, its lines running across the light's direction on screen (strength 0 = off): `spacingPx` between lines, `duty` the inked share of each. */
  readonly hatch: { readonly strength: number; readonly below: number; readonly spacingPx: number; readonly duty: number };
  /** Paper grain over the whole frame, and an inky vignette whose edge is broken up by noise. */
  readonly grain: { readonly strength: number; readonly scalePx: number };
  readonly vignette: { readonly strength: number; readonly start: number; readonly breakup: number; readonly freq: number };
  readonly tags: { readonly red: InkTag; readonly blue: InkTag };
  /** ONE ink shading for every lit world material (`on` 1): outgoing diffuse = albedo x a ramp of the light that fell on it, specular dropped. `steps` 0 = smooth, 3 = toon; `rampLow`/`rampHigh` the light range the ramp spans; hatching only below `hatchBelow` of the ramp; `grain` the paper noise; `screenCurve` 0 = the screen pass skips its own tone curve (the materials already made the ramp); `exclude` names keep their own shading. */
  readonly material: { readonly on: number; readonly steps: number; readonly rampLow: number; readonly rampHigh: number; readonly gain: number; readonly hatchStrength: number; readonly hatchBelow: number; readonly hatchSpacingPx: number; readonly hatchAngleDeg: number; readonly hatchDuty: number; readonly grain: number; readonly screenCurve: number; readonly exclude: readonly string[] };
  /** `passthrough` 1: where no geometry stands, the named sky objects (the dome and its plate sector) are drawn plain, as they are, instead of through the ink curve: a plate that is already inked (and red) must not be darkened twice. */
  readonly skyPlate: { readonly passthrough: number; readonly objects: readonly string[] };
  /** Alternate backdrop plates drawn under this look: `from` is the plate file the zone names, `to` the ink-painted one (a missing `to` falls back to `from`). */
  readonly plates: readonly { readonly from: string; readonly to: string }[];
};

const num = (id: string, what: string, v: unknown): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`ink look "${id}": ${what} is a number`); return v; };
const rgb = (id: string, what: string, v: unknown): Rgb => { if (!Array.isArray(v) || v.length !== 3) throw new Error(`ink look "${id}": ${what} is [r, g, b]`); return [num(id, what, v[0]), num(id, what, v[1]), num(id, what, v[2])]; };
const names = (id: string, what: string, v: unknown): readonly string[] => { if (!Array.isArray(v) || !v.every((s) => typeof s === 'string' && s)) throw new Error(`ink look "${id}": ${what} is a list of names`); return v as string[]; };
const tag = (id: string, what: string, v: unknown): InkTag => { const t = v as Record<string, unknown> | undefined; if (!t || typeof t !== 'object') throw new Error(`ink look "${id}": ${what} is an object`); return { color: rgb(id, `${what}.color`, t.color), keepLuma: num(id, `${what}.keepLuma`, t.keepLuma), gain: num(id, `${what}.gain`, t.gain), glowPx: num(id, `${what}.glowPx`, t.glowPx), glowStrength: num(id, `${what}.glowStrength`, t.glowStrength), materials: names(id, `${what}.materials`, t.materials), objects: names(id, `${what}.objects`, t.objects), userData: names(id, `${what}.userData`, t.userData) }; };
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
    const tone = group(id, 'tone', fields.tone, ['gamma', 'exposure', 'pivot', 'contrast', 'low', 'high']), halftone = group(id, 'halftone', fields.halftone, ['strength', 'below', 'cellPx', 'angleDeg']);
    const ao = group(id, 'ao', fields.ao, ['strength', 'radiusPx', 'range', 'bias']), hatch = group(id, 'hatch', fields.hatch, ['strength', 'below', 'spacingPx', 'duty']);
    const character = group(id, 'character', fields.character, ['silhouetteOnly', 'darken', 'contrast', 'rimStrength', 'rimPow']), aa = group(id, 'aa', fields.aa, ['fxaa']);
    const edges = group(id, 'edges', fields.edges, ['soft', 'thicknessPx', 'silhouetteMul', 'depthRel', 'normalDot', 'strength', 'darkBelow', 'fadeNear', 'fadeFar']), grain = group(id, 'grain', fields.grain, ['strength', 'scalePx']), vignette = group(id, 'vignette', fields.vignette, ['strength', 'start', 'breakup', 'freq']);
    const mat = fields.material as Record<string, unknown> | undefined;
    if (!mat || typeof mat !== 'object') throw new Error(`ink look "${id}": material is missing`);
    const material = { ...group(id, 'material', mat, ['on', 'steps', 'rampLow', 'rampHigh', 'gain', 'hatchStrength', 'hatchBelow', 'hatchSpacingPx', 'hatchAngleDeg', 'hatchDuty', 'grain', 'screenCurve']), exclude: names(id, 'material.exclude', mat.exclude) };
    const sky = fields.skyPlate as Record<string, unknown> | undefined;
    if (!sky || typeof sky !== 'object') throw new Error(`ink look "${id}": skyPlate is missing`);
    const skyPlate = { passthrough: num(id, 'skyPlate.passthrough', sky.passthrough), objects: names(id, 'skyPlate.objects', sky.objects) };
    const tags = fields.tags as Record<string, unknown> | undefined, plates = fields.plates;
    if (!Array.isArray(plates) || !plates.every((p) => p && typeof p.from === 'string' && p.from && typeof p.to === 'string' && p.to)) throw new Error(`ink look "${id}": plates is a list of { from, to } files`);
    if (!tags || typeof tags !== 'object') throw new Error(`ink look "${id}": tags is missing`);
    out.set(id, { id, paper: rgb(id, 'paper', fields.paper), ink: rgb(id, 'ink', fields.ink), tone: tone as InkLook['tone'], halftone: halftone as InkLook['halftone'], edges: edges as InkLook['edges'], character: character as InkLook['character'], aa: aa as InkLook['aa'], ao: ao as InkLook['ao'], hatch: hatch as InkLook['hatch'], grain: grain as InkLook['grain'], vignette: vignette as InkLook['vignette'], tags: { red: tag(id, 'tags.red', tags.red), blue: tag(id, 'tags.blue', tags.blue) }, material: material as InkLook['material'], skyPlate, plates: plates as InkLook['plates'] });
  }
  return out;
}

const f = (n: number): string => n.toFixed(4);   // a GLSL float literal from a row value: the shader text carries no tuning of its own
let patched = false;
/** The ink material: appends the ramp to three's `aomap_fragment` chunk (included by every lit material: standard, physical, phong, lambert), so one patch shades every world material. Call once, BEFORE the first material compiles (the gfx lift's fog patch has the same rule); a flag-off page never imports this file. */
export function patchInkMaterial(look: InkLook): void {
  const M = look.material; if (!M.on || patched) return; patched = true;
  const a = M.hatchAngleDeg * Math.PI / 180, C = THREE.ShaderChunk as Record<string, string>;
  const stepped = M.steps > 0 ? `r = floor(r * ${f(M.steps)} + 0.5) / ${f(M.steps)};` : '';
  C.aomap_fragment += `
#ifndef INK_OFF
{
  float inkAlbedo = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.04);
  vec3 inkLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
  float r = smoothstep(${f(M.rampLow)}, ${f(M.rampHigh)}, dot(inkLight, vec3(0.2126, 0.7152, 0.0722)) / inkAlbedo);
  ${stepped}
  float inkDark = 1.0 - smoothstep(0.0, ${f(M.hatchBelow)}, r);
  float inkLine = step(${f(1 - M.hatchDuty)}, fract(dot(gl_FragCoord.xy, vec2(${f(Math.cos(a))}, ${f(Math.sin(a))})) / ${f(M.hatchSpacingPx)}));
  r *= 1.0 - ${f(M.hatchStrength)} * inkDark * inkLine;
  r += (fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * ${f(M.grain)};
  reflectedLight.directDiffuse = diffuseColor.rgb * clamp(r, 0.0, 1.0) * ${f(M.gain)};
  reflectedLight.indirectDiffuse = vec3(0.0); reflectedLight.directSpecular = vec3(0.0); reflectedLight.indirectSpecular = vec3(0.0);
}
#endif
`;
}

const LOOKS = loadInkLooks(ROWS);
/** The row a `?ink=<id>` names, or null (an unknown id leaves the plain frame). */
export const inkLook = (id: string | null): InkLook | null => (id ? LOOKS.get(id) ?? null : null);

const FULLSCREEN_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const INK_FRAG = `
uniform sampler2D tColor, tDepth, tTag, tSky; uniform float skyOn;
uniform vec2 texel, projScale; uniform float ratio, cameraNear, cameraFar;
uniform float gamma, exposure, pivot, contrast, lowCut, highCut, cellPx, angle, htStrength, htBelow;
uniform float thick, depthRel, normalDot, edgeStrength, darkBelow, fadeNear, fadeFar;
uniform vec3 paper, inkCol, redCol, blueCol; uniform float redKeep, blueKeep, redGain, blueGain, redGlowPx, redGlowK;
uniform float grainK, grainPx, vigK, vigStart, vigBreak, vigFreq;
uniform float screenCurve;
uniform float edgeSoft, charSilOnly, charDarken, charContrast, rimK, rimPow;
uniform float silMul, aoK, aoPx, aoRange, aoBias, hatchK, hatchBelow, hatchPx, hatchDuty, lightAngle;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).x; return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar); }   // perspective: negative view-space z
vec3 viewPos(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * projScale * -z, z); }
void main() {
  vec3 hdr = texture2D(tColor, vUv).rgb * exposure;
  float lin = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  float l = pow(max(lin, 0.0), 1.0 / gamma);
  float z0 = viewZ(vUv); vec2 o = texel * thick;
  if (aoK > 0.0) {   // occlusion first: a neighbour that stands in front of this pixel (within range) darkens it, before the curve crushes anything
    float occ = 0.0;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854; float dz = viewZ(vUv + vec2(cos(a), sin(a)) * texel * aoPx) - z0; occ += step(aoBias, dz) * (1.0 - smoothstep(0.0, aoRange, dz)); }
    l *= 1.0 - aoK * occ / 8.0;
  }
  vec3 tg = texture2D(tTag, vUv).rgb;   // the tag buffer: .r red, .b blue, .g a skinned character
  float isChar = step(0.5, tg.g);
  l *= mix(1.0, charDarken, isChar);   // a character reads a little darker than its floor
  if (screenCurve > 0.5) l = clamp((l - pivot) * contrast * mix(1.0, charContrast, isChar) + 0.5, 0.0, 1.0);   // with the ink material on, the materials made the ramp and this curve is skipped   // the S-curve about the scene's own mid tone
  // Continuous greyscale: the lit frame at full resolution through the S-curve (blacks crushed below lowCut, paper above highCut, every grey between kept). A faint dot texture only in the deepest shadows (htStrength 0 = none).
  float shade = screenCurve > 0.5 ? smoothstep(lowCut, highCut, l) : clamp(l, 0.0, 1.0);
  vec2 p = gl_FragCoord.xy / (cellPx * ratio); float ca = cos(angle), sa = sin(angle);
  vec2 q = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); vec2 f = fract(q) - 0.5;
  shade *= 1.0 - htStrength * (1.0 - smoothstep(0.0, htBelow, l)) * step(length(f), 0.35);
  if (hatchK > 0.0) {   // hatching in the dark band only: lines across the light's screen direction, a second set crossing them in the deepest dark
    float dark = 1.0 - smoothstep(0.0, hatchBelow, l), ha = lightAngle + 1.5708;
    float c1 = fract(dot(gl_FragCoord.xy, vec2(cos(ha), sin(ha))) / (hatchPx * ratio)), c2 = fract(dot(gl_FragCoord.xy, vec2(cos(ha + 1.0472), sin(ha + 1.0472))) / (hatchPx * ratio));
    float line = max(step(1.0 - hatchDuty, c1), step(0.5, dark) * step(1.0 - hatchDuty, c2));
    shade *= 1.0 - hatchK * dark * line;
  }
  // Edges: depth jump (relative to depth) or a turn in the surface normal, both read off the depth buffer.
  float zl = viewZ(vUv - vec2(o.x, 0.0)), zr = viewZ(vUv + vec2(o.x, 0.0)), zd = viewZ(vUv - vec2(0.0, o.y)), zu = viewZ(vUv + vec2(0.0, o.y));
  float depthEdge = max(max(abs(zl - z0), abs(zr - z0)), max(abs(zd - z0), abs(zu - z0))) / max(-z0, 0.001);
  if (silMul > 1.0) {   // silhouettes (depth jumps) are drawn heavier than the inner creases: the same test at a wider reach
    vec2 w = o * silMul;
    depthEdge = max(depthEdge, max(max(abs(viewZ(vUv - vec2(w.x, 0.0)) - z0), abs(viewZ(vUv + vec2(w.x, 0.0)) - z0)), max(abs(viewZ(vUv - vec2(0.0, w.y)) - z0), abs(viewZ(vUv + vec2(0.0, w.y)) - z0))) / max(-z0, 0.001));
  }
  vec3 P = viewPos(vUv, z0);
  vec3 dxl = P - viewPos(vUv - vec2(o.x, 0.0), zl), dxr = viewPos(vUv + vec2(o.x, 0.0), zr) - P;
  vec3 dyd = P - viewPos(vUv - vec2(0.0, o.y), zd), dyu = viewPos(vUv + vec2(0.0, o.y), zu) - P;
  vec3 dx = abs(zr - z0) < abs(zl - z0) ? dxr : dxl, dy = abs(zu - z0) < abs(zd - z0) ? dyu : dyd;
  vec3 n = normalize(cross(dx, dy));
  vec3 nA = normalize(cross(dxl, dyd)), nB = normalize(cross(dxr, dyu));
  float turn = 1.0 - abs(dot(nA, nB));   // the surface turns across the pixel (a fold or a corner), not a depth step
  float eD = smoothstep(depthRel * (1.0 - edgeSoft), depthRel * (1.0 + edgeSoft), depthEdge), eN = smoothstep((1.0 - normalDot) * (1.0 - edgeSoft), (1.0 - normalDot) * (1.0 + edgeSoft), turn) * (1.0 - charSilOnly * isChar);   // soft thresholds (the lines anti-alias) and no interior creases on a character: its silhouette only
  float edge = edgeStrength * max(eD, eN) * (1.0 - smoothstep(fadeNear, fadeFar, -z0));   // thin, and fainter with distance
  shade = min(1.0, shade + isChar * rimK * pow(1.0 - abs(n.z), rimPow));   // a faint rim so a character lifts off a pale floor
  vec3 col = mix(inkCol, paper, shade);
  if (skyOn > 0.5 && texture2D(tDepth, vUv).x > 0.99999) col = pow(max(texture2D(tSky, vUv).rgb, 0.0), vec3(1.0 / gamma));   // empty sky: the plate as it is, already inked
  col = mix(col, l < darkBelow ? paper : inkCol, edge);   // an outline in the dark is paper-coloured, or a figure in shadow would vanish into the ink
  // Selective colour: the tag buffer holds 1 in .r for red, 1 in .b for blue where a tagged material is the nearest surface.
  // Red glow: the tagged pixels' neighbourhood (a ring of taps at two radii) tints the surround, so lamps, fires, banners and blood bloom red and nothing else does.
  if (redGlowPx > 0.0) {
    vec2 gp = texel * redGlowPx; float gr = 0.0;
    for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; vec2 d = vec2(cos(a), sin(a)); gr += texture2D(tTag, vUv + d * gp).r + texture2D(tTag, vUv + d * gp * 0.5).r; }
    col = mix(col, redCol, clamp(gr / 24.0 * redGlowK * (1.0 - tg.r), 0.0, 1.0));
  }
  col = mix(col, min(redCol * (redKeep + (1.0 - redKeep) * l) * redGain, vec3(1.0)), tg.r * (1.0 - edge));   // red comes from the tag buffer only, never from a surface's own hue
  col = mix(col, min(blueCol * (blueKeep + (1.0 - blueKeep) * l) * blueGain, vec3(1.0)), tg.b * (1.0 - edge));
  // Paper grain, and an inky frame whose edge is broken up by noise.
  col += (hash(floor(gl_FragCoord.xy / (grainPx * ratio))) - 0.5) * grainK;
  float vr = length(vUv - 0.5) * 1.4142 + (vnoise(vUv * vigFreq) - 0.5) * vigBreak;
  col = mix(col, inkCol, smoothstep(vigStart, 1.0, vr) * vigK);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/** The pass for the walk's frame: same shape as the graphics lift (`render()` replaces renderer.render(scene, camera)), so main.ts holds one slot for either. */
export function createInkverse(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, look: InkLook) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const depth = new THREE.DepthTexture(size.x, size.y); depth.type = THREE.UnsignedIntType;
  const color = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthTexture: depth });
  const tagged = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, depthTexture: depth });   // shares the scene's depth: a tagged surface behind a wall is hidden
  const skyTarget = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });   // the sky objects drawn alone (look.skyPlate), composited where the scene's depth is empty
  const u = (v: unknown) => ({ value: v });
  const rad = Math.PI / 180, T = look.tone, H = look.halftone, E = look.edges;
  const mat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: INK_FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: u(color.texture), tDepth: u(depth), tTag: u(tagged.texture), tSky: u(skyTarget.texture), skyOn: u(look.skyPlate.passthrough), screenCurve: u(look.material.screenCurve), texel: u(new THREE.Vector2(1 / size.x, 1 / size.y)), projScale: u(new THREE.Vector2(1, 1)), ratio: u(renderer.getPixelRatio()), cameraNear: u(camera.near), cameraFar: u(camera.far),
      gamma: u(T.gamma), exposure: u(T.exposure), pivot: u(T.pivot), contrast: u(T.contrast), lowCut: u(T.low), highCut: u(T.high), cellPx: u(H.cellPx), angle: u(H.angleDeg * rad), htStrength: u(H.strength), htBelow: u(H.below),
      edgeSoft: u(E.soft), charSilOnly: u(look.character.silhouetteOnly), charDarken: u(look.character.darken), charContrast: u(look.character.contrast), rimK: u(look.character.rimStrength), rimPow: u(look.character.rimPow),
      silMul: u(E.silhouetteMul), aoK: u(look.ao.strength), aoPx: u(look.ao.radiusPx), aoRange: u(look.ao.range), aoBias: u(look.ao.bias), hatchK: u(look.hatch.strength), hatchBelow: u(look.hatch.below), hatchPx: u(look.hatch.spacingPx), hatchDuty: u(look.hatch.duty), lightAngle: u(0),
      thick: u(E.thicknessPx), depthRel: u(E.depthRel), normalDot: u(E.normalDot), edgeStrength: u(E.strength), darkBelow: u(E.darkBelow), fadeNear: u(E.fadeNear), fadeFar: u(E.fadeFar),
      redGain: u(look.tags.red.gain), blueGain: u(look.tags.blue.gain), redGlowPx: u(look.tags.red.glowPx), redGlowK: u(look.tags.red.glowStrength),
      grainK: u(look.grain.strength), grainPx: u(look.grain.scalePx), vigK: u(look.vignette.strength), vigStart: u(look.vignette.start), vigBreak: u(look.vignette.breakup), vigFreq: u(look.vignette.freq),
      paper: u(new THREE.Vector3(...look.paper)), inkCol: u(new THREE.Vector3(...look.ink)), redCol: u(new THREE.Vector3(...look.tags.red.color)), blueCol: u(new THREE.Vector3(...look.tags.blue.color)), redKeep: u(look.tags.red.keepLuma), blueKeep: u(look.tags.blue.keepLuma),
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // FXAA over the finished picture (look.aa.fxaa): the ink pass draws into `inkOut` and the FXAA shader reads it to the screen.
  const inkOut = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType });
  const aaMat = look.aa.fxaa > 0 ? new THREE.ShaderMaterial({ uniforms: { tDiffuse: u(inkOut.texture), resolution: u(new THREE.Vector2(1 / size.x, 1 / size.y)) }, vertexShader: FXAAShader.vertexShader, fragmentShader: FXAAShader.fragmentShader, depthTest: false, depthWrite: false }) : null;
  const aaScene = new THREE.Scene(); if (aaMat) { const aq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aaMat); aq.frustumCulled = false; aaScene.add(aq); }
  // The tag pass: each tagged mesh is on a camera layer (1 red, 2 blue) as well as 0; the scene draws once more through those layers over the scene's own depth, each tagged mesh wearing a tag material that keeps its own cut-out (a decal's map alpha,
  // a banner's alphaMap) and its own fade, or the decals would draw as red squares. The sand's blood-stain mask is redrawn from the inputs the sand's shader reads (exchange.ts `stained` leaves them on the material's userData.inkStain).
  const TAG = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
  const OFFSET = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };   // pulled toward the camera: the tag pass redraws surfaces the scene already wrote to the shared depth
  const VERT = 'varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n vec4 w = modelMatrix * p; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  type Cut = THREE.MeshBasicMaterial;
  const cutMat = (src: THREE.Material, layer: number): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    uniforms: { map: u((src as Cut).map), alphaMap: u((src as Cut).alphaMap), opacity: u(1), tag: u(TAG[layer]) }, vertexShader: VERT, side: (src as Cut).side, depthWrite: false, ...OFFSET,
    defines: { HAS_MAP: (src as Cut).map ? 1 : 0, HAS_ALPHA: (src as Cut).alphaMap ? 1 : 0 },
    fragmentShader: 'uniform sampler2D map, alphaMap; uniform float opacity; uniform vec3 tag; varying vec2 vUv; void main() { float a = opacity;\n#if HAS_MAP\n a *= texture2D(map, vUv).a;\n#endif\n#if HAS_ALPHA\n a *= texture2D(alphaMap, vUv).g;\n#endif\n if (a < 0.3) discard; gl_FragColor = vec4(tag, 1.0); }',
  });
  const stainMat = (stain: { span: number; top: number; bottom: number; gain: number; patch: { value: THREE.Texture } }): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    uniforms: { patchMap: stain.patch, tag: u(TAG[1]) }, vertexShader: VERT, ...OFFSET,
    defines: { SPAN: stain.span.toFixed(2), TOP: stain.top.toFixed(2), DEPTH: (stain.bottom - stain.top).toFixed(2), GAIN: stain.gain.toFixed(2) },
    fragmentShader: 'uniform sampler2D patchMap; uniform vec3 tag; varying vec2 vUv; varying vec3 vW; void main() { vec4 s = texture2D(patchMap, fract(vW.xz / SPAN + 0.5)); float a = clamp(s.a * GAIN, 0.0, 1.0) * clamp((vW.y - TOP) / DEPTH, 0.0, 1.0); gl_FragColor = vec4(tag * a, 1.0); }',   // the sand shader's own stain amount
  });
  const flat = (color: number) => new THREE.MeshBasicMaterial({ color, fog: false, toneMapped: false, ...OFFSET });
  const flatMats = [null, flat(0xff0000), flat(0x0000ff), flat(0x00ff00)];   // layer 3 is the character flag (.g): every skinned mesh, whatever it wears
  const made = [0, 1, 2, 3].map(() => new WeakMap<THREE.Material, THREE.Material>());
  const tagMaterialFor = (src: THREE.Material, layer: number): THREE.Material => {
    let hit = made[layer]!.get(src);
    if (!hit) {
      const stain = src.userData.inkStain;
      hit = layer === 3 ? flatMats[3]! : stain && layer === 1 ? stainMat(stain) : (src as Cut).map || (src as Cut).alphaMap ? cutMat(src, layer) : flatMats[layer]!;
      made[layer]!.set(src, hit);
    }
    return hit;
  };
  type Tagged = { mesh: THREE.Mesh; layer: number; own: THREE.Material };
  let tagList: Tagged[] = [];
  const nameIn = (list: readonly string[], n: string | undefined): boolean => !!n && list.includes(n);
  const userIn = (list: readonly string[], x: THREE.Material): boolean => list.some((k) => x.userData[k] !== undefined);
  const HUD_LAYER = 4, SKY_LAYER = 5; let hudList: THREE.Object3D[] = [];
  const retag = (): void => {
    tagList = []; hudList = hudPieces(scene); for (const o of hudList) o.layers.enable(HUD_LAYER);
    if (look.skyPlate.passthrough > 0) scene.traverse((o) => { if (nameIn(look.skyPlate.objects, o.name)) o.traverse((c) => c.layers.enable(SKY_LAYER)); });
    scene.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const own = Array.isArray(m.material) ? m.material[0] : m.material; if (!own) return;
      if (look.material.on && look.material.exclude.length) for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (nameIn(look.material.exclude, x.name) && !x.defines?.INK_OFF) { x.defines = { ...x.defines, INK_OFF: 1 }; x.needsUpdate = true; }   // these keep their own shading
      const hit = (t: InkTag): boolean => nameIn(t.objects, o.name) || nameIn(t.materials, own.name) || userIn(t.userData, own);
      const layer = hit(look.tags.red) ? 1 : hit(look.tags.blue) ? 2 : 0;
      if (layer) { o.layers.enable(layer); tagList.push({ mesh: m, layer, own }); }
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) { o.layers.enable(3); tagList.push({ mesh: m, layer: 3, own }); }
    });
  };
  let frames = 0; const toLight = new THREE.Vector3();
  // For picking tags: every mesh's object name, material name and kind in the scene right now (`window.inkNames()`, a look-test aid).
  (window as unknown as { inkNames: () => unknown }).inkNames = () => { const seen = new Map<string, number>(); scene.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Sprite).isSprite) return; const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const x of mats) { const k = `${o.name || '-'} | ${x?.name || '-'} | ${x?.type}${(m as THREE.SkinnedMesh).isSkinnedMesh ? ' skinned' : ''}${(x as THREE.MeshBasicMaterial)?.emissive && (x as THREE.MeshStandardMaterial).emissiveIntensity > 0 ? ' emissive' : ''}`; seen.set(k, (seen.get(k) ?? 0) + 1); } }); return [...seen].map(([k, n]) => `${n} x ${k}`); };
  const render = (): void => {
    if (frames++ % 30 === 0) retag();   // pooled decals and effects are made lazily: look again twice a second
    const before = renderer.getRenderTarget(), autoClear = renderer.autoClear, clear = renderer.getClearColor(new THREE.Color()), clearA = renderer.getClearAlpha();
    camera.layers.set(0); renderer.setRenderTarget(color); withoutHud(scene, () => renderer.render(scene, camera));   // the scene-space HUD pieces (name tags, "!", rings: userData.hud, hud-tag.ts) are left out of the pass and drawn plain over it below
    if (look.skyPlate.passthrough > 0) { const bg = scene.background; scene.background = null; renderer.setRenderTarget(skyTarget); renderer.setClearColor(0x000000, 1); renderer.autoClear = true; camera.layers.set(SKY_LAYER); withoutHud(scene, () => renderer.render(scene, camera)); scene.background = bg; camera.layers.set(0); }
    renderer.setRenderTarget(tagged); renderer.setClearColor(0x000000, 1); renderer.autoClear = false; renderer.clear(true, false, false);
    if (tagList.length) {
      const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
      withoutHud(scene, () => {
        for (const layer of [1, 2, 3]) {   // red, blue, character: each mesh wears that layer's tag material for its own draw
          const these = tagList.filter((t) => t.layer === layer); if (!these.length) continue;
          for (const t of these) { const tm = tagMaterialFor(t.own, layer) as THREE.ShaderMaterial; if (tm.uniforms?.opacity) tm.uniforms.opacity.value = t.own.opacity; t.mesh.material = tm; }
          camera.layers.set(layer); renderer.render(scene, camera);
          for (const t of these) t.mesh.material = t.own;
        }
      });
      scene.background = bg; scene.fog = fog; camera.layers.set(0);
    }
    (mat.uniforms.projScale!.value as THREE.Vector2).set(1 / camera.projectionMatrix.elements[0]!, 1 / camera.projectionMatrix.elements[5]!);
    mat.uniforms.cameraNear!.value = camera.near; mat.uniforms.cameraFar!.value = camera.far;
    if (look.hatch.strength > 0) {   // the light's direction on screen: from the scene's directional light, in the camera's view
      const sun = scene.children.find((c) => (c as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight | undefined;
      if (sun) { toLight.copy(sun.position).sub(sun.target.position).transformDirection(camera.matrixWorldInverse); mat.uniforms.lightAngle!.value = Math.atan2(toLight.y, toLight.x); }
    }
    if (aaMat) { renderer.setRenderTarget(inkOut); renderer.autoClear = true; renderer.render(post, postCam); renderer.setRenderTarget(before); renderer.render(aaScene, postCam); }   // the ink picture, then FXAA of it to the screen: smooth lines
    else { renderer.setRenderTarget(before); renderer.autoClear = true; renderer.render(post, postCam); }
    if (hudList.length) { const bg = scene.background, fog = scene.fog; renderer.autoClear = false; scene.background = null; camera.layers.set(HUD_LAYER); renderer.render(scene, camera); scene.background = bg; scene.fog = fog; camera.layers.set(0); }   // the HUD pieces, plain, on top (no scene depth: a tag behind a wall still shows)
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
      color.setSize(pw, ph); tagged.setSize(pw, ph); skyTarget.setSize(pw, ph); inkOut.setSize(pw, ph); depth.image.width = pw; depth.image.height = ph;
      if (aaMat) (aaMat.uniforms.resolution!.value as THREE.Vector2).set(1 / pw, 1 / ph);
      (mat.uniforms.texel!.value as THREE.Vector2).set(1 / pw, 1 / ph); mat.uniforms.ratio!.value = ratio;
    },
  };
}

// `?look=pit-stone` (Web, Lead 2026-09-30; Dom on the #1151 stills: "the walls are still basic Minecraft style"): the Pit's wall, vault
// and floor as stone that reads real at 375. A look test, not the ship path: room.ts takes these materials only when the flag is set.
//
// The slot: a StoneSet per surface — base, normal and (optional) roughness maps and the metres they tile over. The procedural sets
// (stone-maps.ts, made in a worker so the Pit's open frame never waits on them) fill it today; a loaded PBR set (GPT's tileable 1024s)
// takes the same slot. Over the maps, in object space (the room's own metres): soot above each torch, water runs, damp and moss low
// down, a darker vault, the light falling off from the gate, and a large-scale mottle so the tile's repeat never shows.
import * as THREE from 'three';
import { FLOOR, WALL, stoneBytes, type StoneBytes } from './stone-maps.ts';

export type StoneSet = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap?: THREE.Texture; tile: number };
export type StoneSets = { wall: StoneSet; floor: StoneSet };
export type RoomShape = { width: number; depth: number; height: number; gate: number; sconces: readonly THREE.Vector3Tuple[] };   // gate: the opening's height
export type Stone = {
  wall: THREE.MeshStandardMaterial; floor: THREE.MeshStandardMaterial;   // the wall material also dresses the vault and the passage
  tile: { wall: number; floor: number };
  ready: Promise<void>;   // the sets are on the materials (the room does not wait for it: the stand-ins show until then)
  receipt: { ms?: number; landedMs?: number; bytes: number; maps: string[] };   // generation (in the worker) and built → on the materials, ms; GPU bytes
  dispose(): void;
};

function texture(size: number, data: Uint8Array, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
const solid = (r: number, g: number, b: number) => texture(1, new Uint8Array([r, g, b, 255]), true);
function procedural(bytes: StoneBytes, tile: number): StoneSet {
  return { map: texture(bytes.size, bytes.albedo, true), normalMap: texture(bytes.size, bytes.normal, false), tile };
}
// The procedural sets: from a worker when the page has one, else here (Node tests, an old browser).
function proceduralSets(): Promise<{ sets: StoneSets; ms: number }> {
  const make = (wall: StoneBytes, floor: StoneBytes, ms: number) => ({ sets: { wall: procedural(wall, WALL.tile), floor: procedural(floor, FLOOR.tile) }, ms });
  if (typeof Worker !== 'function') { const t0 = performance.now(), wall = stoneBytes(WALL), floor = stoneBytes(FLOOR); return Promise.resolve(make(wall, floor, performance.now() - t0)); }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./stone-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ wall: StoneBytes; floor: StoneBytes; ms: number }>) => { worker.terminate(); resolve(make(event.data.wall, event.data.floor, event.data.ms)); };
    worker.onerror = (error) => { worker.terminate(); reject(error); };
    worker.postMessage(null);
  });
}

const NOISE = /* glsl */ `
varying vec3 vPitP;
float pitDamp = 0.0;   // set by the grime block, read again at the roughness (a damp face catches the torch)
uniform vec3 pitRoom;   // width, depth, wall height
uniform vec3 pitSconces[3];   // the two torches and the gate's lintel (old smoke from torches carried through it)
float pitHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pitNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pitHash(i), pitHash(i + vec2(1.0, 0.0)), f.x), mix(pitHash(i + vec2(0.0, 1.0)), pitHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;
// Walls and vault: `along` runs along whichever wall this is (x on the end walls, z on the side walls).
const WALL_GRIME = /* glsl */ `
{
  vec3 p = vPitP; float along = p.x + p.z;
  float n = pitNoise(vec2(along, p.y) * 1.3), n2 = pitNoise(vec2(along, p.y) * 3.7 + 11.0), big = pitNoise(vec2(along, p.y) * 0.4 + 5.0);
  float soot = 0.0;
  for (int i = 0; i < 3; i++) {
    vec3 s = pitSconces[i]; float dy = p.y - s.y, r = length(p.xz - s.xz), w = 0.22 + 0.45 * max(dy, 0.0);   // a fan widening as it rises
    soot = max(soot, exp(-r * r / (w * w)) * smoothstep(-0.3, 0.2, dy) * exp(-max(dy, 0.0) * 0.35));
  }
  soot *= 0.65 + 0.5 * n2;
  float streak = smoothstep(0.6, 0.92, pitNoise(vec2(along * 7.0, p.y * 0.35))) * (0.5 + 0.5 * n);   // water runs down from the vault
  float damp = 1.0 - smoothstep(0.1, 0.75 + 0.6 * n, p.y); pitDamp = max(damp, 0.7 * streak);
  float moss = damp * smoothstep(0.5, 0.78, 0.55 * n2 + 0.5 * n);
  float vault = smoothstep(pitRoom.z - 0.5, pitRoom.z + 0.8, p.y);
  float gate = smoothstep(0.5 * pitRoom.y, -0.5 * pitRoom.y, p.z);   // 1 at the gate wall, 0 at the ramp end
  // Gentle factors: they stack (World: cavity × soot × damp × vault × gate went to mud), so each is small and only soot goes deep.
  diffuseColor.rgb *= (0.86 + 0.28 * big) * (1.0 - 0.75 * soot) * (1.0 - 0.14 * streak) * (1.0 - 0.3 * damp) * mix(1.0, 0.62, vault) * mix(0.74, 1.06, gate);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.078, 0.045) * (0.7 + 0.6 * n2), moss * 0.5);   // olive-grey, not green paint
}`;
// The floor: darker and damp along every wall's foot, mottled, and falling off from the gate as the walls do.
const FLOOR_GRIME = /* glsl */ `
{
  vec3 p = vPitP;
  float n = pitNoise(p.xz * 1.1), big = pitNoise(p.xz * 0.35 + 3.0);
  float edge = min(0.5 * pitRoom.x - abs(p.x), 0.5 * pitRoom.y - abs(p.z));
  float foot = 1.0 - smoothstep(0.0, 0.5 + 0.5 * n, edge); pitDamp = foot;
  float gate = smoothstep(0.5 * pitRoom.y, -0.5 * pitRoom.y, p.z);
  diffuseColor.rgb *= (0.86 + 0.28 * big) * (1.0 - 0.25 * foot) * mix(0.74, 1.06, gate);
}`;

function grime(material: THREE.MeshStandardMaterial, code: string, key: string, room: RoomShape) {
  const s = room.sconces, sconces = [...[0, 1].map((i) => new THREE.Vector3(...(s[i] ?? s[0] ?? [0, -99, 0]))), new THREE.Vector3(0, room.gate - 0.15, -room.depth / 2)];
  material.onBeforeCompile = (shader) => {
    shader.uniforms.pitRoom = { value: new THREE.Vector3(room.width, room.depth, room.height) };
    shader.uniforms.pitSconces = { value: sconces };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPitP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPitP = transformed;');   // the room's own metres (the merged geometry sits at the group's origin)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${code}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.42, pitDamp * 0.85);');
  };
  material.customProgramCacheKey = () => `pit-stone-${key}`;
  return material;
}

// The room stops being flat boxes (World): a plinth at every wall's foot, a cornice where the vault springs, and two ribs across the vault
// clear of the rack and the trophies. Merged into the wall material by room.ts: no draw is added. UVs in metres over `tile`.
export function stoneTrim(room: RoomShape, rise: number, tile: number): THREE.BufferGeometry[] {
  const { width: W, depth: D, height: H } = room, hw = W / 2, hd = D / 2, out: THREE.BufferGeometry[] = [];
  const block = (w: number, h: number, d: number, x: number, y: number, z: number, turn = 0) => {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / tile, uv.getY(i) * h / tile);
    if (turn) g.rotateZ(turn);
    out.push(g.translate(x, y, z));
  };
  for (const [y, h, d] of [[0.2, 0.4, 0.14], [H - 0.09, 0.18, 0.12]] as const) {   // the plinth, the cornice
    block(W, h, d, 0, y, hd - d / 2);   // the ramp end
    for (const s of [-1, 1]) {
      block(d, h, D, s * (hw - d / 2), y, 0);   // the side walls
      block(hw - 1.1, h, d, s * (hw + 1.1) / 2, y, -hd + d / 2);   // the gate wall, either side of the 2.2 m gate
    }
  }
  // The gate's lintel keeps the wall's own stone; a chamfer along its lower edge catches the daylight (World 2026-09-30: the voussoir
  // arch read as tilted cards, so it went back to the plain lintel with this one bevel).
  const chamfer = new THREE.BoxGeometry(2.2, 0.1, 0.1), cuv = chamfer.getAttribute('uv');
  for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 2.2 / tile, cuv.getY(i) * 0.1 / tile);
  out.push(chamfer.rotateX(Math.PI / 4).translate(0, room.gate, -hd));
  for (const z of [-1.5, 1.5]) {   // the ribs: 12 segments along the arc, 0.3 m wide, standing 0.12 m proud of the vault
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI, a1 = ((i + 1) / 12) * Math.PI;
      const x0 = -Math.cos(a0) * hw, x1 = -Math.cos(a1) * hw, y0 = H + Math.sin(a0) * rise, y1 = H + Math.sin(a1) * rise, t = Math.atan2(y1 - y0, x1 - x0);
      block(Math.hypot(x1 - x0, y1 - y0) + 0.02, 0.12, 0.3, (x0 + x1) / 2 + Math.sin(t) * 0.06, (y0 + y1) / 2 - Math.cos(t) * 0.06, z, t);
    }
  }
  return out;
}

// `sets`: a loaded PBR set in the slot; omitted, the procedural sets. Until they land the materials hold flat stand-ins in their mean colour.
export function pitStone(room: RoomShape, sets?: Promise<StoneSets>): Stone {
  const stand = [solid(96, 88, 78), solid(118, 104, 84)], flat = texture(1, new Uint8Array([128, 128, 255, 255]), false);
  const wall = grime(new THREE.MeshStandardMaterial({ map: stand[0], normalMap: flat, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.92, envMapIntensity: 0.12 }), WALL_GRIME, 'wall', room);
  const floor = grime(new THREE.MeshStandardMaterial({ map: stand[1], normalMap: flat, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.95, envMapIntensity: 0.12 }), FLOOR_GRIME, 'floor', room);
  const owned: THREE.Texture[] = [...stand, flat], receipt: Stone['receipt'] = { bytes: 0, maps: [] };
  let disposed = false;
  const born = performance.now();
  const bytesOf = (t: THREE.Texture) => { const img = t.image as { width: number; height: number }; receipt.maps.push(`${img.width}²`); return Math.round(img.width * img.height * 4 * 4 / 3); };   // RGBA8 + mips
  const ready = (sets ?? proceduralSets().then(({ sets: s, ms }) => { receipt.ms = Math.round(ms); return s; })).then((s) => {
    const all = [s.wall.map, s.wall.normalMap, s.floor.map, s.floor.normalMap, ...[s.wall.roughnessMap, s.floor.roughnessMap].filter((t): t is THREE.Texture => !!t)];
    if (disposed) { for (const t of all) t.dispose(); return; }
    owned.push(...all); receipt.bytes = all.reduce((sum, t) => sum + bytesOf(t), 0);
    for (const [m, set] of [[wall, s.wall], [floor, s.floor]] as const) {
      m.map = set.map; m.normalMap = set.normalMap;
      if (set.roughnessMap) { m.roughnessMap = set.roughnessMap; m.roughness = 1; }
      m.needsUpdate = true;
    }
    receipt.landedMs = Math.round(performance.now() - born);
    (globalThis as { __pitStone?: Stone['receipt'] }).__pitStone = receipt;   // the look test's report (scripts/pit-stone-stills.mjs)
  }, () => {});   // the stand-ins stay: flat stone beats no Pit
  return {
    wall, floor, tile: { wall: WALL.tile, floor: FLOOR.tile }, ready, receipt,
    dispose() { disposed = true; wall.dispose(); floor.dispose(); for (const t of owned) t.dispose(); },
  };
}

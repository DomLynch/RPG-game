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
export type RoomShape = { width: number; depth: number; height: number; sconces: readonly THREE.Vector3Tuple[] };
export type Stone = {
  wall: THREE.MeshStandardMaterial; floor: THREE.MeshStandardMaterial;   // the wall material also dresses the vault and the passage
  tile: { wall: number; floor: number };
  ready: Promise<void>;   // the sets are on the materials
  receipt: { ms?: number; bytes: number; maps: string[] };   // generation time (worker) and GPU bytes, for the look-test report
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
uniform vec3 pitRoom;   // width, depth, wall height
uniform vec3 pitSconces[2];
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
  for (int i = 0; i < 2; i++) {
    vec3 s = pitSconces[i]; float dy = p.y - s.y, r = length(p.xz - s.xz), w = 0.16 + 0.3 * max(dy, 0.0);
    soot = max(soot, exp(-r * r / (w * w)) * smoothstep(-0.3, 0.2, dy) * exp(-max(dy, 0.0) * 0.35));
  }
  soot *= 0.65 + 0.5 * n2;
  float streak = smoothstep(0.6, 0.92, pitNoise(vec2(along * 7.0, p.y * 0.35))) * (0.5 + 0.5 * n);   // water runs down from the vault
  float damp = 1.0 - smoothstep(0.05, 0.55 + 0.6 * n, p.y);
  float moss = damp * smoothstep(0.5, 0.78, 0.55 * n2 + 0.5 * n);
  float vault = smoothstep(pitRoom.z - 0.5, pitRoom.z + 0.8, p.y);
  float gate = smoothstep(0.5 * pitRoom.y, -0.5 * pitRoom.y, p.z);   // 1 at the gate wall, 0 at the ramp end
  diffuseColor.rgb *= (0.8 + 0.4 * big) * (1.0 - 0.8 * soot) * (1.0 - 0.22 * streak) * (1.0 - 0.35 * damp) * mix(1.0, 0.45, vault) * mix(0.6, 1.08, gate);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.075, 0.095, 0.04) * (0.7 + 0.7 * n2), moss * 0.7);
}`;
// The floor: darker and damp along every wall's foot, mottled, and falling off from the gate as the walls do.
const FLOOR_GRIME = /* glsl */ `
{
  vec3 p = vPitP;
  float n = pitNoise(p.xz * 1.1), big = pitNoise(p.xz * 0.35 + 3.0);
  float edge = min(0.5 * pitRoom.x - abs(p.x), 0.5 * pitRoom.y - abs(p.z));
  float foot = 1.0 - smoothstep(0.0, 0.5 + 0.5 * n, edge);
  float gate = smoothstep(0.5 * pitRoom.y, -0.5 * pitRoom.y, p.z);
  diffuseColor.rgb *= (0.82 + 0.36 * big) * (1.0 - 0.4 * foot) * mix(0.62, 1.08, gate);
}`;

function grime(material: THREE.MeshStandardMaterial, code: string, key: string, room: RoomShape) {
  const s = room.sconces, sconces = [0, 1].map((i) => new THREE.Vector3(...(s[i] ?? s[0] ?? [0, -99, 0])));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.pitRoom = { value: new THREE.Vector3(room.width, room.depth, room.height) };
    shader.uniforms.pitSconces = { value: sconces };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPitP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPitP = transformed;');   // the room's own metres (the merged geometry sits at the group's origin)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${code}`);
  };
  material.customProgramCacheKey = () => `pit-stone-${key}`;
  return material;
}

// `sets`: a loaded PBR set in the slot; omitted, the procedural sets. Until they land the materials hold flat stand-ins in their mean colour.
export function pitStone(room: RoomShape, sets?: Promise<StoneSets>): Stone {
  const stand = [solid(96, 88, 78), solid(118, 104, 84)], flat = texture(1, new Uint8Array([128, 128, 255, 255]), false);
  const wall = grime(new THREE.MeshStandardMaterial({ map: stand[0], normalMap: flat, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.92, envMapIntensity: 0.12 }), WALL_GRIME, 'wall', room);
  const floor = grime(new THREE.MeshStandardMaterial({ map: stand[1], normalMap: flat, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.95, envMapIntensity: 0.12 }), FLOOR_GRIME, 'floor', room);
  const owned: THREE.Texture[] = [...stand, flat], receipt: Stone['receipt'] = { bytes: 0, maps: [] };
  let disposed = false;
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
    (globalThis as { __pitStone?: Stone['receipt'] }).__pitStone = receipt;   // the look test's report (scripts/pit-stone-stills.mjs)
  }, () => {});   // the stand-ins stay: flat stone beats no Pit
  return {
    wall, floor, tile: { wall: WALL.tile, floor: FLOOR.tile }, ready, receipt,
    dispose() { disposed = true; wall.dispose(); floor.dispose(); for (const t of owned) t.dispose(); },
  };
}

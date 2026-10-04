// The Pit's room (docs/pit-design.md §1): one torch-lit stone room under the arena, built once per page from code (no model, no image
// file), merged by material so it costs a handful of draws. Room space: x −4..4, z −3..3, floor at y 0. The next-fight gate is in the far
// wall (z −3), the gear rack on the left wall (x −4), his bed, chests and table on the right wall (x +4, the trophies stand on the chests
// and the table); the arena ramp is behind the camera. The dressing is Dom's mood-board pick (2026-09-30, via Strategy): barrel vault,
// sand floor, one axis down the room to the lit gate, a wooden rack with a red shield, a sword and a spear and a helm on its shelf, one torn
// red banner, a plain bed with a wool blanket and a red throw, two iron-banded chests, a small table with jug and cup, a bull skull high on
// the wall, a worn red rug on the sand, two low warm torches. That is all; the rest are later trophy unlocks.
// Four of those are GPT's models (World's intake #1163, public/pit/props/): the rack, the table, the torch sconces and the bull skull come
// from the Stage's prop(). Nothing primitive stands in for a prop that is absent or fails to load: its spot stays bare.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Loot, LootId, Provenance } from '../loot.ts';
import type { Pose, Stage } from './stage.ts';
import type { Zone } from './mover.ts';
import type { PickTarget } from './picker.ts';
import { buildWall, type Wall } from './wall.ts';
import { pitStone, stoneTrim } from './stone.ts';
import { GATE_OPEN_S, GATE_RISE, gateLift } from './gate.ts';
import { extraSpots, machineryPose } from './machinery.ts';
import { GLOW, addBloodStains, addFence, addGlow, addGrime, addGroundBlood, addOpenSky, arenaBeyond } from './glow.ts';

import { DRESSING, clothTexture, dustPoints, fadeTexture, puffTexture, spearGeometry, swordGeometry, vaultEnds, vaultStrips } from './styles.ts';

export type Pick = Zone | `skull:${string}`;   // what a tap can pick: a zone's furniture, or one slot of the skull wall

export const ROOM = { width: 10, depth: 7.5, height: 3.4, gate: { width: 1.8, height: 2.3, passage: 3.4 } };   // the opening is the arch's own clear span (gate.glb: bars ±0.9 m, top 2.3 m), so the arch covers the hole's edge all round; the passage: how far the way out runs
export const RACK_SLOTS = 6, TROPHIES = 3;
const RACK_POST = 1.81;   // GPT's rack: its two posts are centred 1.81 m either side of its centre (1.66..1.97), 0.15 m deep, and top out at 2.5 m (measured from rack.glb)
export const HELM: THREE.Vector3Tuple = [-ROOM.width / 2 + 0.17, 2.5, RACK_POST];   // the iron helm's base: on the end post's top, its back clear of the wall
const RACK_Z = [-1.4, -0.6, 0.2];   // the rack's three peg columns (z); the shield hangs past them at +z, the sword and spear stand at −z
// Where the three trophies stand, right wall: on the two chests and the table (x, y of the piece's centre, z); a portrait frame holds all three.
const TROPHY_SPOTS: THREE.Vector3Tuple[] = [[4.45, 0.79, -1.05], [4.45, 0.79, -0.25], [4.5, 1.03, 1.05]];
// Where the hero stands and the camera looks for each pose (the `?look=pit` stills; the room PR eases between them as he walks).
export const POSES: Record<Pose, { hero: { x: number; z: number; heading: number }; camera: THREE.Vector3Tuple; target: THREE.Vector3Tuple }> = {
  rack: { hero: { x: -3.3, z: 0.5, heading: 0.5 }, camera: [3.2, 2.7, 3.0], target: [-3.6, -0.3, -0.1] },
  trophies: { hero: { x: 2.0, z: 0.6, heading: -1.0 }, camera: [-1.75, 3.1, 1.7], target: [4.45, 0.9, 0] },   // high, so all three sit over his head at 375
  gate: { hero: { x: 0, z: -1.65, heading: 0 }, camera: [0.6, 1.65, 3.35], target: [0, 1.3, -2.95] },
  vault: { hero: { x: 0, z: -1.65, heading: 0 }, camera: [0.4, 1.5, 3.45], target: [0, 3.6, -1.95] },   // Web's stone look: up at the vault and its ribs
  wall: { hero: { x: -0.6, z: -0.4, heading: -0.4 }, camera: [-1.3, 2.0, 2.0], target: [-3.5, 2.1, -3.6] },   // the skull wall's left panel, the gate's edge at the right (re-posed for the 10 x 7.5 room: check the stills)
};
// What the walking camera leans toward in each zone (the live Pit; the stills use POSES).
export const FOCUS: Record<'rack' | 'trophies' | 'gate', THREE.Vector3Tuple> = { rack: [-4.6, 1.4, 0], trophies: [4.4, 1.2, 0], gate: [0, 1.4, -3.75] };
const TORCH = '#ffb070';

// The trophy wall's pieces: the owned pieces with a provenance, highest rank first, then the most recent. v1 chooses for the player
// (a chosen set needs a loot field: v1.1, the loot owner's call).
export function trophyIds(loot: Loot, count = TROPHIES): LootId[] {
  const taken = Object.entries(loot.taken ?? {}) as [LootId, Provenance][];
  return taken.filter(([id]) => loot.owned.includes(id))
    .sort(([, a], [, b]) => (b.tier ?? 0) - (a.tier ?? 0) || b.day.localeCompare(a.day))
    .slice(0, count).map(([id]) => id);
}
// The rack's pieces: owned, not worn, not on the trophy wall, in the order they were won (the full hoard with paging is the room PR's).
export function rackIds(loot: Loot, trophies: readonly LootId[], count = RACK_SLOTS): LootId[] {
  const worn = new Set(Object.values(loot.equipped));
  return loot.owned.filter((id) => !worn.has(id) && !trophies.includes(id)).slice(0, count);
}

const hash = (x: number, y: number, s: number) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
// Coursed stone (or flags, with square blocks): per-block tone, per-pixel grit, dark mortar. sRGB bytes; the grade sits on the material.
function stoneTexture(size: number, courses: number, blocks: number, base: [number, number, number], seed: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = y / size * courses, row = Math.floor(v), u = x / size * blocks + (row % 2) * 0.5, col = Math.floor(u) % blocks;
    const mortar = Math.min(v - row, 1 - (v - row)) < 0.028 || Math.min(u % 1, 1 - (u % 1)) < 0.02;
    const tone = mortar ? 0.62 : (0.72 + 0.46 * hash(row, col, seed)) * (0.86 + 0.28 * hash(x, y, seed + 1));
    for (let c = 0; c < 3; c++) data[(y * size + x) * 4 + c] = Math.min(255, base[c] * tone * 255);
    data[(y * size + x) * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
// A soft round flame for the torch points.
function flameTexture(size = 32): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = ((y + 0.5) / size * 2 - 1) * 0.7, a = Math.max(0, 1 - Math.hypot(dx, dy)) ** 1.6;
    data.set([255, 200 + 55 * a, 120 + 120 * a, 255 * a], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// A plane or box with its UVs in metres over `tile`, placed by `at` (rotations then a translation), ready to merge.
type Place = { rx?: number; ry?: number; x?: number; y?: number; z?: number };
function placed(geometry: THREE.BufferGeometry, u: number, v: number, at: Place): THREE.BufferGeometry {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  if (at.rx) geometry.rotateX(at.rx);
  if (at.ry) geometry.rotateY(at.ry);
  return geometry.translate(at.x ?? 0, at.y ?? 0, at.z ?? 0);
}
const plane = (w: number, h: number, tile: number, at: Place) => placed(new THREE.PlaneGeometry(w, h), w / tile, h / tile, at);
const box = (w: number, h: number, d: number, tile: number, at: Place) => placed(new THREE.BoxGeometry(w, h, d), Math.max(w, d) / tile, h / tile, at);

export type Room = {
  group: THREE.Group;
  height: number;   // the ceiling: a pose camera stays under it (the cellar's is low)
  readonly extras: Promise<void>;   // GPT's extras (the gate machinery, the bucket, the whetstone) are in or given up on: asked for only after the first ready, never part of it
  readonly ready: Promise<void>;   // the LATEST stock's pieces are placed (the first build's, or the last restock's; loot.glb may still be loading)
  restock(): Promise<void>;   // hang the pieces again from the player's loot now (after a wear)
  targets: readonly PickTarget<Pick>[];   // what a tap can pick (picker.ts): the rack, the trophy wall, the gate, each skull slot; world-space boxes, not meshes
  // The gate's bars: a tap starts the lift (false when there are no bars to lift: the caller goes straight on); the room's own clock runs it.
  gate: { open(): boolean; elapsed(): number | null; reset(): void; set(progress: number): void };
  update(t: number): void;
  dispose(): void;
};

export function buildRoom(stage: Stage): Room {
  const S = DRESSING, { width: W, depth: D, gate } = ROOM, H = S.height, hw = W / 2, hd = D / 2, P = gate.passage;
  const group = new THREE.Group();
  group.name = 'Pit';
  const textures: THREE.Texture[] = [stoneTexture(256, 4, 2, [0.42, 0.38, 0.34], 11), stoneTexture(256, 2, 2, [0.36, 0.33, 0.3], 23), flameTexture()];
  const [wallMap, floorMap, flameMap] = textures as [THREE.DataTexture, THREE.DataTexture, THREE.DataTexture];
  // The room is dressed in the RING's own surfaces (Stage.arenaMaterials, clones: the ashlar with its normal map, the sand, the braziers'
  // iron), tiled as the ring tiles them (2 m), so the grain is the arena's. A stage without them (tests) gets the generated stone.
  // `?look=pit-stone` (Web's look test, stone.ts): its own wall, vault and floor instead; nothing else in the room changes.
  const L = stage.look ? pitStone({ width: W, depth: D, height: H, gate: gate.height, sconces: S.sconces }, stage.look === 'stone-proc' ? 'proc' : stage.look === 'stone-full' ? 'gpt-full' : 'gpt') : undefined;
  const A = stage.arenaMaterials?.(), T = L ? L.tile.wall : A ? 2 : 1.6, flags = L && stage.look !== 'stone-sand' && !stage.glow, TF = flags ? L.tile.floor : A ? 3 : 1.5;   // the ring tiles stone at 2 m, sand at 3 m
  const stone = L?.wall ?? A?.stone ?? new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95, envMapIntensity: 0.15 });
  const floor = (flags ? L.floor : undefined) ?? (A ? Object.assign(A.sand.clone(), { roughness: 0.95 }) : new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.9, envMapIntensity: 0.15 }));   // sand, as the ring's
  const iron = A?.iron ?? new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.55, metalness: 0.8, envMapIntensity: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.85, envMapIntensity: 0.1 });
  const daylight = new THREE.MeshBasicMaterial({ color: '#d9b37a', fog: false });   // the arena beyond the gate bars
  const flames = new THREE.PointsMaterial({ map: flameMap, color: TORCH, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  stage.grade(stone, 'stone'); stage.grade(floor, 'sand');
  // `?look=pit,pit-glow` (glow.ts): the painting's warm stone and sand floor, the flames larger, the arena's painted world beyond the bars.
  const G = !!stage.glow;
  // `?look=pit-cage` (Dom 10-04: "keep it open, more like a cage, a metal fence round it so you can see the arena's backdrop"): no vault and no
  // side or back walls; the far wall stands as the arena's outer wall (taller), iron fences close the other three sides, sand runs out past them.
  const C = G && !!stage.cage, HW = C ? 5 : H;
  if (G) { stone.color.set(GLOW.stone); if (L && L.vault !== L.wall) L.vault.color.set(GLOW.stone); floor.color.set(GLOW.sand); flames.size = 0.5; arenaBeyond(daylight, textures); }
  const materials = [stone, floor, iron, wood, daylight, flames, ...(L && L.vault !== L.wall ? [L.vault] : []), ...(A ? [A.sand, A.cloth, A.coal] : [])];

  const side = (hw - gate.width / 2), sconces: THREE.Vector3Tuple[] = C ? [[-1.9, 1.9, -hd], [1.9, 1.9, -hd]] : S.sconces;   // cage: no side walls, so the torches flank the gate on the arena wall
  const ironParts: THREE.BufferGeometry[] = [];   // the ring's iron: the chests' bands, the sword, the spear's head, the helm (the gate's bars are GPT's model, below)
  const woodParts: THREE.BufferGeometry[] = [];   // the rack itself is GPT's prop (below): 4.5 × 2.5 m against the left wall, 0.34 m deep, the helm on its end post
  const parts: [THREE.Material, THREE.BufferGeometry[]][] = [
    [stone, [
      plane(side, HW, T, { x: -hw + side / 2, y: HW / 2, z: -hd }), plane(side, HW, T, { x: hw - side / 2, y: HW / 2, z: -hd }),
      plane(gate.width, HW - gate.height, T, { y: (HW + gate.height) / 2, z: -hd }),
      ...(C ? [] : [plane(D, H, T, { ry: Math.PI / 2, x: -hw, y: H / 2 }), plane(D, H, T, { ry: -Math.PI / 2, x: hw, y: H / 2 }), plane(W, H, T, { ry: Math.PI, y: H / 2, z: hd })]),
      ...(C || (L && L.vault !== L.wall) ? [] : vaultStrips(W, D, H, 0.9, 10, T)), ...(C || (L && L.vault !== L.wall) ? [] : vaultEnds(W, D, H, 0.9, 10, T)),   // the barrel vault and its lunettes
      ...(L && !C ? stoneTrim({ width: W, depth: D, height: H, gate: gate.height, sconces: S.sconces }, 0.9, T) : []),   // the stone look's plinth, cornice and ribs
      // The way out: a short stone passage behind the bars, its walls and roof lit only by the room's torch, so it falls off into shadow
      // before the daylight at its end (Lead on the first stills: a lit passage, not a flat wall).
      plane(P, gate.height, T, { ry: Math.PI / 2, x: -gate.width / 2, y: gate.height / 2, z: -hd - P / 2 }),
      plane(P, gate.height, T, { ry: -Math.PI / 2, x: gate.width / 2, y: gate.height / 2, z: -hd - P / 2 }),
      plane(gate.width, P, T, { rx: Math.PI / 2, y: gate.height, z: -hd - P / 2 }),
    ]],
    ...(L && L.vault !== L.wall && !C ? [[L.vault, [...vaultStrips(W, D, H, 0.9, 10, L.tile.vault), ...vaultEnds(W, D, H, 0.9, 10, L.tile.vault)]] as [THREE.Material, THREE.BufferGeometry[]]] : []),   // GPT's vault set: its own material (+1 draw)
    [floor, [plane(W, D, TF, { rx: -Math.PI / 2 }), plane(gate.width, P, TF, { rx: -Math.PI / 2, z: -hd - P / 2 }),
      ...(C ? [plane(80, 40, TF, { rx: -Math.PI / 2, y: -0.005, z: 20 - hd + 0.001 })] : [])]],   // cage: the yard's sand runs out past the fences to the painted world
    [iron, ironParts], [wood, woodParts],
    [daylight, [plane(gate.width + 0.4, gate.height + 0.4, 1, { y: gate.height / 2, z: -hd - P })]],   // the arena's daylight at the passage's end
  ];
  // The dressing's extras (styles.ts): laid in with the same merge, one draw per material; the lights they need are added below.
  const geometries: THREE.BufferGeometry[] = [], lights: THREE.Light[] = [], flameSpots: THREE.Vector3Tuple[] = [...sconces];
  let wall: Wall;
  // A prop from the Stage (public/pit/props/<name>.glb): a still copy in a holder named for it, placed by the caller in the model's own
  // frame (GPT's origins: the rack and the sconce at their rear-centre mount facing +Z, the table at its base centre). Absent, a 404 or a
  // failed decode = nothing drawn and the room's ready still resolves. Geometry and material are the scene's, never disposed here.
  const props: Promise<void>[] = [];
  let disposed = false;   // a load or a stock that lands after dispose() attaches nothing to the dead room
  const mount = (name: string, place: (holder: THREE.Group, still: THREE.Mesh) => void) => props.push(new Promise<THREE.Mesh | null>((load) => load(stage.prop?.(name) ?? null)).then((asset) => {
    if (!asset || disposed) return;
    const still = new THREE.Mesh(asset.geometry, asset.material);
    still.castShadow = still.receiveShadow = true;
    if (!still.geometry.boundingBox) still.geometry.computeBoundingBox();
    const holder = new THREE.Group();
    holder.name = name;
    holder.add(still);
    place(holder, still);
    group.add(holder);
  }).catch(() => { /* the spot stays bare */ }));
  // The gate (GPT's gate.glb, #1173): the arch static in the far wall, the bars one node that rises (docs/pit-design.md §9, gate.ts). Its
  // origin is the arch's base centre, so it stands on the wall's line. Absent or failed = a bare way out, never a primitive in its place.
  let bars: THREE.Mesh | undefined, barsRest = 0, openedAt: number | null = null, now = 0, frozen = 0, lifted = 0;
  const machinery: Record<string, THREE.Object3D | undefined> = {};   // the gate machinery's nodes by name, once it has landed (extras, below)
  // One clock for everything that moves with the gate: the bars, and (when it has landed) the drum, the chains and the counterweight.
  const lift = (progress: number) => {
    lifted = progress;
    if (bars) bars.position.y = barsRest + GATE_RISE * progress;
    const pose = machineryPose(progress), { Drum, ChainLeft, ChainRight, Counterweight, ChainWeight } = machinery;
    if (Drum) Drum.rotation.x = pose.drum;
    for (const chain of [ChainLeft, ChainRight]) if (chain) { chain.position.y = pose.side.y; chain.scale.y = pose.side.scaleY; chain.visible = pose.side.visible; }
    if (Counterweight) Counterweight.position.y = pose.weight;
    if (ChainWeight) { ChainWeight.position.y = pose.weightChain.y; ChainWeight.scale.y = pose.weightChain.scaleY; }
  };
  props.push(new Promise<{ arch: THREE.Mesh; bars: THREE.Mesh } | null>((load) => load(stage.gateModel?.() ?? null)).then((nodes) => {
    if (!nodes || disposed) return;
    const holder = new THREE.Group();
    holder.name = 'gate'; holder.position.set(0, 0, -hd);
    for (const mesh of [nodes.arch, nodes.bars]) { mesh.castShadow = mesh.receiveShadow = true; holder.add(mesh); }
    // pit-glow (Dom 10-04: the entrance "like heaven"): the pale arch in the wall's own grit, a clone so the shared model stays as it is.
    if (G && nodes.arch.material instanceof THREE.MeshStandardMaterial) { const arch = nodes.arch.material.clone(); arch.color.set(GLOW.arch); materials.push(arch); nodes.arch.material = arch; }
    bars = nodes.bars; barsRest = bars.position.y;
    lift(frozen);   // a still that asked for the gate part-way up (the look flag) before it landed
    group.add(holder);
  }).catch(() => { /* a bare way out */ }));
  {
    const spill = new THREE.MeshBasicMaterial({ map: puffTexture(), color: '#ffd9a0', transparent: true, opacity: G ? 0.08 : 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
    const smoke = new THREE.PointsMaterial({ map: puffTexture(), color: '#6a6058', size: 0.55, transparent: true, opacity: 0.22, depthWrite: false });
    textures.push(spill.map!, smoke.map!);
    materials.push(spill, smoke);
    parts.push([spill, [plane(3.2, 3.8, 1, { rx: -Math.PI / 2, y: 0.01, z: -hd + 1.7 })]]);   // the arena's light on the sand inside the bars
    // The props, in the arena's grain: red wool (the rug, the throw, the shield's face), grey wool (the blanket), the banner's cloth, gold
    // (the laurel), fired clay (the jug and cup). Each is one merged draw.
    const redWool = new THREE.MeshStandardMaterial({ color: '#7a1c18', roughness: 0.95 }), wool = new THREE.MeshStandardMaterial({ color: '#8a7f6e', roughness: 0.98 });
    const gold = new THREE.MeshStandardMaterial({ color: '#c9a244', roughness: 0.35, metalness: 0.9, envMapIntensity: 0.6 });
    const clay = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.8 });
    const rugMap = clothTexture([0.48, 0.1, 0.09], 4), rug = new THREE.MeshStandardMaterial({ map: rugMap, roughness: 0.98, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1 });
    const banner = new THREE.MeshStandardMaterial({ map: clothTexture([0.45, 0.08, 0.08], 9), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 });
    textures.push(rugMap, banner.map!); materials.push(redWool, wool, gold, clay, rug, banner);
    // The skull wall (wall.ts): the far wall's two panels either side of the gate, in bone; stocked from loot.defeats with the rest.
    const bone = new THREE.MeshStandardMaterial({ color: '#a89c84', roughness: 0.85 });
    materials.push(bone);
    wall = buildWall(stage, group, stage.legendKeys(), -hd, bone);
    // Left wall, the rack (GPT's, at real scale: its 4.5 × 2.5 m is the run the wall's rack always had, so the pegs and the pieces keep
    // their spots; Lead 2026-09-30): the round red shield with its gold laurel at the far end, the sword and the spear standing by the near
    // post, the helm on its end post, the torn banner behind the near end. The dressing hangs proud of the rack's 0.34 m face, as the pieces do.
    mount('rack', (holder) => { holder.position.set(-hw, 1.25, 0); holder.rotation.y = Math.PI / 2; });   // rear-centre mount on the wall, facing +x
    const shield = placed(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 24), 1, 1, { rx: Math.PI / 2, ry: Math.PI / 2, x: -hw + 0.4, y: 1.55, z: 1.15 });
    const laurel = placed(new THREE.TorusGeometry(0.27, 0.035, 8, 28), 1, 1, { ry: Math.PI / 2, x: -hw + 0.44, y: 1.55, z: 1.15 });
    const boss = placed(new THREE.SphereGeometry(0.07, 10, 8), 1, 1, { x: -hw + 0.44, y: 1.55, z: 1.15 });
    const sword = swordGeometry().map((g) => g.rotateZ(-0.06).translate(-hw + 0.44, 0, -1.75)), spear = spearGeometry();
    spear.shaft.rotateZ(-0.08).translate(-hw + 0.46, 0, -2.0); spear.head.rotateZ(-0.08).translate(-hw + 0.46, 0, -2.0);
    // The helm caps the rack's end post by the banner (GPT's rack has no shelf: its posts top out at 2.5 m, 1.81 m either side of centre).
    const helm = [placed(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 1, 1, { x: HELM[0], y: HELM[1], z: HELM[2] }), box(0.06, 0.16, 0.34, 1, { x: HELM[0], y: HELM[1] + 0.23, z: HELM[2] }), box(0.3, 0.12, 0.34, 1, { x: HELM[0], y: HELM[1] + 0.03, z: HELM[2] })];
    const redParts: THREE.BufferGeometry[] = [shield];
    parts.push([redWool, redParts]);
    parts.push([gold, [laurel, boss]]);
    ironParts.push(...sword, spear.head, ...helm);
    woodParts.push(spear.shaft);
    if (!G) parts.push([banner, [plane(0.75, 1.4, 1, { ry: Math.PI / 2, x: -hw + 0.03, y: 2.05, z: 2.75 })]]);
    // Right wall: the bed along the wall by the ramp end, the two chests toward the gate, the table between, the skull high above them.
    const bed = { x: hw - 0.55, z: 2.1 };
    woodParts.push(...[[-0.4, -0.85], [0.4, -0.85], [-0.4, 0.85], [0.4, 0.85]].map(([dx, dz]) => box(0.1, 0.4, 0.1, 2, { x: bed.x + dx!, y: 0.2, z: bed.z + dz! })), box(1.0, 0.1, 1.9, 2, { x: bed.x, y: 0.42, z: bed.z }), box(0.1, 0.5, 1.0, 2, { x: bed.x, y: 0.7, z: bed.z + 0.95 }));   // legs, slab, headboard
    parts.push([wool, [box(0.94, 0.16, 1.8, 1, { x: bed.x, y: 0.55, z: bed.z })]]);
    redParts.push(box(0.96, 0.06, 0.8, 1, { x: bed.x, y: 0.66, z: bed.z - 0.45 }));   // the red throw at the foot
    for (const z of [-1.05, -0.25]) {   // the iron-banded chests: a wood box, two iron bands, a hasp
      woodParts.push(box(0.6, 0.5, 0.75, 1, { x: hw - 0.5, y: 0.25, z }));
      ironParts.push(...[-0.22, 0.22].map((dz) => box(0.63, 0.53, 0.05, 1, { x: hw - 0.5, y: 0.25, z: z + dz })), box(0.04, 0.12, 0.08, 1, { x: hw - 0.82, y: 0.3, z }));
    }
    // The table (GPT's, 0.94 × 0.74 × 0.70 m at its base centre): its long side along the wall, its top brought to 0.775 m where the jug, the
    // cup and the third trophy stand.
    mount('table', (holder, still) => { holder.position.set(hw - 0.5, 0, 1.0); holder.rotation.y = Math.PI / 2; holder.scale.setScalar(0.775 / Math.max(still.geometry.boundingBox!.max.y, 1e-3)); });
    parts.push([clay, [placed(new THREE.CylinderGeometry(0.07, 0.09, 0.24, 10), 1, 1, { x: hw - 0.5, y: 0.895, z: 0.68 }), placed(new THREE.CylinderGeometry(0.045, 0.035, 0.08, 8), 1, 1, { x: hw - 0.68, y: 0.815, z: 0.62 })]]);   // jug and cup
    // The bull skull high over the chests (Dom's pick): GPT's model (1.1 × 1.2 m real) fitted to 0.7 m and turned to face the room.
    mount('bull-skull', (holder, still) => {
      const bounds = still.geometry.boundingBox!, centre = bounds.getCenter(new THREE.Vector3()), extent = bounds.getSize(new THREE.Vector3());
      still.position.copy(centre).negate();
      holder.scale.setScalar(0.7 / Math.max(extent.x, extent.y, extent.z, 1e-3));
      holder.position.set(hw - 0.25, 2.75, 0.3);
      holder.rotation.y = -Math.PI / 2;   // the model faces +Z; the right wall faces −X
    });
    // The torch sconces (GPT's, 0.2 × 0.44 × 0.22 m, the origin on the back of the mounting plate, the bracket hanging below it): one on
    // each side wall at the far end, the flame point at its top, out from the wall by the bracket's reach.
    sconces.forEach(([x, y, z], i) => {
      const inward = x < 0 ? 1 : -1;
      // the sconce faces its own +z: on a side wall it turns a quarter inward, on the cage's far wall it faces straight into the yard
      if (C) { mount('sconce', (holder) => { holder.position.set(x, y - 0.04, z + 0.08); }); flameSpots[i] = [x, y, z + 0.1]; return; }
      mount('sconce', (holder) => { holder.position.set(x - inward * 0.08, y - 0.04, z); holder.rotation.y = inward * Math.PI / 2; });
      flameSpots[i] = [x + inward * 0.1, y, z];
    });
    if (!G) parts.push([rug, [plane(1.6, 2.6, 1, { rx: -Math.PI / 2, y: 0.012, z: 0.2 })]]);   // the worn red rug down the axis
    const puffs = sconces.flatMap(([x, y, z]) => [0, 1, 2, 3].map((k) => [x + (x < 0 ? 0.12 : -0.12) * (k + 1), y + 0.25 + k * 0.28, z + (k % 2 ? 0.08 : -0.08)] as THREE.Vector3Tuple));
    const smokeGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(puffs.flat(), 3));
    geometries.push(smokeGeometry); group.add(new THREE.Points(smokeGeometry, smoke));
    const gateLight = new THREE.PointLight(G ? GLOW.light : '#ffe0b0', G ? 2.5 : 6, G ? 9 : 7, 2); gateLight.position.set(0, 1.6, G ? -hd - 0.6 : -hd + 0.5); lights.push(gateLight);   // pit-glow: back in the passage, so it comes THROUGH the bars and does not gild the wall (Dom 10-04)
  }
  {
    // Light: one warm KEY (the torch, a spot that casts contact shadows), one cool FILL from the gate, and the point light turned down
    // to a glow. AO where there is none: a dark fade at every wall's foot and a soft dark disc under each prop and plinth. Dust in the key's cone.
    const keyAt = sconces[0] ?? [-hw + 0.08, 2.2, 0], key = new THREE.SpotLight(TORCH, S.torch * (G ? 2.2 : 1.6), 14, 1.05, 0.7, 1.4);
    key.position.set(keyAt[0] * 0.8, keyAt[1] + 0.35, keyAt[2] * 0.8); key.target.position.set(0.6, 0.4, -0.4); group.add(key.target);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.camera.near = 0.3; key.shadow.camera.far = 14;
    const fill = new THREE.PointLight(G ? GLOW.fill : '#a9bfd6', G ? 2 : 2.4, 9, 2); fill.position.set(0, 1.9, G ? 0.5 : -hd + 0.4);   // pit-glow: mid-room, not a hot spot on the gate wall
    lights.push(key, fill);
    if (G) lights.push(new THREE.HemisphereLight('#ffcf96', '#5a341a', 1.4));   // pit-glow: the room's warm bounce, so no wall falls to brown
    const ao = new THREE.MeshBasicMaterial({ map: fadeTexture(), color: '#000', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const blob = new THREE.MeshBasicMaterial({ map: puffTexture(), color: '#000', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const dust = new THREE.PointsMaterial({ map: puffTexture(), color: '#ffcf9a', size: 0.05, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    textures.push(ao.map!, blob.map!, dust.map!); materials.push(ao, blob, dust);
    const foot = 0.55;
    parts.push([ao, [
      plane(W, foot, 1, { y: foot / 2, z: -hd + 0.01 }), plane(W, foot, 1, { ry: Math.PI, y: foot / 2, z: hd - 0.01 }),
      plane(D, foot, 1, { ry: Math.PI / 2, x: -hw + 0.01, y: foot / 2 }), plane(D, foot, 1, { ry: -Math.PI / 2, x: hw - 0.01, y: foot / 2 }),
    ]]);
    const under: [number, number, number][] = [[0.9, hw - 0.55, 2.1], [0.55, hw - 0.5, -1.05], [0.55, hw - 0.5, -0.25], [0.6, hw - 0.5, 1.0], [0.3, -hw + 0.12, -RACK_POST], [0.3, -hw + 0.12, RACK_POST]];
    parts.push([blob, under.map(([r, x, z]) => placed(new THREE.CircleGeometry(r, 16), 1, 1, { rx: -Math.PI / 2, x, y: 0.004, z }))]);
    const dir = key.target.position.clone().sub(key.position).normalize();
    const dustGeometry = dustPoints(key.position.toArray() as THREE.Vector3Tuple, dir, 0.7, 5.5, 220, 17);
    geometries.push(dustGeometry); group.add(new THREE.Points(dustGeometry, dust));
  }
  for (const [material, list] of parts) {
    if (!list.length) continue;   // a material with nothing to draw yet (bone: the skulls are props that land later)
    const merged = mergeGeometries(list);
    for (const g of list) g.dispose();
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.receiveShadow = material !== daylight;
    mesh.castShadow = material === stone || material === iron || material === wood;   // the key's contact shadows
    group.add(mesh);
  }
  if (C) { const fence = addFence(group, W, D, iron); geometries.push(fence); const open = addOpenSky(group); textures.push(...open.textures); materials.push(...(open.materials as typeof materials)); geometries.push(...open.geometries); }
  if (G) for (const glow of [addGlow(group, gate, -hd), ...(stage.noise ? [addBloodStains(group, W, D, stage.noise)] : []), addGroundBlood(group), ...(stage.noise ? [addGrime(group, { width: W, depth: D, height: H, gateWidth: gate.width }, sconces[0]?.[2] ?? -3.15, stage.noise, C)] : [])]) { textures.push(...glow.textures); materials.push(...glow.materials); geometries.push(...glow.geometries); }
  const flamePoints = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(flameSpots.flat(), 3));
  geometries.push(flamePoints);
  group.add(new THREE.Points(flamePoints, flames));
  const light = new THREE.PointLight(TORCH, S.torch * (G ? 0.8 : 0.45), 0, 2);   // the torches' glow (docs/pit-design.md §6); the key, fill and gate lights are above
  light.position.set(-0.4, 2.1, 0.4);
  group.add(light, ...lights);

  // Pieces: still copies from loot.glb, fitted into a box of `size` metres and centred on their spot. Their geometry and material are the
  // loot file's (Stage.pieces): the room frees only its own wrappers.
  const pieces = new THREE.Group();
  group.add(pieces);
  const hang = (mesh: THREE.Mesh, size: number, at: THREE.Vector3Tuple, turn: number) => {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox!, centre = bounds.getCenter(new THREE.Vector3()), extent = bounds.getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    mesh.position.copy(centre).negate();
    holder.add(mesh);
    holder.scale.setScalar(size / Math.max(extent.x, extent.y, extent.z, 1e-3));
    holder.position.set(...at);
    holder.rotation.y = turn;
    pieces.add(holder);
  };
  const byId = (list: THREE.Mesh[], id: LootId) => list.find((m) => (m.userData.ids as string[]).includes(id));
  // Hang what the player owns now: called on build and after every wear, so the rack never shows the piece he just put on. The
  // holders are plain groups over shared loot geometry; clearing them frees nothing on the GPU.
  let stocking = 0;
  const stock = (loot: Loot): Promise<void> => {
    const trophies = trophyIds(loot), rack = rackIds(loot, trophies), mine = ++stocking;
    wall.restock((loot as Loot & { defeats?: string[] }).defeats);   // Backend's per-legend defeat field (#1156); absent = no skulls
    return stage.pieces([...trophies, ...rack]).then((list) => {
      if (mine !== stocking || disposed) return;   // a later wear has already restocked
      pieces.clear();
      trophies.forEach((id, i) => { const m = byId(list, id); if (m) hang(m, 0.5, TROPHY_SPOTS[i]!, -Math.PI / 2); });
      rack.forEach((id, i) => { const m = byId(list, id); if (m) hang(m, 0.55, [-hw + 0.42, i < 3 ? 1.95 : 1.2, RACK_Z[i % 3]!], Math.PI / 2); });
    });
  };
  let ready: Promise<void> = Promise.all([wall.ready, ...props, stock(stage.loot())]).then(() => undefined);   // a restock replaces it: a visit's ready is the stock that visit hung, not the first build's. The stone look's maps are not waited on: its flat stand-ins show first (Lead: never wait on a look)
  // GPT's extras (World's intake #3: the gate machinery, a water bucket, a whetstone wheel): asked for only once the first ready has resolved, so the
  // pack (~1.3 MB) never competes with the room for the first paint, and never part of ready. Each is a copy of the page's cached tree, placed from the
  // room's own walls (machinery.ts); absent or failed = a bare spot. The machinery's nodes are kept by name for the gate's clock (lift, above).
  const spots = extraSpots(hw, hd);
  const extras = ready.then(() => Promise.all((['gate-machinery', 'water-bucket', 'whetstone-wheel'] as const).map((name) =>
    new Promise<THREE.Group | null>((load) => load(stage.extra?.(name) ?? null)).then((tree) => {
      if (!tree || disposed) return;
      const holder = new THREE.Group();
      holder.name = name;
      const copy = tree.clone(true);
      copy.traverse((o) => { if (o instanceof THREE.Mesh) o.receiveShadow = true; });
      holder.add(copy);
      if (name === 'gate-machinery') {
        holder.position.set(0, 0, -hd);   // gate-base coordinates: the gate's own origin, in its wall opening
        for (const node of copy.children) machinery[node.name] = node;
      } else { const [x, z, turn] = spots[name]; holder.position.set(x, 0, z); holder.rotation.y = turn; }
      group.add(holder);
      lift(lifted);
    }).catch(() => { /* a bare spot */ })))).then(() => undefined);
  stage.scene.add(group);   // last: a build that throws (the loot read) leaves nothing half-built in the scene

  // The pick volumes: the rack's frame with its shelf and the pieces on it, the trophy wall's chests, table and skull, the gate's opening.
  const targets: PickTarget<Pick>[] = [
    { id: 'rack', box: new THREE.Box3(new THREE.Vector3(-hw, 0.3, -2.3), new THREE.Vector3(-hw + 0.75, 2.9, 2.3)) },
    { id: 'trophies', box: new THREE.Box3(new THREE.Vector3(hw - 1.0, 0, -1.6), new THREE.Vector3(hw, 3.15, 1.6)) },
    { id: 'gate', box: new THREE.Box3(new THREE.Vector3(-gate.width / 2, 0, -hd - 0.3), new THREE.Vector3(gate.width / 2, gate.height, -hd + 0.1)) },
    ...wall.targets,
  ];

  return {
    group, height: H, get ready() { return ready; }, extras, restock: () => (ready = Promise.all([wall.ready, ...props, stock(stage.loot())]).then(() => undefined)), targets,
    gate: {
      open() { if (!bars) return false; openedAt ??= now; return true; },
      elapsed() { return openedAt === null ? null : now - openedAt; },
      reset() { openedAt = null; frozen = 0; lift(0); },
      set(progress) { frozen = progress; lift(progress); },
    },
    update(t) {   // torchlight breathes: two incommensurate sines, as the arena's firelight theme does
      now = t;
      if (openedAt !== null) lift(gateLift(Math.min(t - openedAt, GATE_OPEN_S)));
      const f = 1 + 0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.3);
      light.intensity = S.torch * 0.45 * f;
      flames.size = 0.34 * (0.94 + 0.08 * f);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stage.scene.remove(group);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      L?.dispose();
      for (const l of lights) l.dispose();   // the key's shadow map
      wall.dispose();
      pieces.clear();
    },
  };
}

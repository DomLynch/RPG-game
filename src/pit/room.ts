// The Pit's room (docs/pit-design.md §1): one torch-lit stone room under the arena, built once per page from code (no model, no image
// file), merged by material so it costs a handful of draws. Room space: x −4..4, z −3..3, floor at y 0. The next-fight gate is in the far
// wall (z −3), the gear rack on the left wall (x −4), his bed, chests and table on the right wall (x +4, the trophies stand on the chests
// and the table); the arena ramp is behind the camera. The dressing is Dom's mood-board pick (2026-09-30, via Strategy): barrel vault,
// sand floor, one axis down the room to the lit gate, a wooden rack with a red shield, a sword and a spear and a helm on its shelf, one torn
// red banner, a plain bed with a wool blanket and a red throw, two iron-banded chests, a small table with jug and cup, a bull skull high on
// the wall, a worn red rug on the sand, two low warm torches. That is all; the rest are later trophy unlocks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Loot, LootId, Provenance } from '../loot.ts';
import type { Pose, Stage } from './stage.ts';
import { pitStone, stoneTrim } from './stone.ts';
import { DRESSING, clothTexture, dustPoints, fadeTexture, puffTexture, spearGeometry, swordGeometry, vaultEnds, vaultStrips } from './styles.ts';

export const ROOM = { width: 8, depth: 6, height: 3.4, gate: { width: 2.2, height: 2.7, passage: 3.4 } };   // the passage: how far the way out runs
export const RACK_SLOTS = 6, TROPHIES = 3;
const RACK_Z = [-1.4, -0.6, 0.2];   // the rack's three peg columns (z); the shield hangs past them at +z, the sword and spear stand at −z
// Where the three trophies stand, right wall: on the two chests and the table (x, y of the piece's centre, z); a portrait frame holds all three.
const TROPHY_SPOTS: THREE.Vector3Tuple[] = [[3.45, 0.79, -1.05], [3.45, 0.79, -0.25], [3.5, 1.03, 1.05]];
// Where the hero stands and the camera looks for each pose (the `?look=pit` stills; the room PR eases between them as he walks).
export const POSES: Record<Pose, { hero: { x: number; z: number; heading: number }; camera: THREE.Vector3Tuple; target: THREE.Vector3Tuple }> = {
  rack: { hero: { x: -2.3, z: 0.5, heading: 0.5 }, camera: [2.2, 1.75, 2.5], target: [-2.6, 1.15, -0.1] },
  trophies: { hero: { x: 1.0, z: 0.6, heading: -1.0 }, camera: [-1.0, 2.6, 1.2], target: [3.45, 0.9, 0] },   // high, so all three sit over his head at 375
  gate: { hero: { x: 0, z: -0.9, heading: 0 }, camera: [0.6, 1.65, 2.6], target: [0, 1.3, -2.2] },
};
// What the walking camera leans toward in each zone (the live Pit; the stills use POSES).
export const FOCUS: Record<'rack' | 'trophies' | 'gate', THREE.Vector3Tuple> = { rack: [-3.6, 1.4, 0], trophies: [3.4, 1.2, 0], gate: [0, 1.4, -3] };
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
  ready: Promise<void>;   // the rack and trophy pieces are placed (loot.glb may still be loading when the room first shows)
  restock(): Promise<void>;   // hang the pieces again from the player's loot now (after a wear)
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
  const L = stage.look === 'stone' ? pitStone({ width: W, depth: D, height: H, sconces: S.sconces }) : undefined;
  const A = stage.arenaMaterials?.(), T = L ? L.tile.wall : A ? 2 : 1.6, TF = L ? L.tile.floor : A ? 3 : 1.5;   // the ring tiles stone at 2 m, sand at 3 m
  const stone = L?.wall ?? A?.stone ?? new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95, envMapIntensity: 0.15 });
  const floor = L?.floor ?? (A ? Object.assign(A.sand.clone(), { roughness: 0.95 }) : new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.9, envMapIntensity: 0.15 }));   // sand, as the ring's
  const iron = A?.iron ?? new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.55, metalness: 0.8, envMapIntensity: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.85, envMapIntensity: 0.1 });
  const daylight = new THREE.MeshBasicMaterial({ color: '#d9b37a', fog: false });   // the arena beyond the gate bars
  const flames = new THREE.PointsMaterial({ map: flameMap, color: TORCH, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  stage.grade(stone, 'stone'); stage.grade(floor, 'sand');
  const materials = [stone, floor, iron, wood, daylight, flames, ...(A ? [A.sand, A.cloth, A.coal] : [])];

  const side = (hw - gate.width / 2), sconces: THREE.Vector3Tuple[] = S.sconces;
  const ironParts: THREE.BufferGeometry[] = [   // the ring's iron: the gate's bars, the sconces, the rack's pegs, the chests' bands
      ...Array.from({ length: 9 }, (_, i) => box(0.05, gate.height, 0.05, 1, { x: -gate.width / 2 + 0.15 + i * (gate.width - 0.3) / 8, y: gate.height / 2, z: -hd - 0.05 })),
      ...[0.5, 1.4, 2.3].map((y) => box(gate.width, 0.06, 0.06, 1, { y, z: -hd - 0.05 })),
      ...sconces.map(([x, y, z]) => box(0.1, 0.3, 0.1, 1, { x, y: y - 0.2, z })),
      ...[1.25, 2.0].flatMap((y) => RACK_Z.map((z) => box(0.26, 0.04, 0.04, 1, { x: -hw + 0.3, y: y + 0.08, z }))),   // rack pegs
  ];
  const woodParts: THREE.BufferGeometry[] = [
    ...[-2.2, 2.2].map((z) => box(0.12, 2.5, 0.12, 2, { x: -hw + 0.12, y: 1.25, z })),   // rack posts
    ...[1.25, 2.0].map((y) => box(0.1, 0.1, 4.5, 2, { x: -hw + 0.14, y, z: 0 })),   // rack rails
    box(0.34, 0.05, 4.5, 2, { x: -hw + 0.17, y: 2.5, z: 0 }),   // the shelf above (the helm's)
  ];
  const parts: [THREE.Material, THREE.BufferGeometry[]][] = [
    [stone, [
      plane(side, H, T, { x: -hw + side / 2, y: H / 2, z: -hd }), plane(side, H, T, { x: hw - side / 2, y: H / 2, z: -hd }),
      plane(gate.width, H - gate.height, T, { y: (H + gate.height) / 2, z: -hd }),
      plane(D, H, T, { ry: Math.PI / 2, x: -hw, y: H / 2 }), plane(D, H, T, { ry: -Math.PI / 2, x: hw, y: H / 2 }),
      plane(W, H, T, { ry: Math.PI, y: H / 2, z: hd }),
      ...vaultStrips(W, D, H, 0.9, 10, T), ...vaultEnds(W, D, H, 0.9, 10, T),   // the barrel vault and its lunettes
      ...(L ? stoneTrim({ width: W, depth: D, height: H, sconces: S.sconces }, 0.9, T) : []),   // the stone look's plinth, cornice and ribs
      // The way out: a short stone passage behind the bars, its walls and roof lit only by the room's torch, so it falls off into shadow
      // before the daylight at its end (Lead on the first stills: a lit passage, not a flat wall).
      plane(P, gate.height, T, { ry: Math.PI / 2, x: -gate.width / 2, y: gate.height / 2, z: -hd - P / 2 }),
      plane(P, gate.height, T, { ry: -Math.PI / 2, x: gate.width / 2, y: gate.height / 2, z: -hd - P / 2 }),
      plane(gate.width, P, T, { rx: Math.PI / 2, y: gate.height, z: -hd - P / 2 }),
    ]],
    [floor, [plane(W, D, TF, { rx: -Math.PI / 2 }), plane(gate.width, P, TF, { rx: -Math.PI / 2, z: -hd - P / 2 })]],
    [iron, ironParts], [wood, woodParts],
    [daylight, [plane(gate.width + 0.4, gate.height + 0.4, 1, { y: gate.height / 2, z: -hd - P })]],   // the arena's daylight at the passage's end
  ];
  // The dressing's extras (styles.ts): laid in with the same merge, one draw per material; the lights they need are added below.
  const geometries: THREE.BufferGeometry[] = [], lights: THREE.Light[] = [], flameSpots: THREE.Vector3Tuple[] = [...sconces];
  {
    const spill = new THREE.MeshBasicMaterial({ map: puffTexture(), color: '#ffd9a0', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
    const smoke = new THREE.PointsMaterial({ map: puffTexture(), color: '#6a6058', size: 0.55, transparent: true, opacity: 0.22, depthWrite: false });
    textures.push(spill.map!, smoke.map!);
    materials.push(spill, smoke);
    parts.push([spill, [plane(3.2, 3.8, 1, { rx: -Math.PI / 2, y: 0.01, z: -hd + 1.7 })]]);   // the arena's light on the sand inside the bars
    // The props, in the arena's grain: red wool (the rug, the throw, the shield's face), grey wool (the blanket), the banner's cloth, gold
    // (the laurel), bone (the skull), fired clay (the jug and cup). Each is one merged draw.
    const redWool = new THREE.MeshStandardMaterial({ color: '#7a1c18', roughness: 0.95 }), wool = new THREE.MeshStandardMaterial({ color: '#8a7f6e', roughness: 0.98 });
    const gold = new THREE.MeshStandardMaterial({ color: '#c9a244', roughness: 0.35, metalness: 0.9, envMapIntensity: 0.6 });
    const bone = new THREE.MeshStandardMaterial({ color: '#a89c84', roughness: 0.85 }), clay = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.8 });
    const rugMap = clothTexture([0.48, 0.1, 0.09], 4), rug = new THREE.MeshStandardMaterial({ map: rugMap, roughness: 0.98, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1 });
    const banner = new THREE.MeshStandardMaterial({ map: clothTexture([0.45, 0.08, 0.08], 9), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 });
    textures.push(rugMap, banner.map!); materials.push(redWool, wool, gold, bone, clay, rug, banner);
    // Left wall, the rack: the round red shield with its gold laurel at the far end, the sword and the spear standing by the near post,
    // the helm on the shelf, the torn banner behind the rack's near end.
    const shield = placed(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 24), 1, 1, { rx: Math.PI / 2, ry: Math.PI / 2, x: -hw + 0.3, y: 1.55, z: 1.15 });
    const laurel = placed(new THREE.TorusGeometry(0.27, 0.035, 8, 28), 1, 1, { ry: Math.PI / 2, x: -hw + 0.34, y: 1.55, z: 1.15 });
    const boss = placed(new THREE.SphereGeometry(0.07, 10, 8), 1, 1, { x: -hw + 0.34, y: 1.55, z: 1.15 });
    const sword = swordGeometry().map((g) => g.rotateZ(-0.06).translate(-hw + 0.22, 0, -1.75)), spear = spearGeometry();
    spear.shaft.rotateZ(-0.08).translate(-hw + 0.24, 0, -2.0); spear.head.rotateZ(-0.08).translate(-hw + 0.24, 0, -2.0);
    const helm = [placed(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 1, 1, { x: -hw + 0.19, y: 2.53, z: 0.3 }), box(0.06, 0.16, 0.34, 1, { x: -hw + 0.19, y: 2.76, z: 0.3 }), box(0.3, 0.12, 0.34, 1, { x: -hw + 0.19, y: 2.56, z: 0.3 })];
    const redParts: THREE.BufferGeometry[] = [shield], boneParts: THREE.BufferGeometry[] = [];
    parts.push([redWool, redParts], [bone, boneParts]);
    parts.push([gold, [laurel, boss]]);
    ironParts.push(...sword, spear.head, ...helm);
    woodParts.push(spear.shaft);
    parts.push([banner, [plane(0.75, 1.4, 1, { ry: Math.PI / 2, x: -hw + 0.03, y: 2.05, z: 2.75 })]]);
    // Right wall: the bed along the wall by the ramp end, the two chests toward the gate, the table between, the skull high above them.
    const bed = { x: hw - 0.55, z: 2.1 };
    woodParts.push(...[[-0.4, -0.85], [0.4, -0.85], [-0.4, 0.85], [0.4, 0.85]].map(([dx, dz]) => box(0.1, 0.4, 0.1, 2, { x: bed.x + dx!, y: 0.2, z: bed.z + dz! })), box(1.0, 0.1, 1.9, 2, { x: bed.x, y: 0.42, z: bed.z }), box(0.1, 0.5, 1.0, 2, { x: bed.x, y: 0.7, z: bed.z + 0.95 }));   // legs, slab, headboard
    parts.push([wool, [box(0.94, 0.16, 1.8, 1, { x: bed.x, y: 0.55, z: bed.z })]]);
    redParts.push(box(0.96, 0.06, 0.8, 1, { x: bed.x, y: 0.66, z: bed.z - 0.45 }));   // the red throw at the foot
    for (const z of [-1.05, -0.25]) {   // the iron-banded chests: a wood box, two iron bands, a hasp
      woodParts.push(box(0.6, 0.5, 0.75, 1, { x: hw - 0.5, y: 0.25, z }));
      ironParts.push(...[-0.22, 0.22].map((dz) => box(0.63, 0.53, 0.05, 1, { x: hw - 0.5, y: 0.25, z: z + dz })), box(0.04, 0.12, 0.08, 1, { x: hw - 0.82, y: 0.3, z }));
    }
    woodParts.push(box(0.7, 0.05, 0.95, 1, { x: hw - 0.5, y: 0.75, z: 1.0 }), ...[[-0.28, -0.4], [0.28, -0.4], [-0.28, 0.4], [0.28, 0.4]].map(([dx, dz]) => box(0.06, 0.73, 0.06, 1, { x: hw - 0.5 + dx!, y: 0.365, z: 1.0 + dz! })));   // the table
    parts.push([clay, [placed(new THREE.CylinderGeometry(0.07, 0.09, 0.24, 10), 1, 1, { x: hw - 0.5, y: 0.895, z: 0.68 }), placed(new THREE.CylinderGeometry(0.045, 0.035, 0.08, 8), 1, 1, { x: hw - 0.68, y: 0.815, z: 0.62 })]]);   // jug and cup
    // The bull skull, high on the wall: a long face (a sphere drawn out downward), a brow across it, and two horns that sweep up and out.
    const skull = [new THREE.SphereGeometry(0.17, 12, 10).scale(0.55, 1.35, 0.85).translate(hw - 0.15, 2.62, 0.3), box(0.12, 0.14, 0.62, 1, { x: hw - 0.14, y: 2.8, z: 0.3 })];
    // Each horn is an arc that starts at its end of the brow and sweeps up and out: built in the wall's plane (local x → world z).
    const horn = (side: number) => { const r = 0.24, arc = Math.PI * 0.55, g = new THREE.TorusGeometry(r, 0.045, 8, 18, arc); g.rotateZ(side > 0 ? -Math.PI / 2 : -Math.PI / 2 - arc); g.rotateY(-Math.PI / 2); return g.translate(hw - 0.18, 2.8 + r, 0.3 + side * 0.31); };
    boneParts.push(...skull, horn(-1), horn(1));
    parts.push([rug, [plane(1.6, 2.6, 1, { rx: -Math.PI / 2, y: 0.012, z: 0.2 })]]);   // the worn red rug down the axis
    const puffs = sconces.flatMap(([x, y, z]) => [0, 1, 2, 3].map((k) => [x + (x < 0 ? 0.12 : -0.12) * (k + 1), y + 0.25 + k * 0.28, z + (k % 2 ? 0.08 : -0.08)] as THREE.Vector3Tuple));
    const smokeGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(puffs.flat(), 3));
    geometries.push(smokeGeometry); group.add(new THREE.Points(smokeGeometry, smoke));
    const gateLight = new THREE.PointLight('#ffe0b0', 6, 7, 2); gateLight.position.set(0, 1.6, -hd + 0.5); lights.push(gateLight);
  }
  {
    // Light: one warm KEY (the torch, a spot that casts contact shadows), one cool FILL from the gate, and the point light turned down
    // to a glow. AO where there is none: a dark fade at every wall's foot and a soft dark disc under each prop and plinth. Dust in the key's cone.
    const keyAt = sconces[0] ?? [-hw + 0.08, 2.2, 0], key = new THREE.SpotLight(TORCH, S.torch * 1.6, 14, 1.05, 0.7, 1.4);
    key.position.set(keyAt[0] * 0.8, keyAt[1] + 0.35, keyAt[2] * 0.8); key.target.position.set(0.6, 0.4, -0.4); group.add(key.target);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.camera.near = 0.3; key.shadow.camera.far = 14;
    const fill = new THREE.PointLight('#a9bfd6', 2.4, 9, 2); fill.position.set(0, 1.9, -hd + 0.4);
    lights.push(key, fill);
    const ao = new THREE.MeshBasicMaterial({ map: fadeTexture(), color: '#000', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const blob = new THREE.MeshBasicMaterial({ map: puffTexture(), color: '#000', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const dust = new THREE.PointsMaterial({ map: puffTexture(), color: '#ffcf9a', size: 0.05, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    textures.push(ao.map!, blob.map!, dust.map!); materials.push(ao, blob, dust);
    const foot = 0.55;
    parts.push([ao, [
      plane(W, foot, 1, { y: foot / 2, z: -hd + 0.01 }), plane(W, foot, 1, { ry: Math.PI, y: foot / 2, z: hd - 0.01 }),
      plane(D, foot, 1, { ry: Math.PI / 2, x: -hw + 0.01, y: foot / 2 }), plane(D, foot, 1, { ry: -Math.PI / 2, x: hw - 0.01, y: foot / 2 }),
    ]]);
    const under: [number, number, number][] = [[0.9, hw - 0.55, 2.1], [0.55, hw - 0.5, -1.05], [0.55, hw - 0.5, -0.25], [0.6, hw - 0.5, 1.0], [0.3, -hw + 0.12, -2.2], [0.3, -hw + 0.12, 2.2]];
    parts.push([blob, under.map(([r, x, z]) => placed(new THREE.CircleGeometry(r, 16), 1, 1, { rx: -Math.PI / 2, x, y: 0.004, z }))]);
    const dir = key.target.position.clone().sub(key.position).normalize();
    const dustGeometry = dustPoints(key.position.toArray() as THREE.Vector3Tuple, dir, 0.7, 5.5, 220, 17);
    geometries.push(dustGeometry); group.add(new THREE.Points(dustGeometry, dust));
  }
  for (const [material, list] of parts) {
    const merged = mergeGeometries(list);
    for (const g of list) g.dispose();
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.receiveShadow = material !== daylight;
    mesh.castShadow = material === stone || material === iron || material === wood;   // the key's contact shadows
    group.add(mesh);
  }
  const flamePoints = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(flameSpots.flat(), 3));
  geometries.push(flamePoints);
  group.add(new THREE.Points(flamePoints, flames));
  const light = new THREE.PointLight(TORCH, S.torch * 0.45, 0, 2);   // the torches' glow (docs/pit-design.md §6); the key, fill and gate lights are above
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
    return stage.pieces([...trophies, ...rack]).then((list) => {
      if (mine !== stocking) return;   // a later wear has already restocked
      pieces.clear();
      trophies.forEach((id, i) => { const m = byId(list, id); if (m) hang(m, 0.5, TROPHY_SPOTS[i]!, -Math.PI / 2); });
      rack.forEach((id, i) => { const m = byId(list, id); if (m) hang(m, 0.55, [-hw + 0.42, i < 3 ? 1.95 : 1.2, RACK_Z[i % 3]!], Math.PI / 2); });
    });
  };
  const ready = L ? Promise.all([stock(stage.loot()), L.ready]).then(() => {}) : stock(stage.loot());
  stage.scene.add(group);   // last: a build that throws (the loot read) leaves nothing half-built in the scene

  return {
    group, height: H, ready, restock: () => stock(stage.loot()),
    update(t) {   // torchlight breathes: two incommensurate sines, as the arena's firelight theme does
      const f = 1 + 0.08 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.3);
      light.intensity = S.torch * 0.45 * f;
      flames.size = 0.34 * (0.94 + 0.08 * f);
    },
    dispose() {
      stage.scene.remove(group);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      L?.dispose();
      for (const l of lights) l.dispose();   // the key's shadow map
      pieces.clear();
    },
  };
}

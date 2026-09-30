// The Pit's room (docs/pit-design.md §1): one torch-lit stone room under the arena, built once per page from code (no model, no image
// file), merged by material so it costs a handful of draws. Room space: x −4..4, z −3..3, floor at y 0. The next-fight gate is in the far
// wall (z −3), the gear rack on the left wall (x −4), three trophy plinths on the right wall (x +4); the arena ramp is behind the camera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Loot, LootId, Provenance } from '../loot.ts';
import type { Pose, Stage } from './stage.ts';
import { DRESSING, clothTexture, dustPoints, fadeTexture, puffTexture, sandTexture, vaultEnds, vaultStrips } from './styles.ts';

export const ROOM = { width: 8, depth: 6, height: 3.4, gate: { width: 2.2, height: 2.7, passage: 3.4 } };   // the passage: how far the way out runs
export const RACK_SLOTS = 6, TROPHIES = 3;
const PLINTHS = [-1.1, 0, 1.1];   // z along the right wall: close enough that a portrait frame holds all three
// Where the hero stands and the camera looks for each pose (the `?look=pit` stills; the room PR eases between them as he walks).
export const POSES: Record<Pose, { hero: { x: number; z: number; heading: number }; camera: THREE.Vector3Tuple; target: THREE.Vector3Tuple }> = {
  rack: { hero: { x: -2.3, z: 0.5, heading: 0.5 }, camera: [2.2, 1.75, 2.5], target: [-2.6, 1.15, -0.1] },
  trophies: { hero: { x: 1.0, z: 0.6, heading: -1.0 }, camera: [-1.2, 3.0, 1.0], target: [3.45, 1.0, 0] },   // high, so all three sit over his head at 375
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
  const A = stage.arenaMaterials?.(), T = A ? 2 : 1.6, TF = A ? 2 : 1.5;
  const stone = A?.stone ?? new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95, envMapIntensity: 0.15 });
  const floor = A ? Object.assign(A.stone.clone(), { roughness: 0.9 }) : new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.9, envMapIntensity: 0.15 });
  const iron = A?.iron ?? new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.55, metalness: 0.8, envMapIntensity: 0.4 });
  const daylight = new THREE.MeshBasicMaterial({ color: '#d9b37a', fog: false });   // the arena beyond the gate bars
  const flames = new THREE.PointsMaterial({ map: flameMap, color: TORCH, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  stage.grade(stone, 'stone'); stage.grade(floor, 'sand');
  const materials = [stone, floor, iron, daylight, flames, ...(A ? [A.sand, A.cloth, A.coal] : [])];

  const side = (hw - gate.width / 2), sconces: THREE.Vector3Tuple[] = S.sconces;
  const ironParts: THREE.BufferGeometry[] = [   // the ring's iron: bars, sconces, the rack; the rings and chains join below
      ...[-1.6, 1.6].map((z) => box(0.12, 2.3, 0.12, 2, { x: -hw + 0.12, y: 1.15, z })),   // rack posts (iron: the ring's)
      ...[1.25, 2.0].map((y) => box(0.1, 0.1, 3.3, 2, { x: -hw + 0.14, y, z: 0 })),   // rack rails
      ...Array.from({ length: 9 }, (_, i) => box(0.05, gate.height, 0.05, 1, { x: -gate.width / 2 + 0.15 + i * (gate.width - 0.3) / 8, y: gate.height / 2, z: -hd - 0.05 })),
      ...[0.5, 1.4, 2.3].map((y) => box(gate.width, 0.06, 0.06, 1, { y, z: -hd - 0.05 })),
      ...sconces.map(([x, y, z]) => box(0.1, 0.3, 0.1, 1, { x, y: y - 0.2, z })),
      ...[1.25, 2.0].flatMap((y) => [-1, 0, 1].map((z) => box(0.26, 0.04, 0.04, 1, { x: -hw + 0.3, y: y + 0.08, z }))),   // rack pegs
  ];
  const parts: [THREE.Material, THREE.BufferGeometry[]][] = [
    [stone, [
      plane(side, H, T, { x: -hw + side / 2, y: H / 2, z: -hd }), plane(side, H, T, { x: hw - side / 2, y: H / 2, z: -hd }),
      plane(gate.width, H - gate.height, T, { y: (H + gate.height) / 2, z: -hd }),
      plane(D, H, T, { ry: Math.PI / 2, x: -hw, y: H / 2 }), plane(D, H, T, { ry: -Math.PI / 2, x: hw, y: H / 2 }),
      plane(W, H, T, { ry: Math.PI, y: H / 2, z: hd }),
      ...PLINTHS.map((z) => box(0.6, 1, 0.6, T, { x: hw - 0.55, y: 0.5, z })),   // trophy plinths
      ...vaultStrips(W, D, H, 0.9, 10, T), ...vaultEnds(W, D, H, 0.9, 10, T),   // the barrel vault and its lunettes
      // The way out: a short stone passage behind the bars, its walls and roof lit only by the room's torch, so it falls off into shadow
      // before the daylight at its end (Lead on the first stills: a lit passage, not a flat wall).
      plane(P, gate.height, T, { ry: Math.PI / 2, x: -gate.width / 2, y: gate.height / 2, z: -hd - P / 2 }),
      plane(P, gate.height, T, { ry: -Math.PI / 2, x: gate.width / 2, y: gate.height / 2, z: -hd - P / 2 }),
      plane(gate.width, P, T, { rx: Math.PI / 2, y: gate.height, z: -hd - P / 2 }),
    ]],
    [floor, [plane(W, D, TF, { rx: -Math.PI / 2 }), plane(gate.width, P, TF, { rx: -Math.PI / 2, z: -hd - P / 2 })]],
    [iron, ironParts],
    [daylight, [plane(gate.width + 0.4, gate.height + 0.4, 1, { y: gate.height / 2, z: -hd - P })]],   // the arena's daylight at the passage's end
  ];
  // The dressing's extras (styles.ts): laid in with the same merge, one draw per material; the lights they need are added below.
  const geometries: THREE.BufferGeometry[] = [], lights: THREE.Light[] = [], flameSpots: THREE.Vector3Tuple[] = [...sconces];
  const disc = (r: number, x: number, z: number, turn: number) => placed(new THREE.CircleGeometry(r, 18), 1, 1, { rx: -Math.PI / 2, ry: turn, x, y: 0.006, z });
  const flat = (map: THREE.Texture, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, ...extra });
  {
    const sand = flat(sandTexture()), cloth = (c: [number, number, number]) => new THREE.MeshStandardMaterial({ map: clothTexture(c), roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 });
    const spill = new THREE.MeshBasicMaterial({ map: puffTexture(), color: '#ffd9a0', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
    const smoke = new THREE.PointsMaterial({ map: puffTexture(), color: '#6a6058', size: 0.55, transparent: true, opacity: 0.22, depthWrite: false });
    textures.push(sand.map!, spill.map!, smoke.map!);
    materials.push(sand, spill, smoke);
    parts.push([sand, [[1.1, 0, -2.3], [0.8, 0.5, -1.4], [0.6, -0.4, -0.6], [0.45, 0.3, 0.4], [0.35, -0.2, 1.3]].map(([r, x, z], i) => disc(r!, x!, z!, i * 1.3))]);   // sand tracked in from the gate
    parts.push([spill, [plane(3.2, 3.8, 1, { rx: -Math.PI / 2, y: 0.01, z: -hd + 1.7 })]]);   // the arena's light on the flags inside the bars
    const legends: [number, number, number][] = [[0.45, 0.08, 0.08], [0.1, 0.14, 0.35], [0.12, 0.3, 0.12]];
    PLINTHS.forEach((z, i) => { const m = cloth(legends[i]!); textures.push(m.map!); materials.push(m); parts.push([m, [plane(0.7, 1.3, 1, { ry: -Math.PI / 2, x: hw - 0.03, y: 1.95, z })]]); });   // cloth behind each trophy
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
    const under: [number, number, number][] = [...PLINTHS.map((z) => [0.55, hw - 0.55, z] as [number, number, number]), [0.3, -hw + 0.12, -1.6], [0.3, -hw + 0.12, 1.6]];
    parts.push([blob, under.map(([r, x, z]) => placed(new THREE.CircleGeometry(r, 16), 1, 1, { rx: -Math.PI / 2, x, y: 0.004, z }))]);
    // Rings and chains on the side walls, in the ring's iron.
    const ring = (x: number, z: number, turn: number) => placed(new THREE.TorusGeometry(0.11, 0.018, 8, 18), 1, 1, { ry: turn, x, y: 1.7, z });
    const link = (x: number, y: number, z: number, turn: number) => placed(new THREE.TorusGeometry(0.045, 0.012, 6, 12), 1, 1, { rx: Math.PI / 2, ry: turn, x, y, z });
    for (const [x, turn] of [[-hw + 0.06, Math.PI / 2], [hw - 0.06, -Math.PI / 2]] as const) for (const z of [-2.3, 2.6]) {
      ironParts.push(ring(x, z, turn), ...[0, 1, 2, 3, 4].map((k) => link(x, 1.55 - k * 0.085, z + (k % 2 ? 0.02 : -0.02), turn + (k % 2 ? Math.PI / 2 : 0))));
    }
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
    mesh.castShadow = material === stone || material === iron;   // the key's contact shadows
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
      trophies.forEach((id, i) => { const m = byId(list, id); if (m) hang(m, 0.5, [hw - 0.55, 1.28, PLINTHS[i]!], -Math.PI / 2); });
      rack.forEach((id, i) => { const m = byId(list, id); if (m) hang(m, 0.55, [-hw + 0.42, i < 3 ? 1.95 : 1.2, [-1, 0, 1][i % 3]!], Math.PI / 2); });
    });
  };
  const ready = stock(stage.loot());
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
      for (const l of lights) l.dispose();   // the key's shadow map
      pieces.clear();
    },
  };
}

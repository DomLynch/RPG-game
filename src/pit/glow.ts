// `?look=pit,pit-glow` (Dom's painted-cell reference, 2026-10-04: ~/Desktop/Business/artifacts/pit-reference-20261004/pit-cell-chosen.webp):
// the same walkable room, relit gold. What this file adds: the arena's own painted far world (Arena 1's backdrop) behind the gate bars,
// the shafts of light that come through the bars and lie as stripes on the sand, and a golden haze in the gate. room.ts warms the
// stone, the sand and the lights; pit.ts swaps the arena's fog for a warm one while the room is up. Look test only, never the default.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, patchPixels } from '../assets/arena/textures.ts';

export const GLOW = { fog: '#8a5a30', fogDensity: 0.035, light: '#ffd08a', stone: '#d9a86e', sand: '#f2c58a', fill: '#ffbf7a', arch: '#a8875f' };

// A canvas texture: `draw` paints a w × h 2D context.
function painted(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d')!);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
// Light through bars: bright stripes with the bars' shadows between them, strongest at the top (the gate) and fading out down the texture.
const BARS = 7;
function stripes(fadeTo: number) {
  return painted(128, 256, (g) => {
    for (let i = 0; i < BARS; i++) {
      const x = (i + 0.5) / BARS * 128, half = 128 / BARS * 0.32;
      const fade = g.createLinearGradient(0, 0, 0, 256);
      fade.addColorStop(0, 'rgba(255,255,255,1)'); fade.addColorStop(fadeTo, 'rgba(255,255,255,0.35)'); fade.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = fade;
      g.fillRect(x - half, 0, half * 2, 256);
    }
    g.globalCompositeOperation = 'destination-in';   // soften the stripes' outer edges
    const edge = g.createLinearGradient(0, 0, 128, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.15, 'rgba(0,0,0,1)'); edge.addColorStop(0.85, 'rgba(0,0,0,1)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge; g.fillRect(0, 0, 128, 256);
  });
}
const glowMap = () => painted(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
// A quad through four corners (top-left, top-right, bottom-right, bottom-left), uv 0..1 from top to bottom.
function quad(corners: THREE.Vector3Tuple[]): THREE.BufferGeometry {
  const [a, b, c, d] = corners as [THREE.Vector3Tuple, THREE.Vector3Tuple, THREE.Vector3Tuple, THREE.Vector3Tuple];
  return new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3))
    .setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2))
    .setIndex([0, 3, 1, 1, 3, 2]);
}

// The gate is `width` wide and `height` tall in the far wall at z = `wallZ`, its passage running back `passage` m to the arena.
export function addGlow(group: THREE.Group, gate: { width: number; height: number; passage: number }, wallZ: number) {
  const textures: THREE.Texture[] = [], materials: THREE.MeshBasicMaterial[] = [], geometries: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, order = 0) => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    group.add(mesh);
  };
  const glowing = (map: THREE.Texture, opacity: number, color = GLOW.light) =>
    new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const floorBars = stripes(0.45), airBars = stripes(0.25), halo = glowMap();
  textures.push(floorBars, airBars, halo);
  const onFloor = glowing(floorBars, 0.16), inAir = glowing(airBars, 0.03), haze = glowing(halo, 0.04);   // Dom 10-04: the gate was "church/heaven" bright
  materials.push(onFloor, inAir, haze);
  const w = gate.width / 2, z = wallZ;
  // The stripes on the sand: from the gate's foot toward the camera, spreading a little as they go (the sun is low and behind the bars).
  add(quad([[-w, 0.015, z + 0.05], [w, 0.015, z + 0.05], [w * 1.9, 0.015, z + 4.2], [-w * 1.9, 0.015, z + 4.2]]), onFloor, 1);
  // The same light in the air: a sheet from the top of the bars down to where the stripes fade on the floor.
  add(quad([[-w, gate.height - 0.1, z + 0.02], [w, gate.height - 0.1, z + 0.02], [w * 1.9, 0.05, z + 4.2], [-w * 1.9, 0.05, z + 4.2]]), inAir, 2);
  add(quad([[-w * 0.8, gate.height - 0.1, z + 0.02], [w * 0.8, gate.height - 0.1, z + 0.02], [w * 1.4, 0.05, z + 2.6], [-w * 1.4, 0.05, z + 2.6]]), inAir, 2);
  // The golden haze in the gate: one soft glow just inside the bars, wider than the opening, and a dimmer one deeper in the passage.
  add(new THREE.PlaneGeometry(gate.width * 2.4, gate.height * 1.5).translate(0, gate.height * 0.55, z + 0.15), haze, 3);
  add(new THREE.PlaneGeometry(gate.width * 1.3, gate.height * 1.1).translate(0, gate.height * 0.5, z - gate.passage * 0.6), haze, 3);
  return { textures, materials, geometries };
}

// The arena seen through the gate: Arena 1's painted far world, its lower half (the stands in the sun), washed toward the haze.
export function arenaBeyond(material: THREE.MeshBasicMaterial, textures: THREE.Texture[]) {
  material.color.set('#f0dab2');   // daylight out there (Dom 10-04: "behind the bars should be daytime arena")   // dimmed so the stands read through the bars, not a white glare
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}arena/backdrop-1.webp`, (map) => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.repeat.set(1, 0.55); map.offset.set(0, 0.2);
    textures.push(map);
    material.map = map; material.needsUpdate = true;
  }, undefined, () => { /* the plain daylight stays */ });
}

// Old blood soaked into the sand (Dom 10-04: "the day map with blood stains, use that for our floor"): the arenas' own blood patch
// (textures.ts patchPixels 'blood', Blood Sand's seed) as dark brown-red stains lying on the Pit's sand, lit by the torches like the floor.
export function addBloodStains(group: THREE.Group, width: number, depth: number) {
  const p = patchPixels(256, 'blood', 43);
  for (let i = 0; i < p.data.length; i += 4) { p.data[i] = 92; p.data[i + 1] = 30; p.data[i + 2] = 20; p.data[i + 3] = Math.round(p.data[i + 3]! * 0.85); }
  const map = new THREE.DataTexture(p.data, p.width, p.height, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearFilter; map.needsUpdate = true;
  map.repeat.set(width / 26, depth / 26); map.offset.set(0.3, 0.35);   // the arena spreads the patch over 26 m: same stain size here
  const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const geometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2).translate(0, 0.008, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  group.add(mesh);
  return { textures: [map], materials: [material], geometries: [geometry] };
}

// Blood on the sand (Lead 10-04: no band along one wall; spread the events): a dried pool with the mark of where it was dragged off by the rack,
// a drag trail by the bed. Flat decals over the floor stains, lit like the sand.
type Ground = { img: Blood; x: number; z: number; w: number; h: number; turn: number };   // w × h metres (the image's own aspect)
const GROUND: readonly Ground[] = [
  { img: 'puddle', x: -3.4, z: 0.6, w: 2.4, h: 1.85, turn: 0.4 },
  { img: 'smear', x: 3.1, z: 1.2, w: 3.6, h: 1.33, turn: -1.15 },
];
export function addGroundBlood(group: THREE.Group) {
  const textures: THREE.Texture[] = [], materials: THREE.MeshStandardMaterial[] = [], geometries: THREE.BufferGeometry[] = [];
  for (const m of GROUND) {
    const map = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}pit/blood/${m.img}.webp`);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const geometry = new THREE.PlaneGeometry(m.w, m.h).rotateX(-Math.PI / 2).rotateY(m.turn).translate(m.x, 0.012, m.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    textures.push(map); materials.push(material); geometries.push(geometry);
  }
  return { textures, materials, geometries };
}

// Grime on the walls (Dom 10-04: "too symmetrical, fake looking ... a cave, an ancient gladiator room, not a 5* hotel"): over each wall a
// sheet of its own dirt, so the 2 m stone tile stops repeating. Rising damp darkest at the foot, broad soot-and-sweat blotches that never
// line up with the blocks, soot climbing above the torches, and the old blood on top (bloodTexture, its own sheet).
// Lit like the wall (MeshStandardMaterial), one draw per wall; seeds differ so no two walls match.
// Old blood on the walls (Dom 10-04: "blood looks fake, uniform and like copy paste, sticker"): four painted events, each its own image
// (public/pit/blood, generated by scripts/pit-blood-decals.py: droplets that fly ballistically and land elongated, dried dark rims, runs that
// stop in a bead, finger streaks, a cracked pool), laid where a fight would leave them rather than in a band. One sheet per wall over the
// grime, lit like the wall (MeshStandardMaterial), never glowing.
type Blood = 'spray' | 'smear' | 'splash' | 'pool' | 'puddle';
type Mark = { img: Blood; x: number; y: number; w: number; flip?: boolean };   // x, y: the image's centre in metres from the wall's left and the floor; w: its width in metres
const BLOOD_PPM = 200;

function loadBlood(names: readonly Blood[]): Promise<Record<string, HTMLImageElement>> {
  return Promise.all(names.map((name) => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([name, img]);
    img.onerror = () => reject(new Error(`blood decal ${name}`));
    img.src = `${import.meta.env.BASE_URL}pit/blood/${name}.webp`;
  }))).then((pairs) => Object.fromEntries(pairs));
}

function bloodTexture(w: number, h: number, marks: readonly Mark[]) {
  const cw = Math.round(w * BLOOD_PPM), ch = Math.round(h * BLOOD_PPM);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  void loadBlood([...new Set(marks.map((m) => m.img))]).then((images) => {
    const g = canvas.getContext('2d')!;
    for (const m of marks) {
      const img = images[m.img]!, dw = m.w * BLOOD_PPM, dh = dw * img.height / img.width;
      g.save();
      g.translate(m.x * BLOOD_PPM, ch - m.y * BLOOD_PPM);
      if (m.flip) g.scale(-1, 1);
      g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      g.restore();
    }
    map.needsUpdate = true;
  }, () => undefined);
  return map;
}

type Wall = { w: number; h: number; at: THREE.Vector3Tuple; turn: number; seed: number; torch?: number; marks?: Mark[] };   // torch: the sconce's u (0..1) on this wall
function grimeTexture({ w, h, seed, torch }: Wall): THREE.Texture {
  const PX = 96, cw = Math.round(w * PX / 2), ch = Math.round(h * PX / 2);   // 48 px per metre
  const blotch = fbm(4, 5, seed), fine = fbm(24, 3, seed + 7, 0.6), streak = fbm(3, 3, seed + 13);
  return painted(cw, ch, (g) => {
    const img = g.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const u = x / cw, v = y / ch, up = 1 - v;   // v down the texture; up = height on the wall (0 at the floor)
      const damp = Math.max(0, 1 - up / 0.45) ** 1.2 * (0.55 + 0.45 * blotch(u * 3, 0.2));   // rising damp at the foot, ragged top edge
      const dirt = Math.max(0, (blotch(u * w / 3, v * h / 3) - 0.34) * 2.4) * (0.6 + 0.4 * fine(u * w / 2, v * h / 2));
      const runs = Math.max(0, (streak(u * w * 1.6, v * 0.25) - 0.55) * 3) * (0.3 + 0.7 * up);   // water runs down from the vault
      const soot = torch === undefined ? 0 : Math.max(0, 1 - Math.abs(u - torch) * w / 0.7) * Math.max(0, up - 0.5) * 2 * (0.6 + 0.4 * fine(u * 9, v * 9));
      const a = Math.min(0.92, damp * 0.85 + dirt * 0.7 + runs * 0.4 + soot * 0.9);
      const i = (y * cw + x) * 4;
      d[i] = 34 - soot * 20; d[i + 1] = 24 - soot * 14; d[i + 2] = 16 - soot * 10; d[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  });
}
export function addGrime(group: THREE.Group, room: { width: number; depth: number; height: number; gateWidth: number }, torchZ: number, farOnly = false) {
  const { width: W, depth: D, height: H, gateWidth } = room, hw = W / 2, hd = D / 2, side = hw - gateWidth / 2, off = 0.012;
  const torchU = (D / 2 + torchZ) / D;   // the sconces sit near the far end of each side wall
  const walls: Wall[] = [
    { w: side, h: H, at: [-hw + side / 2, H / 2, -hd + off], turn: 0, seed: 301, marks: [{ img: 'spray', x: 3.1, y: 1.8, w: 3.6, flip: true }] },
    { w: side, h: H, at: [hw - side / 2, H / 2, -hd + off], turn: 0, seed: 307, marks: [{ img: 'splash', x: 0.9, y: 2.3, w: 2.2 }] },
    // the left wall is turned +90°, so its u runs toward the far wall: the torch sits at 1 - torchU there
    { w: D, h: H, at: [-hw + off, H / 2, 0], turn: Math.PI / 2, seed: 311, torch: 1 - torchU, marks: [{ img: 'spray', x: 5.3, y: 1.8, w: 3.0 }] },
    { w: D, h: H, at: [hw - off, H / 2, 0], turn: -Math.PI / 2, seed: 313, torch: torchU, marks: [{ img: 'smear', x: 3.3, y: 1.2, w: 3.4 }] },
    { w: W, h: H, at: [0, H / 2, hd - off], turn: Math.PI, seed: 317 },
  ];
  const textures: THREE.Texture[] = [], materials: THREE.MeshStandardMaterial[] = [], geometries: THREE.BufferGeometry[] = [];
  if (farOnly) walls.splice(2);   // pit-cage: only the far wall stands; the other sides are iron fence
  for (const wall of walls) {
    const map = grimeTexture(wall);
    const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const geometry = new THREE.PlaneGeometry(wall.w, wall.h).rotateY(wall.turn).translate(...wall.at);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    textures.push(map); materials.push(material); geometries.push(geometry);
    if (!wall.marks) continue;
    const bloodMap = bloodTexture(wall.w, wall.h, wall.marks);
    const bloodMaterial = new THREE.MeshStandardMaterial({ map: bloodMap, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const blood = new THREE.Mesh(geometry, bloodMaterial);
    blood.receiveShadow = true;
    group.add(blood);
    textures.push(bloodMap); materials.push(bloodMaterial);
  }
  return { textures, materials, geometries };
}

// The cage's fence (pit-cage): iron bars on the left, right and back sides, 3.2 m tall at 0.16 m, three rails and a spike on every bar.
// One merged geometry in the room's iron, so it is one draw; the caller owns and frees it.
export function addFence(group: THREE.Group, width: number, depth: number, iron: THREE.Material): THREE.BufferGeometry {
  const hw = width / 2, hd = depth / 2, HIGH = 3.2, GAP = 0.16, bars: THREE.BufferGeometry[] = [];
  const run = (from: THREE.Vector2, to: THREE.Vector2) => {
    const len = from.distanceTo(to), n = Math.round(len / GAP), dir = to.clone().sub(from).normalize(), turn = Math.atan2(dir.x, dir.y);
    for (let i = 0; i <= n; i++) {
      const p = from.clone().addScaledVector(dir, (i / n) * len);
      bars.push(new THREE.BoxGeometry(0.035, HIGH, 0.035).translate(p.x, HIGH / 2, p.y));
      bars.push(new THREE.ConeGeometry(0.035, 0.14, 4).translate(p.x, HIGH + 0.07, p.y));
    }
    for (const y of [0.18, 1.7, HIGH - 0.12]) bars.push(new THREE.BoxGeometry(0.06, 0.06, len).rotateY(turn).translate((from.x + to.x) / 2, y, (from.y + to.y) / 2));
  };
  run(new THREE.Vector2(-hw, -hd), new THREE.Vector2(-hw, hd));
  run(new THREE.Vector2(hw, -hd), new THREE.Vector2(hw, hd));
  run(new THREE.Vector2(-hw, hd), new THREE.Vector2(hw, hd));
  const geometry = mergeGeometries(bars.map((g) => g.toNonIndexed()));
  for (const g of bars) g.dispose();
  const mesh = new THREE.Mesh(geometry, iron);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return geometry;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CombatEvent } from './combat.ts';
import { CROWD_DYES, CROWD_KINDS, mixSpectators, spectatorGeometry, spectatorMaterial } from './assets/arena/crowd.ts';
import { phoneTier } from './quality.ts';
import { bannerAlpha, fbm, flamePixels, gateLightAtlas, hash, motePixels, sandAlbedo, sandNormal, skyPixels, stoneAlbedo, stoneNormal, type Pixels } from './assets/arena/textures.ts';

// The arena: everything that is not a fighter, a light, the camera or an effect. Owned by the world lane.
// Contract (tests/arena.test.ts): the playable surface is a flat circle (sim.ts RADIUS 8.55 m); nothing solid stands inside it above the
// floor, and nothing reaches inside the camera clamp (scene.ts cameraPose, 11.5 m) at fighter height. Lights, fog, tone mapping and the
// camera stay in scene.ts. `update` receives the simulation's events so the arena may react (crowd, braziers, banners); never gameplay.
// `floor` is the sand: the decal target for the presentation lane (planar UVs, u = x / SAND_TILE, v = z / SAND_TILE).
export const PLAY_RADIUS = 8.55, CAMERA_CLAMP = 11.5, SAND_TILE = 3;
// The pit: sand to the podium wall, whose inner face stands outside the camera clamp so the lock camera never clips it; five broken stone
// tiers climb behind it, a ruined colonnade and outer wall make the skyline. The gate faces the hero's start (he walks in from the sun).
export const LAYOUT = { wall: { inner: 11.7, outer: 12.5, top: 2.6 }, tiers: [3.4, 4.2, 5.0, 5.8, 6.6], tierDepth: 1.6, gate: Math.PI, gateWidth: 3.2, colonnade: 21.4, parapet: { inner: 22.4, outer: 23.2, top: 8.6 }, segments: 96 };
export type Arena = { group: THREE.Group; floor: THREE.Mesh; update(dt: number, events: CombatEvent[]): void; dispose(): void };

const TAU = Math.PI * 2, smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ruinNoise = fbm(6, 3, 5), ruin = (angle: number) => smooth(0.56, 0.78, ruinNoise(angle / TAU, 0.37));   // where the tiers have collapsed
// Height of tier `i`'s tread at an angle: its base height less the collapse, jittered per segment, never below the tier beneath it.
function tierTop(i: number, angle: number, segment: number): number {
  const below = i === 0 ? LAYOUT.wall.top : tierTop(i - 1, angle, segment);
  return Math.max(below + 0.12, LAYOUT.tiers[i] - ruin(angle) * (0.3 + 0.7 * i / 4) * 2.4 + (hash(segment, i, 3) - 0.5) * 0.06);
}
const inGate = (angle: number, r: number, margin = 0) => Math.abs(Math.atan2(Math.sin(angle - LAYOUT.gate), Math.cos(angle - LAYOUT.gate))) * r < LAYOUT.gateWidth / 2 + margin;

// A band of quads between the profile points (r0, y0) and (r1, y1) around the ring: a tread when y0 = y1, a riser when r0 = r1. Normals
// follow the profile (inner→outer treads face up, rising risers face the pit), UVs are world metres over `tile`, colours come from `tint`.
type Tint = (x: number, y: number, z: number, angle: number) => [number, number, number];
function band(r0: number, y0: (a: number, s: number) => number, r1: number, y1: (a: number, s: number) => number, tile: number, tint: Tint, skip?: (angle: number) => boolean): THREE.BufferGeometry {
  const n = LAYOUT.segments, position: number[] = [], normal: number[] = [], uv: number[] = [], color: number[] = [], index: number[] = [];
  const arc = Math.abs(r1 - r0) < 1e-6;   // a riser: unwrap its arc for the UVs so the courses run around the ring and close on a whole tile
  for (let s = 0; s <= n; s++) {
    const a = s / n * TAU, sin = Math.sin(a), cos = Math.cos(a), ya = y0(a, s % n), yb = y1(a, s % n), dr = r1 - r0, dy = yb - ya, l = Math.hypot(dr, dy) || 1;
    for (const [r, y] of [[r0, ya], [r1, yb]]) {
      position.push(r * sin, y, r * cos); normal.push(-dy / l * sin, dr / l, -dy / l * cos);
      uv.push(...(arc ? [a / TAU * Math.round(TAU * r0 / tile), y / tile] : [r * sin / tile, r * cos / tile])); color.push(...tint(r * sin, y, r * cos, a));
    }
  }
  for (let s = 0; s < n; s++) { if (skip?.((s + 0.5) / n * TAU)) continue; const A = s * 2, B = A + 1, C = A + 2, D = A + 3; index.push(A, B, C, B, D, C); }
  return attributes(position, normal, uv, color, index);
}
// The sand: a disc of concentric rings so its tint can darken smoothly toward the wall's foot. Planar UVs: the decal slot.
function disc(radius: number, rings: number, tint: Tint): THREE.BufferGeometry {
  const n = LAYOUT.segments, position: number[] = [], normal: number[] = [], uv: number[] = [], color: number[] = [], index: number[] = [];
  for (let j = 0; j <= rings; j++) for (let s = 0; s <= n; s++) {
    const r = radius * j / rings, a = s / n * TAU, x = r * Math.sin(a), z = r * Math.cos(a);
    position.push(x, 0, z); normal.push(0, 1, 0); uv.push(x / SAND_TILE, z / SAND_TILE); color.push(...tint(x, 0, z, a));
  }
  for (let j = 0; j < rings; j++) for (let s = 0; s < n; s++) { const A = j * (n + 1) + s, B = A + n + 1; index.push(A, B, A + 1, A + 1, B, B + 1); }
  return attributes(position, normal, uv, color, index);
}
function attributes(position: number[], normal: number[], uv: number[], color: number[], index: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3)); g.setIndex(index);
  return g;
}
// A prop (box, cylinder, sphere…) placed in the world: box-projected UVs in metres, a flat tint darkened toward its foot (contact shade).
function prop(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rotation: THREE.Euler | number, scale: THREE.Vector3 | number, tile: number, tint: [number, number, number], foot = y): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(typeof rotation === 'number' ? new THREE.Euler(0, rotation, 0) : rotation), typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale);
  geometry.applyMatrix4(m);
  const p = geometry.attributes.position, nrm = geometry.attributes.normal, uv = geometry.attributes.uv, color = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, px / tile, pz / tile); else if (nx >= nz) uv.setXY(i, pz / tile, py / tile); else uv.setXY(i, px / tile, py / tile);
    const shade = 0.72 + 0.28 * Math.min(1, Math.max(0, (py - foot) / 0.7)); color[i * 3] = tint[0] * shade; color[i * 3 + 1] = tint[1] * shade; color[i * 3 + 2] = tint[2] * shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3)); return geometry;
}
function dataTexture(p: Pixels, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(p.data, p.width, p.height); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d), cylinder = (rt: number, rb: number, h: number, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
const STONE: [number, number, number] = [1, 1, 1], DARK: [number, number, number] = [0.55, 0.53, 0.5], BONE: [number, number, number] = [1.55, 1.45, 1.2], SOOT: [number, number, number] = [0.08, 0.075, 0.07];

export function buildArena(scene: THREE.Scene): Arena {
  const group = new THREE.Group(); group.name = 'arena'; scene.add(group);
  const { wall, tiers, tierDepth, gate, gateWidth, colonnade, parapet } = LAYOUT, polar = (r: number, a: number) => [r * Math.sin(a), r * Math.cos(a)] as const;
  // Phone tier (the owner's iPhone GPU-pressure defect, 2026-09-18): the big procedural maps generate at
  // half size — the generators are size-parametric, so this costs nothing but sharpness on a small screen.
  const phone = phoneTier(), half = (size: number) => (phone ? size / 2 : size);
  const textures = { sand: dataTexture(sandAlbedo(half(1024)), true), sandNormal: dataTexture(sandNormal(half(512)), false), stone: dataTexture(stoneAlbedo(half(512)), true), stoneNormal: dataTexture(stoneNormal(half(512)), false), sky: dataTexture(skyPixels(half(512), half(256), ((Math.atan2(-18, 15) / TAU) % 1 + 1) % 1), true), banner: dataTexture(bannerAlpha(), false), flame: dataTexture(flamePixels(), true), mote: dataTexture(motePixels(), true), gateLight: dataTexture(gateLightAtlas(), true) };
  textures.sky.wrapT = THREE.ClampToEdgeWrapping; textures.banner.wrapS = textures.banner.wrapT = textures.flame.wrapS = textures.flame.wrapT = textures.gateLight.wrapS = textures.gateLight.wrapT = THREE.ClampToEdgeWrapping;
  const sand = new THREE.MeshStandardMaterial({ name: 'sand', map: textures.sand, normalMap: textures.sandNormal, normalScale: new THREE.Vector2(0.7, 0.7), color: '#e2ddd6', roughness: 0.96, vertexColors: true });
  const stone = new THREE.MeshStandardMaterial({ name: 'stone', map: textures.stone, normalMap: textures.stoneNormal, normalScale: new THREE.Vector2(1.1, 1.1), color: '#b9b4ab', roughness: 0.93, vertexColors: true });
  const iron = new THREE.MeshStandardMaterial({ name: 'iron', color: '#2a2623', roughness: 0.6, metalness: 0.78, vertexColors: true });
  const coal = new THREE.MeshStandardMaterial({ name: 'coal', color: '#1a1210', emissive: '#ff6a1c', emissiveIntensity: 1.1, roughness: 1 });
  const cloth = new THREE.MeshStandardMaterial({ name: 'cloth', alphaMap: textures.banner, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  const crowdMaterial = spectatorMaterial();
  const sky = new THREE.MeshBasicMaterial({ name: 'sky', map: textures.sky, side: THREE.BackSide, fog: false });
  const plain = new THREE.MeshStandardMaterial({ name: 'ash plain', color: '#4a463f', roughness: 1 });
  const boundary = new THREE.MeshStandardMaterial({ name: 'boundary', color: '#4e4136', roughness: 0.9, side: THREE.DoubleSide });
  const flame = new THREE.MeshBasicMaterial({ name: 'flame', map: textures.flame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const motesMaterial = new THREE.PointsMaterial({ name: 'motes', map: textures.mote, size: 0.1, transparent: true, opacity: 0.62, depthWrite: false, sizeAttenuation: true, color: '#847b6e' });
  const gateLightMaterial = new THREE.MeshBasicMaterial({ name: 'gate-light', map: textures.gateLight, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const materials = [sand, stone, iron, coal, cloth, crowdMaterial, sky, plain, boundary, flame, motesMaterial, gateLightMaterial];
  const mottle = fbm(4, 3, 9);
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, shadows = true) {
    const object = new THREE.Mesh(geometry, material); object.name = name; object.castShadow = shadows; object.receiveShadow = true; group.add(object); return object;
  }
  // The sand: flat to the wall's foot (and under it, so the gateway floor is sand), darkening toward the wall and mottled at large scale.
  const floor = mesh(disc(wall.outer + 0.1, 36, (x, _y, z) => { const r = Math.hypot(x, z), k = (0.92 + 0.28 * (mottle(x / 26 + 0.5, z / 26 + 0.5) - 0.5)) * (1 - 0.42 * smooth(10.2, wall.inner, r)); return [k, k * 0.99, k * 0.97]; }), sand, 'sand', false);
  floor.userData.tile = SAND_TILE;
  // The boundary ring at the play radius: a dark inlay trodden flush with the sand (the simulation's wall, visible).
  const ring = mesh(new THREE.RingGeometry(PLAY_RADIUS - 0.05, PLAY_RADIUS + 0.05, 128), boundary, 'boundary', false); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
  // Gate light: the low sun spills through the gate arch. The beam rides the real sun direction but lives inside the
  // passage (r ≥ 11.7 — the camera clamp keeps the arena clear for the orbit), fading before it reaches the sand; the
  // warm pool on the floor below y 0.5 is where it lands. One merged mesh, additive, no shadows (world lane 2026-09-18).
  const gateLight: THREE.BufferGeometry[] = [];
  { const d = new THREE.Vector3(15, -26, 18).normalize(), up = new THREE.Vector3(0, 1, 0);
    const xAx = new THREE.Vector3().crossVectors(d, up).normalize(), zAx = new THREE.Vector3().crossVectors(xAx, d).normalize();
    const beam = new THREE.PlaneGeometry(1.6, 3.4);
    beam.applyMatrix4(new THREE.Matrix4().makeBasis(xAx, d, zAx));
    beam.translate(0 + d.x * 1.7, 2.95 + d.y * 1.7, -12.35 + d.z * 1.7);
    const buv = beam.attributes.uv;
    for (let i = 0; i < buv.count; i++) buv.setY(i, 0.5 + buv.getY(i) * 0.5);   // bright entry at the arch, fading down
    gateLight.push(beam);
    const pool = new THREE.CircleGeometry(1.75, 20); pool.rotateX(-Math.PI / 2); pool.scale(1.25, 1, 0.85); pool.rotateY(0.65);
    const puv = pool.attributes.uv;
    for (let i = 0; i < puv.count; i++) puv.setY(i, puv.getY(i) * 0.5);         // the pool: bottom half of the atlas
    pool.translate(1.55, 0.009, -10.1);
    gateLight.push(pool); }
  mesh(mergeGeometries(gateLight), gateLightMaterial, 'gate-light', false);

  // Stone: the podium wall, the tiers, the gate, the colonnade, the parapet and the rubble — one merged mesh.
  const stones: THREE.BufferGeometry[] = [], seg = (r: number) => (0.94 + 0.12 * (hash(Math.floor(r * 7), 1, 2) - 0.5));
  const brazierAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4, gate - 0.42, gate + 0.42];
  // Firelight on the masonry: warmth by angular proximity to a brazier, through a height window around the flame (world lane
  // 2026-09-18 — the flames glowed but the wall above them stayed dead). Static tint; the coals' own flicker carries the motion.
  const fireGlow = (y: number, a: number): [number, number, number] => {
    let g = 0;
    for (const ba of brazierAngles) { let d = Math.abs(a - ba) % TAU; if (d > Math.PI) d = TAU - d; g = Math.max(g, Math.exp(-(d * d) / 0.0162)); }
    g *= smooth(1.6, 2.6, y) * (1 - smooth(3.8, 4.8, y));
    return [1 + 0.5 * g, 1 + 0.2 * g, 1 - 0.14 * g];
  };
  // Local grime, not a palette change: irregular damp dirt at the foot and tapering soot above the six braziers.
  const masonryShade = (y: number, a: number) => {
    const dirt = Math.exp(-Math.max(0, y) / 0.42) * (0.1 + 0.14 * mottle(Math.sin(a) * 2 + 0.5, Math.cos(a) * 2 + 0.5));
    let soot = 0;
    for (const ba of brazierAngles) {
      const rise = Math.max(0, y - 3.65), drift = 0.012 * rise;
      const d = Math.atan2(Math.sin(a - ba - drift), Math.cos(a - ba - drift)), width = 0.045 + 0.016 * rise;
      soot = Math.max(soot, Math.exp(-((d / width) ** 2)) * smooth(3.65, 4.25, y) * (1 - smooth(5.4, 6.8, y)));
    }
    return (1 - dirt) * (1 - 0.3 * soot);
  };
  const wallTint: Tint = (_x, y, _z, a) => { const k = (0.9 + 0.2 * (hash(Math.floor(a * 30), 0, 4) - 0.5)) * (0.7 + 0.3 * Math.min(1, y / wall.top)) * masonryShade(y, a); const [gr, gg, gb] = fireGlow(y, a); return [k * gr, k * 0.99 * gg, k * 0.97 * gb]; };
  const tierTint: Tint = (_x, y, _z, a) => { const k = (0.88 + 0.18 * (hash(Math.floor(a * 40), Math.floor(y), 6) - 0.5)) * (1 - 0.35 * ruin(a)) * masonryShade(y, a); const [gr, gg, gb] = fireGlow(y, a); return [k * gr, k * gg, k * 0.98 * gb]; };
  const flat = (h: number) => () => h, gateSkip = (a: number) => inGate(a, wall.inner);
  const wallRows = [0, 0.25, 0.7, 1.5, wall.top];   // enough vertical samples to keep foot stains localized
  for (let i = 1; i < wallRows.length; i++) stones.push(band(wall.inner, flat(wallRows[i - 1]), wall.inner, flat(wallRows[i]), 2, wallTint, gateSkip));
  stones.push(band(wall.inner, flat(wall.top), wall.outer, flat(wall.top), 2, wallTint, gateSkip));           // its walkway
  let inner = wall.outer;
  tiers.forEach((_h, i) => {
    const top = (a: number, s: number) => tierTop(i, a, s), under = i === 0 ? flat(wall.top) : (a: number, s: number) => tierTop(i - 1, a, s), outer = inner + tierDepth + (i === tiers.length - 1 ? 1.9 : 0);
    stones.push(band(inner, under, inner, top, 2, tierTint), band(inner, top, outer, top, 2, tierTint));
    inner = outer;
  });
  const topTier = (a: number, s: number) => tierTop(tiers.length - 1, a, s), parapetTop = (a: number, s: number) => topTier(a, s) + (parapet.top - tiers[tiers.length - 1]) * (1 - 0.85 * smooth(0.45, 0.75, ruinNoise(a / TAU + 0.31, 0.8))) + (hash(s, 9, 7) - 0.5) * 0.5;
  stones.push(band(parapet.inner, topTier, parapet.inner, parapetTop, 2, tierTint), band(parapet.inner, parapetTop, parapet.outer, parapetTop, 2, tierTint), band(parapet.outer, parapetTop, parapet.outer, flat(0), 2, tierTint));
  // The gate: capped posts either side, a voussoir arch proud of the wall face over the opening, the dark passage behind the bars.
  for (const side of [-1, 1]) {
    const a = gate + side * (gateWidth / 2 + 0.35) / wall.inner, [x, z] = polar((wall.inner + wall.outer) / 2, a);
    stones.push(prop(box(0.7, 3.4, wall.outer - wall.inner + 0.3), x, 1.7, z, a, 1, 2, STONE, 0), prop(box(0.95, 0.3, wall.outer - wall.inner + 0.3), x, 3.55, z, a, 1, 2, STONE, 3.2));
  }
  { const [gx, gz] = polar(12.15, gate);   // arch centre: wedges span 11.55–12.75, never inside the camera clamp
    for (let i = 0; i < 9; i++) {
      const phi = (i + 0.5) / 9 * Math.PI, lx = Math.cos(phi) * 1.75, ly = 1.3 + Math.sin(phi) * 1.75, key = i === 4 ? 1.18 : 1;
      stones.push(prop(box(0.55 * key, 0.66 * key, 1.2), gx - lx * Math.cos(gate), ly, gz + lx * Math.sin(gate), new THREE.Euler(0, gate, phi - Math.PI / 2, 'YXZ'), 1, 2, STONE, ly - 0.8));
    } }
  { const [x, z] = polar(wall.outer + 1.4, gate); stones.push(prop(box(gateWidth, 2.5, 3.2), x, 1.25, z, gate, 1, 2, SOOT, -5)); }
  // Ruined colonnade on the top walkway: a few columns stand whole with their capitals, the rest are broken at random heights or gone.
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU + 0.13, r = ruin(a), [x, z] = polar(colonnade, a), foot = tierTop(tiers.length - 1, a, Math.floor(a / TAU * LAYOUT.segments));
    if (r > 0.7) continue;
    const whole = hash(i, 0, 11) > 0.55 && r < 0.2, h = whole ? 4.6 : 1 + hash(i, 1, 11) * 2.6;
    stones.push(prop(cylinder(0.4, 0.46, h, 14), x, foot + h / 2, z, 0, 1, 2, [seg(i), seg(i), seg(i) * 0.98], foot));
    if (whole) stones.push(prop(box(1.05, 0.34, 1.05), x, foot + h + 0.17, z, a, 1, 2, STONE, foot + h - 0.5));
  }
  // Rubble: fallen stone in the band between the play circle and the wall (never above 0.5 m: the camera clamp rule), blocks on collapsed
  // tiers, a few bone fragments in the sand.
  for (let i = 0; i < 26; i++) {
    const cluster = i % 4 < 2, drum = i % 3;
    const a = cluster ? 1.3 + drum * 2.1 + hash(drum, 0, 53) * 0.5 + (hash(i, 0, 13) - 0.5) * 0.16 : hash(i, 0, 13) * TAU;
    const rr = cluster ? 10.1 + hash(drum, 1, 53) * 1.1 - hash(i, 1, 13) * 0.65 : 9.9 + hash(i, 1, 13) * 1.45, [x, z] = polar(rr, a), s = 0.16 + hash(i, 2, 13) ** 2 * 0.3, bone = i % 4 === 3;
    stones.push(prop(new THREE.SphereGeometry(bone ? 0.09 : s, 7, 5), x, bone ? 0.02 : s * 0.25, z, new THREE.Euler(hash(i, 3, 13) * 3, hash(i, 4, 13) * 3, hash(i, 5, 13)), new THREE.Vector3(1, 0.55, 0.8), 1, bone ? BONE : DARK, -0.2));
  }
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU + 0.04, r = ruin(a); if (r < 0.5) continue;
    const tier = 1 + (i % 3), rr = wall.outer + tier * tierDepth + 0.6, [x, z] = polar(rr, a), foot = tierTop(tier - 1, a, Math.floor(a / TAU * LAYOUT.segments)), s = 0.5 + hash(i, 6, 13) * 0.6;
    stones.push(prop(box(s * 1.4, s * 0.7, s), x, foot + s * 0.32, z, new THREE.Euler(hash(i, 7, 13) * 0.3, a + hash(i, 8, 13), 0), 1, 2, DARK, foot - 0.3));
  }
  // Gladiator-pit debris in the moat band (every vertex below 0.5 m: the clamp rule): half-buried boulders, broken column drums
  // from the colonnade, terracotta amphora shards. The old bones are in the small rubble above.
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i / 5 * TAU + hash(i, 0, 51) * 0.6, rr = 9.6 + hash(i, 1, 51) * 1.5, [x, z] = polar(rr, a), s = 0.55 + hash(i, 2, 51) * 0.35;
    stones.push(prop(new THREE.SphereGeometry(s, 9, 7), x, 0.46 - s * 0.5, z, hash(i, 4, 51) * TAU, new THREE.Vector3(1, 0.5, 0.85), 2, [0.9, 0.9, 0.88], -0.3));   // yaw only: a tilt would lift the dome past the 0.5 m clamp rule
  }
  for (let i = 0; i < 3; i++) {
    const a = 1.3 + i * 2.1 + hash(i, 0, 53) * 0.5, rr = 10.1 + hash(i, 1, 53) * 1.1, [x, z] = polar(rr, a);
    stones.push(prop(cylinder(0.3, 0.3, 0.85, 12), x, 0.17, z, new THREE.Euler(Math.PI / 2, a, 0, 'YXZ'), 1, 2, [seg(i + 40), seg(i + 40), seg(i + 40) * 0.98], -0.2));
  }
  for (let i = 0; i < 7; i++) {
    const drum = i % 3, a = 1.3 + drum * 2.1 + hash(drum, 0, 53) * 0.5 + (hash(i, 0, 55) - 0.5) * 0.2;
    const rr = 10.1 + hash(drum, 1, 53) * 1.1 - hash(i, 1, 55) * 0.8, [x, z] = polar(rr, a), s = 0.1 + hash(i, 2, 55) * 0.12;
    stones.push(prop(new THREE.SphereGeometry(s, 6, 4), x, s * 0.3, z, new THREE.Euler(hash(i, 3, 55) * 3, hash(i, 4, 55) * 3, hash(i, 5, 55) * 2), new THREE.Vector3(1, 0.4, 0.8), 1, [1.5, 0.82, 0.55], -0.1));
  }
  mesh(mergeGeometries(stones), stone, 'stone');

  // Iron: braziers on the wall, the portcullis, chains on the wall's face, the banner poles.
  const irons: THREE.BufferGeometry[] = [], coals: THREE.BufferGeometry[] = [], IRON: [number, number, number] = [1, 1, 1];
  for (const a of brazierAngles) {
    const [x, z] = polar(wall.inner + 0.42, a), y = wall.top;
    for (let leg = 0; leg < 3; leg++) { const la = leg / 3 * TAU; irons.push(prop(cylinder(0.025, 0.03, 1.05, 6), x + Math.sin(la) * 0.16, y + 0.52, z + Math.cos(la) * 0.16, new THREE.Euler(Math.cos(la) * 0.2, 0, -Math.sin(la) * 0.2), 1, 1, IRON, y)); }
    irons.push(prop(cylinder(0.38, 0.24, 0.32, 14), x, y + 1.14, z, 0, 1, 1, IRON, y)); coals.push(prop(cylinder(0.31, 0.31, 0.1, 12), x, y + 1.3, z, 0, 1, 1, IRON, y));
  }
  { const [gx, gz] = polar(wall.inner + 0.45, gate), across = new THREE.Vector3(Math.cos(gate), 0, -Math.sin(gate)), RUST: [number, number, number] = [1.5, 0.95, 0.65];
    for (let i = 0; i < 9; i++) { const t = (i - 4) * 0.36;
      irons.push(prop(cylinder(0.06, 0.06, 2.5, 6), gx + across.x * t, 1.28, gz + across.z * t, 0, 1, 1, RUST, -5));
      irons.push(prop(cylinder(0.001, 0.075, 0.24, 6), gx + across.x * t, 0.14, gz + across.z * t, 0, 1, 1, RUST, -5)); }
    for (const y of [0.42, 1.08, 1.74, 2.4]) irons.push(prop(box(gateWidth - 0.1, 0.09, 0.09), gx, y, gz, gate, 1, 1, RUST, -5)); }
  for (let i = 0; i < 5; i++) {
    const a = [0.55, 2.05, 2.75, 4.3, 5.6][i], [x, z] = polar(wall.inner + 0.06, a), out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, wall.top - 0.3, z), new THREE.Vector3(x - out.x * 0.09, 1.55, z - out.z * 0.09), new THREE.Vector3(x - out.x * 0.04, 0.85, z - out.z * 0.04)]);
    irons.push(prop(new THREE.TubeGeometry(curve, 10, 0.035, 5, false), 0, 0, 0, 0, 1, 1, IRON, -5), prop(new THREE.TorusGeometry(0.13, 0.03, 5, 12), x - out.x * 0.04, 0.72, z - out.z * 0.04, new THREE.Euler(0, a, 0), 1, 1, IRON, -5));
  }
  const bannerAngles = Array.from({ length: 8 }, (_, k) => Math.PI / 8 + k * Math.PI / 4), bannerR = wall.outer - 0.15, bannerTop = wall.top + 3.4;
  for (const a of bannerAngles) { const [x, z] = polar(bannerR, a); irons.push(prop(cylinder(0.035, 0.045, 3.4, 6), x, wall.top + 1.7, z, 0, 1, 1, IRON, wall.top), prop(box(1.3, 0.06, 0.06), x, bannerTop, z, a, 1, 1, IRON, -5)); }
  const fallenStart = irons.length;
  // Dropped gear in the sand (iron, tinted): a fallen shield by the wall and a broken blade half-buried near the ring.
  { const a = 1.3 + hash(0, 0, 53) * 0.5 + 0.07, [x, z] = polar(10.1 + hash(0, 1, 53) * 1.1 - 0.4, a);
    const shield = new THREE.SphereGeometry(0.34, 14, 5, 0, TAU, 0, Math.PI / 2); shield.scale(1, 0.16, 1);
    irons.push(prop(shield, x, -0.008, z, new THREE.Euler(0.12, a, 0.06), 1, 1, [2.3, 1.7, 1.0], -0.02));
    irons.push(prop(new THREE.SphereGeometry(0.09, 8, 6), x, 0.046, z, 0, new THREE.Vector3(1, 0.5, 1), 1, [2.3, 1.7, 1.0], -0.02)); }
  { const a = 4.9, [x, z] = polar(9.8, a);
    irons.push(prop(box(0.52, 0.025, 0.07), x, 0.03, z, new THREE.Euler(0.04, a, 0.02), 1, 1, [1.9, 1.9, 2.0], -5));
    irons.push(prop(box(0.16, 0.04, 0.05), x + Math.sin(a + 0.5) * 0.3, 0.035, z + Math.cos(a + 0.5) * 0.3, a + 0.5, 1, 1, [1.2, 0.9, 0.7], -5)); }
  // More of yesterday's fight (world lane 2026-09-18): a dented helmet, a snapped spear, a blade snapped at the tang.
  // All in the iron merge — zero draw calls — and low with yaw-only spins (the camera-clamp rule).
  { const a = 3.4 + hash(1, 0, 53) * 0.5 - 0.055, [x, z] = polar(10.1 + hash(1, 1, 53) * 1.1 - 0.5, a), dome = new THREE.SphereGeometry(0.17, 10, 7); dome.scale(1, 0.62, 1.12);
    irons.push(prop(dome, x, 0.008, z, new THREE.Euler(0.13, a, -0.12), 1, 1, [1.35, 1.3, 1.22], -0.1));
    irons.push(prop(box(0.2, 0.02, 0.14), x + Math.sin(a) * 0.13, 0.03, z + Math.cos(a) * 0.13, a, 1, 1, [1.35, 1.3, 1.22], -0.1)); }
  { const a = 3.6, [x, z] = polar(9.9, a), long = cylinder(0.022, 0.026, 0.95, 6); long.rotateZ(Math.PI / 2);
    const stub = cylinder(0.024, 0.028, 0.45, 6); stub.rotateZ(Math.PI / 2);
    irons.push(prop(long, x, 0.008, z, new THREE.Euler(0.012, a, 0.022), 1, 1, [1.55, 1.25, 0.85], -0.1));
    irons.push(prop(stub, x + Math.sin(a + 2.6) * 0.57, 0.004, z + Math.cos(a + 2.6) * 0.57, a + 0.9, 1, 1, [1.55, 1.2, 0.8], -0.1));
    irons.push(prop(cylinder(0.03, 0.03, 0.09, 6), x + Math.sin(a) * 0.5, 0.045, z + Math.cos(a) * 0.5, 0, 1, 1, [1.3, 1.15, 1.0], -0.1)); }
  { const a = 5.6, [x, z] = polar(10.4, a);
    irons.push(prop(box(0.46, 0.02, 0.065), x, 0.025, z, a + 0.3, 1, 1, [1.9, 1.9, 2.0], -0.1));
    irons.push(prop(box(0.14, 0.035, 0.05), x - Math.sin(a) * 0.4, 0.03, z - Math.cos(a) * 0.4, a + 1.2, 1, 1, [1.2, 0.9, 0.7], -0.1)); }
  // ...and five more pieces the wind has half-buried inside the ring, spread wide (owner 2026-09-18: "4-6 pieces
  // scattered in the sand around the fighters, not too many, not close to each other"). Inside the play radius the
  // contract says nothing solid above 6 cm — so these lie flat or squashed into the sand, flush enough to fight over.
  { const scatter: [number, number, number][] = [[3.1, 0.6, 0], [6.9, 1.9, 1], [4.6, 3.3, 2], [7.6, 4.5, 3], [2.8, 5.5, 1]];   // r, angle, kind
    const RUST: [number, number, number] = [1.9, 1.55, 1.0], STEEL: [number, number, number] = [1.8, 1.8, 1.95], WOOD: [number, number, number] = [1.5, 1.15, 0.75];
    for (const [rr, a, kind] of scatter) { const [x, z] = polar(rr, a);
      if (kind === 0) {   // a shield sunk to its rim, boss up
        const shield = new THREE.SphereGeometry(0.3, 14, 5, 0, TAU, 0, Math.PI / 2); shield.scale(1, 0.13, 1);
        irons.push(prop(shield, x, -0.012, z, new THREE.Euler(0.055, a, 0.085), 1, 1, RUST, -0.05));
        const boss = new THREE.SphereGeometry(0.07, 8, 6); boss.scale(1, 0.4, 1);
        irons.push(prop(boss, x, 0.012, z, 0, 1, 1, RUST, -0.05));
      } else if (kind === 1) {   // a blade fragment, edge up
        irons.push(prop(box(0.4, 0.018, 0.06), x, 0.006, z, a + 0.4, 1, 1, STEEL, -0.05));
        irons.push(prop(box(0.12, 0.03, 0.05), x - Math.sin(a) * 0.35, 0.004, z - Math.cos(a) * 0.35, a + 1.1, 1, 1, WOOD, -0.05));
      } else if (kind === 2) {   // a helmet trodden into the sand
        const dome = new THREE.SphereGeometry(0.16, 10, 7); dome.scale(1, 0.32, 1.1);
        irons.push(prop(dome, x, 0.004, z, 0, 1, 1, [1.5, 1.42, 1.3], -0.05));
        irons.push(prop(box(0.18, 0.018, 0.1), x + Math.sin(a) * 0.1, 0.004, z + Math.cos(a) * 0.1, a, 1, 1, [1.5, 1.42, 1.3], -0.05));
      } else {   // a spear shaft snapped short
        const frag = cylinder(0.02, 0.024, 0.68, 6); frag.rotateZ(Math.PI / 2);
        irons.push(prop(frag, x, 0.012, z, a + 0.7, 1, 1, WOOD, -0.05));
      } } }
  // Sand dust at the exposed edges of fallen gear, baked into existing vertex colours; no floor decals or extra draw.
  for (const g of irons.slice(fallenStart)) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const dust = 0.42 * (1 - smooth(-0.012, 0.03, p.getY(i)));
      c.setXYZ(i, c.getX(i) * (1 - dust) + 3.4 * dust, c.getY(i) * (1 - dust) + 3 * dust, c.getZ(i) * (1 - dust) + 2.6 * dust);
    }
  }
  mesh(mergeGeometries(irons), iron, 'iron');
  mesh(mergeGeometries(coals), coal, 'coals', false);
  // Flames: one instanced tongue per brazier over the coals — three quads at 60° so it has volume from every angle
  // (owner 2026-09-18: fat, orange-red, waving). Additive, no light, no shadow; the motion runs in update().
  const flameQuad = (() => { const parts = [0, 1, 2].map(i => { const p = new THREE.PlaneGeometry(1.3, 0.78); p.rotateY(i * Math.PI / 3); return p; }); const g = mergeGeometries(parts); g.translate(0, 0.37, 0); return g; })();
  const flames = new THREE.InstancedMesh(flameQuad, flame, brazierAngles.length); flames.name = 'flames'; flames.castShadow = flames.receiveShadow = false; group.add(flames);
  const flameAnchors = brazierAngles.map(a => { const [x, z] = polar(wall.inner + 0.55, a); return { x, y: wall.top + 1.3, z }; });   // 0.55: the fattened quad's vertices (incl. the lick scale) stay outside the camera clamp; the offset from the coals is invisible
  // Ash motes hanging in the air: one Points cloud, positions recomputed in update() (base + slow drift + a gust on a landed blow).
  // Not a Mesh: the solid-geometry rules (play circle, camera clamp) are about things the camera can clip through; a speck cannot.
  const moteCount = 520, moteBase = new Float32Array(moteCount * 3), motePhase = new Float32Array(moteCount * 2);
  for (let i = 0; i < moteCount; i++) {
    const a = hash(i, 0, 61) * TAU, near = hash(i, 5, 61) < 0.62, r = Math.sqrt(hash(i, 1, 61)) * (near ? 7.2 : 10.6), y = 0.5 + Math.pow(hash(i, 2, 61), 1.3) * 4.9;
    moteBase[i * 3] = r * Math.sin(a); moteBase[i * 3 + 1] = y; moteBase[i * 3 + 2] = r * Math.cos(a);
    motePhase[i * 2] = hash(i, 3, 61) * TAU; motePhase[i * 2 + 1] = 0.5 + hash(i, 4, 61);
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(moteBase), 3));
  const motes = new THREE.Points(moteGeometry, motesMaterial); motes.name = 'motes'; motes.frustumCulled = false; group.add(motes);

  // Banners: one instanced cloth, swaying about its crossbar. Dried-blood and bone cloths alternate (instance colours; no saturation).
  const bannerGeometry = new THREE.PlaneGeometry(1.15, 2.7); bannerGeometry.translate(0, -1.35, 0);
  const banners = new THREE.InstancedMesh(bannerGeometry, cloth, bannerAngles.length); banners.name = 'banners'; banners.castShadow = true; group.add(banners);
  bannerAngles.forEach((_a, k) => banners.setColorAt(k, new THREE.Color(k % 2 ? '#7d7469' : '#472622')));
  // Five solid, unrigged silhouettes: familiar inhabitants of this world, distributed in loose groups across intact tiers.
  type Spectator = { x: number; y: number; z: number; yaw: number; scale: number; width: number; phase: number; id: number; dye: number };
  const crowds: { mesh: THREE.InstancedMesh; people: Spectator[] }[] = [], cells = CROWD_KINDS.length * 2;
  const people: Spectator[][] = Array.from({ length: cells }, () => []), seats: Omit<Spectator, 'dye'>[] = [];
  tiers.forEach((_h, i) => {
    const r = wall.outer + i * tierDepth + 0.55, step = 1.05 / r, count = Math.floor(TAU / step);
    for (let s = 0; s < count; s++) {
      const a = s * step + (hash(s, i, 17) - 0.5) * step * 0.28, occupied = hash(s, i, 19) > (i < 2 ? 0.37 : 0.28) + 0.28 * hash(Math.floor(s / 5), i, 71), segment = Math.floor(a / TAU * LAYOUT.segments);
      if (!occupied || ruin(a) > 0.3 || (i < 2 && (inGate(a, r, 0.8) || brazierAngles.some(b => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * r < 0.75)))) continue; // clear the gate approach, flames and collapsed treads
      const [x, z] = polar(r + (hash(s, i, 73) - 0.5) * 0.3, a);
      seats.push({ id: i * 256 + s, x, y: tierTop(i, a, segment), z, yaw: a + Math.PI + (hash(s, i, 75) - 0.5) * 0.4, scale: 0.84 + hash(s, i, 29) * 0.32, width: 0.88 + hash(s, i, 81) * 0.24, phase: hash(s, i, 31) });
    }
  });
  for (const p of mixSpectators(seats)) people[p.kind * 2 + p.pose].push(p);
  people.forEach((list, k) => {
    const instanced = new THREE.InstancedMesh(spectatorGeometry(CROWD_KINDS[Math.floor(k / 2)], k % 2), crowdMaterial, list.length); instanced.name = `crowd ${CROWD_KINDS[Math.floor(k / 2)]}${k % 2 ? " folded" : ""}`; instanced.castShadow = false; instanced.receiveShadow = true; group.add(instanced);
    list.forEach((p, j) => instanced.setColorAt(j, new THREE.Color(CROWD_DYES[p.dye]).multiplyScalar(0.38 + hash(p.id, 0, 41) * 0.16)));
    crowds.push({ mesh: instanced, people: list });
  });
  // The sky dome (unfogged; its horizon is painted the fog colour) and the ash plain with its far ridges. The dome has no pole: its
  // zenith vertex would sit over the play circle, and the camera's pitch clamp never looks within 3.6° of straight up.
  const dome = mesh(new THREE.SphereGeometry(150, 40, 20, 0, TAU, Math.PI * 0.02, Math.PI * 0.54), sky, 'sky', false); dome.receiveShadow = false;
  const ridges: THREE.BufferGeometry[] = [band(wall.inner, flat(-0.03), 150, flat(-0.03), 1, () => [1, 1, 1])];
  for (let i = 0; i < 40; i++) {   // two rings of broad, uneven ridges; the fog turns them into layers of ash-grey horizon
    const far = i >= 22, a = (far ? (i - 22) / 18 : i / 22) * TAU + (far ? 0.2 : 0), h = (far ? 14 : 7) + hash(i, 0, 43) * (far ? 16 : 9), r = far ? 110 : 62, [x, z] = polar(r, a);
    ridges.push(prop(cylinder((2 + hash(i, 4, 43) * 5), 14 + hash(i, 1, 43) * 16, h, 7), x, h / 2 - 3, z, new THREE.Euler(0, hash(i, 2, 43) * 3, 0), new THREE.Vector3(1.7 + hash(i, 3, 43), 1, 1), 1, [1, 1, 1], -5));
  }
  mesh(mergeGeometries(ridges), plain, 'plain', false);

  // Motion. Only dt-driven: a hit-stop passes dt 0 and everything holds its pose with the fighters.
  let time = 0, flare = 0, mood: 'idle' | 'cheer' | 'lean' | 'recoil' = 'idle', since = 0;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3();
  // Reaction curves, all under the readable-brutality cap (≤ 0.1 m, ≤ 8°): a bob on a blow, a lean-in on a parry, a recoil on a kill.
  function reaction(t: number, phase: number): [number, number] {
    if (mood === 'cheer') { const u = t - phase * 0.12; return [u > 0 && u < 0.55 ? 0.06 * Math.sin(Math.PI * u / 0.55) : 0, 0]; }
    if (mood === 'lean') { const k = smooth(0, 0.15, t) * (1 - smooth(0.8, 1.1, t)); return [0.04 * k, 0.12 * k]; }
    if (mood === 'recoil') { const k = smooth(0, 0.2, t) * (1 - smooth(1.4, 2, t)); return [-0.035 * k, -0.14 * k]; }
    return [0, 0];
  }
  function place(instanced: THREE.InstancedMesh, i: number, x: number, y: number, z: number, tilt: number, yaw: number, s: number, width = 1) {
    position.set(x, y, z); quaternion.setFromEuler(euler.set(tilt, yaw, 0, 'YXZ')); scale.set(s * width, s, s * width); instanced.setMatrixAt(i, matrix.compose(position, quaternion, scale));
  }
  function update(dt: number, events: CombatEvent[]) {
    time += dt; since += dt; flare = Math.max(0, flare - dt * 2.5);
    for (const e of events) {
      if (e.type === 'Killed') { mood = 'recoil'; since = 0; } else if (e.type === 'Parried') { mood = 'lean'; since = 0; } else if (e.type === 'Hit' || e.type === 'GuardBroken' || e.type === 'PostureBroken') { mood = 'cheer'; since = 0; }
      if (e.type === 'Hit' || e.type === 'GuardBroken' || e.type === 'Killed') flare = 1;
    }
    if (since > 2.2) mood = 'idle';
    coal.emissiveIntensity = 1.1 + 0.12 * Math.sin(time * 9.7) + 0.08 * Math.sin(time * 17.3 + 1.7) + 0.1 * (hash(Math.floor(time * 30), 0, 1) - 0.5) + flare * 1.3;
    bannerAngles.forEach((a, k) => { const [x, z] = polar(bannerR, a); place(banners, k, x, bannerTop, z, 0.055 * Math.sin(time * 1.15 + k * 1.9) + 0.02 * Math.sin(time * 3.3 + k * 4.1), a, 1); });
    banners.instanceMatrix.needsUpdate = true;
    // Flames: a wave, not a pump (owner 2026-09-18) — a slow lean, a slow counter-rotation, a gentle breathe, a small fast lick;
    // the vertical scale barely moves. The tongue swells with the coals' flare on a landed blow.
    flameAnchors.forEach((p, k) => {
      const lean = 0.13 * Math.sin(time * 2.2 + k * 1.7) + 0.05 * Math.sin(time * 5.1 + k * 2.9);
      const breathe = 1 + 0.06 * Math.sin(time * 2.9 + k * 2.1) + 0.04 * Math.sin(time * 7.3 + k) + flare * 0.25;
      const lick = 1 + 0.08 * Math.sin(time * 4.7 + k * 3.7);
      position.set(p.x, p.y, p.z); quaternion.setFromEuler(euler.set(lean, k * 1.3 + time * 0.35 * (k % 2 ? 1 : -1), 0, 'YXZ')); scale.set(lick, breathe, lick);
      flames.setMatrixAt(k, matrix.compose(position, quaternion, scale));
    });
    flames.instanceMatrix.needsUpdate = true;
    // Ash motes: a two-frequency drift fast enough to catch the eye, a barely-there settle, and a gust that swirls them when a blow lands.
    { const p = moteGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i++) {
        const ph = motePhase[i * 2], sp = motePhase[i * 2 + 1], g = 1 + flare * 3.2;
        p.setXYZ(i,
          moteBase[i * 3] + (0.55 * Math.sin(time * 0.19 * sp + ph) + 0.14 * Math.sin(time * 0.9 * sp + ph * 2.3)) * g,
          Math.max(0.15, moteBase[i * 3 + 1] + 0.3 * Math.sin(time * 0.13 * sp + ph * 1.7) - 0.1 * flare * Math.sin(ph)),
          moteBase[i * 3 + 2] + (0.55 * Math.cos(time * 0.16 * sp + ph * 1.3) + 0.14 * Math.cos(time * 0.8 * sp + ph)) * g);
      }
      p.needsUpdate = true; }
    for (const { mesh, people } of crowds) {
      people.forEach((p, i) => { const [rise, tilt] = reaction(since, p.phase); place(mesh, i, p.x, p.y + rise + 0.012 * Math.sin(time * 1.9 + p.phase * TAU), p.z, tilt, p.yaw, p.scale, p.width); });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  update(0, []);
  return {
    group, floor, update,
    dispose() {
      group.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) object.geometry.dispose(); if (object instanceof THREE.InstancedMesh) object.dispose(); });
      for (const material of materials) material.dispose(); for (const t of Object.values(textures)) t.dispose(); scene.remove(group);
    },
  };
}

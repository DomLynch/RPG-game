// `?look=pit,pit-glow` (Dom's painted-cell reference, 2026-10-04: ~/Desktop/Business/artifacts/pit-reference-20261004/pit-cell-chosen.webp):
// the same walkable room, relit gold. What this file adds: the arena's own painted far world (Arena 1's backdrop) behind the gate bars,
// the shafts of light that come through the bars and lie as stripes on the sand, and a golden haze in the gate. room.ts warms the
// stone, the sand and the lights; pit.ts swaps the arena's fog for a warm one while the room is up. Look test only, never the default.
import * as THREE from 'three';
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

// Grime on the walls (Dom 10-04: "too symmetrical, fake looking ... a cave, an ancient gladiator room, not a 5* hotel"): over each wall a
// sheet of its own dirt, so the 2 m stone tile stops repeating. Rising damp darkest at the foot, broad soot-and-sweat blotches that never
// line up with the blocks, soot climbing above the torches, and old blood: a few splatters at body height with drips run down from them.
// Lit like the wall (MeshStandardMaterial), one draw per wall; seeds differ so no two walls match.
type Wall = { w: number; h: number; at: THREE.Vector3Tuple; turn: number; seed: number; torch?: number };   // torch: the sconce's u (0..1) on this wall
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
    // Old blood: a splatter or two at body height (0.6..1.6 m), drips run down from them, the colour of the floor's stains.
    let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const splats = 2 + Math.floor(rnd() * 3 * w / 4);
    for (let k = 0; k < splats; k++) {
      const cx = (0.1 + rnd() * 0.8) * cw, cy = ch - (0.6 + rnd()) * PX / 2, size = (0.22 + rnd() * 0.35) * PX / 2;
      for (let j = 0; j < 90; j++) {   // the spray: big drops near the heart, fine ones flung out to one side
        const ang = rnd() * Math.PI * 2, dist = rnd() ** 1.8 * size * 2.2, rr = Math.max(0.6, (1 - dist / (size * 2.2)) * size * 0.28 * (0.4 + rnd()));
        g.fillStyle = `rgba(${48 + rnd() * 16},${12 + rnd() * 6},${8 + rnd() * 4},${0.65 + rnd() * 0.25})`;
        g.beginPath(); g.ellipse(cx + Math.cos(ang) * dist * 1.4, cy + Math.sin(ang) * dist, rr * (1 + rnd()), rr, ang, 0, Math.PI * 2); g.fill();
      }
      if (rnd() < 0.6) {   // a smear beside it: something bloody dragged along the stone
        const sw = (0.4 + rnd() * 0.6) * PX / 2, sh = (0.06 + rnd() * 0.08) * PX / 2, sx = cx + (rnd() - 0.5) * size * 2, sy = cy + size * (0.5 + rnd());
        const smear = g.createLinearGradient(sx, 0, sx + sw, 0);
        smear.addColorStop(0, 'rgba(48,12,8,0.7)'); smear.addColorStop(0.7, 'rgba(48,12,8,0.3)'); smear.addColorStop(1, 'rgba(48,12,8,0)');
        g.fillStyle = smear; g.fillRect(sx, sy, sw, sh);
      }
      for (let j = 0, n = 3 + Math.floor(rnd() * 5); j < n; j++) {   // drips: thin runs that thin out and stop
        const x0 = cx + (rnd() - 0.5) * size * 1.6, len = (0.3 + rnd() * 0.8) * PX / 2, wd = 1.2 + rnd() * 2;
        const run = g.createLinearGradient(0, cy, 0, cy + len);
        run.addColorStop(0, 'rgba(50,12,8,0.7)'); run.addColorStop(1, 'rgba(50,12,8,0)');
        g.fillStyle = run; g.fillRect(x0 - wd / 2, cy, wd, len);
        g.fillStyle = 'rgba(46,11,7,0.65)'; g.beginPath(); g.arc(x0, cy + len * 0.85, wd * 0.9, 0, Math.PI * 2); g.fill();
      }
    }
  });
}
export function addGrime(group: THREE.Group, room: { width: number; depth: number; height: number; gateWidth: number }, torchZ: number) {
  const { width: W, depth: D, height: H, gateWidth } = room, hw = W / 2, hd = D / 2, side = hw - gateWidth / 2, off = 0.012;
  const torchU = (D / 2 + torchZ) / D;   // the sconces sit near the far end of each side wall
  const walls: Wall[] = [
    { w: side, h: H, at: [-hw + side / 2, H / 2, -hd + off], turn: 0, seed: 301 },
    { w: side, h: H, at: [hw - side / 2, H / 2, -hd + off], turn: 0, seed: 307 },
    // the left wall is turned +90°, so its u runs toward the far wall: the torch sits at 1 - torchU there
    { w: D, h: H, at: [-hw + off, H / 2, 0], turn: Math.PI / 2, seed: 311, torch: 1 - torchU },
    { w: D, h: H, at: [hw - off, H / 2, 0], turn: -Math.PI / 2, seed: 313, torch: torchU },
    { w: W, h: H, at: [0, H / 2, hd - off], turn: Math.PI, seed: 317 },
  ];
  const textures: THREE.Texture[] = [], materials: THREE.MeshStandardMaterial[] = [], geometries: THREE.BufferGeometry[] = [];
  for (const wall of walls) {
    const map = grimeTexture(wall);
    const material = new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const geometry = new THREE.PlaneGeometry(wall.w, wall.h).rotateY(wall.turn).translate(...wall.at);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    textures.push(map); materials.push(material); geometries.push(geometry);
  }
  return { textures, materials, geometries };
}

// `?look=pit,pit-glow` (Dom's painted-cell reference, 2026-10-04: ~/Desktop/Business/artifacts/pit-reference-20261004/pit-cell-chosen.webp):
// the same walkable room, relit gold. What this file adds: the arena's own painted far world (Arena 1's backdrop) behind the gate bars,
// the shafts of light that come through the bars and lie as stripes on the sand, and a golden haze in the gate. room.ts warms the
// stone, the sand and the lights; pit.ts swaps the arena's fog for a warm one while the room is up. Look test only, never the default.
import * as THREE from 'three';

export const GLOW = { fog: '#8a5a30', fogDensity: 0.035, light: '#ffd08a', stone: '#d9a86e', sand: '#f2c58a', fill: '#ffbf7a' };

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
  const onFloor = glowing(floorBars, 0.55), inAir = glowing(airBars, 0.16), haze = glowing(halo, 0.3);
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
  material.color.set('#ffe6bf');
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}arena/backdrop-1.webp`, (map) => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.repeat.set(1, 0.55); map.offset.set(0, 0.2);
    textures.push(map);
    material.map = map; material.needsUpdate = true;
  }, undefined, () => { /* the plain daylight stays */ });
}

// The skull wall's skull (World, Lead 2026-09-30): public/pit/props/skull.glb, a human skull built here, so the source is this file and
// the licence is the repo's own (no third-party model). The wall (src/pit/wall.ts) draws it up to 100 times in 0.2 m niches, so the
// cap is 400 triangles (Lead's ruling), and at 375 a niche skull is ~25 px wide: the read is the silhouette (a domed cranium over a
// narrower face and jaw) and three dark holes (the eyes and the nose), not modelling. One mesh, one primitive, one material, vertex
// colour (no texture); Y-up, facing +Z, centred; no node transforms (the loader fits the raw geometry). `node scripts/pit-skull.mjs`.
import { writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const OUT = 'public/pit/props/skull.glb', MAX_TRIS = 400;
// Aged, stained bone (Lead 2026-09-30: realism over clean ivory; Dom's bar is "not Minecraft"), a dusty rim to each hole, near black inside.
const BONE = new THREE.Color(0.44, 0.38, 0.27), STAIN = new THREE.Color(0.2, 0.14, 0.08), HOLE = new THREE.Color(0.012, 0.01, 0.008), RIM = new THREE.Color(0.07, 0.055, 0.04), TEETH = new THREE.Color(0.4, 0.34, 0.23);

// A part: position + normal + colour, indexed, no uv (every part must carry the same attributes to merge).
// `shade` returns a brightness, or a colour to use as is (the stains and the rims).
function part(g, colour, shade = () => 1) {
  g.deleteAttribute('uv');
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = shade(p.getX(i), p.getY(i), p.getZ(i), i), v = k instanceof THREE.Color ? k : colour.clone().multiplyScalar(k);
    c[i * 3] = v.r; c[i * 3 + 1] = v.g; c[i * 3 + 2] = v.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g : g.setIndex([...Array(p.count).keys()]);
}
// Bone darkens toward the underside and the back of the head: the wall's light comes from the room, so the face stays the brightest.
// Over that, seeded stains: earth-brown patches (strongest low down and in the face's hollows) mixed into the bone per vertex.
const hash = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
const aged = (x, y, z) => {
  const light = 0.72 + 0.28 * THREE.MathUtils.clamp(0.5 + 0.6 * y + 0.35 * z, 0, 1);
  const stain = THREE.MathUtils.clamp(0.8 * hash(Math.round(x * 4), Math.round(y * 4), Math.round(z * 4)) + 0.45 * THREE.MathUtils.clamp(-y, 0, 1) - 0.25, 0, 0.85);
  return BONE.clone().lerp(STAIN, stain).multiplyScalar(light);
};
// A hole: its centre vertex near black, its rim a dusty brown, so the socket reads as depth, not a painted dot.
const socket = (_x, _y, _z, i) => (i === 0 ? HOLE : RIM);

// Units: 1 ≈ 10 cm (the loader rescales the longest side to the niche). Human proportions: cranium ~14 wide × 13 high × 19 long.
const cranium = new THREE.SphereGeometry(1, 12, 9);
cranium.scale(0.7, 0.66, 0.92).translate(0, 0.22, -0.08);
{   // flatten the brow and the temples a little so the face plane reads, and pull the forehead forward over the eyes
  const p = cranium.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0.35 && y < 0.35) p.setZ(i, 0.35 + (z - 0.35) * 0.55);   // the face is flatter than the dome
    if (Math.abs(x) > 0.55 && y < 0.2) p.setX(i, Math.sign(x) * (0.55 + (Math.abs(x) - 0.55) * 0.6));   // temples
  }
  cranium.computeVertexNormals();
}
// The face (maxilla and cheekbones) and the jaw: two tapered 8-sided blocks under the front of the cranium.
const face = new THREE.CylinderGeometry(0.56, 0.38, 0.42, 8).scale(1, 1, 0.7).translate(0, -0.3, 0.18);
const jaw = new THREE.CylinderGeometry(0.44, 0.26, 0.26, 8).scale(1, 1, 0.95).translate(0, -0.66, 0.06);   // tapered to the chin
// The teeth: a strip of seven, every other column dark, so they read as teeth and not a bar.
const teeth = new THREE.PlaneGeometry(0.4, 0.1, 7, 1).translate(0, -0.52, 0.5);
const toothGaps = (x) => (Math.round((x + 0.2) / (0.4 / 7)) % 2 ? 0.55 : 1);
// The holes: dark fans just proud of the surface they sit on (the orbits on the face plane, the nose below them).
const disc = (r, x, y, z, sy = 1) => new THREE.CircleGeometry(r, 8).scale(1, sy, 1).translate(x, y, z);
const eyes = [-1, 1].map((s) => disc(0.18, s * 0.24, -0.04, 0.6, 0.88).rotateZ(s * 0.15));   // squarish orbits, tipped outward
const nose = new THREE.CircleGeometry(0.085, 3).rotateZ(-Math.PI / 2).scale(1, 1.5, 1).translate(0, -0.24, 0.56);

const parts = [part(cranium, BONE, aged), part(face, BONE, aged), part(jaw, BONE, aged), part(teeth, TEETH, toothGaps),
  ...eyes.map((g) => part(g, HOLE, socket)), part(nose, HOLE, socket)];
const merged = mergeGeometries(parts);
merged.computeBoundingBox();
merged.translate(...merged.boundingBox.getCenter(new THREE.Vector3()).negate().toArray());   // centred: the wall centres too, but the file stands alone
const tris = merged.index.count / 3;
if (tris > MAX_TRIS) throw new Error(`skull.glb is ${tris} triangles, the cap is ${MAX_TRIS}`);

// A minimal GLB: one buffer (positions, normals, colours, uint16 indices), one mesh, one node, one material. No texture, no extensions.
const pos = merged.attributes.position.array, nrm = merged.attributes.normal.array, col = merged.attributes.color.array;
const idx = Uint16Array.from(merged.index.array), count = pos.length / 3;
const views = [pos, nrm, col, idx].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
const pad = (b, fill = 0) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
let offset = 0;
const bufferViews = views.map((b, i) => { const v = { buffer: 0, byteOffset: offset, byteLength: b.length, target: i === 3 ? 34963 : 34962 }; offset += pad(b).length; return v; });
const box = merged.boundingBox.clone().translate(merged.boundingBox.getCenter(new THREE.Vector3()).negate());
const gltf = {
  asset: { version: '2.0', generator: 'frankendom scripts/pit-skull.mjs' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'skull' }],
  meshes: [{ name: 'skull', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 }] }],
  materials: [{ name: 'skull-bone', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 } }],
  accessors: [
    { bufferView: 0, componentType: 5126, count, type: 'VEC3', min: box.min.toArray(), max: box.max.toArray() },
    { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count, type: 'VEC3' },
    { bufferView: 3, componentType: 5123, count: idx.length, type: 'SCALAR' },
  ],
  bufferViews, buffers: [{ byteLength: offset }],
};
const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20), bin = Buffer.concat(views.map((b) => pad(b)));
const header = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
mkdirSync('public/pit/props', { recursive: true });
writeFileSync(OUT, Buffer.concat([header, jh, json, bh, bin]));
const size = merged.boundingBox.getSize(new THREE.Vector3());
console.log(`${OUT}: ${tris} triangles, ${count} vertices, ${12 + 16 + json.length + bin.length} B, ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} (×10 cm)`);

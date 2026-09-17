import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildArena, LAYOUT, PLAY_RADIUS, CAMERA_CLAMP, SAND_TILE } from '../src/arena.ts';
import { luminance, sandAlbedo } from '../src/assets/arena/textures.ts';
import { RADIUS } from '../src/sim.ts';

// The arena's contract with the simulation, the camera and the fighters. The world lane may replace every mesh; these stay true.
// Mean linear luminance of the hero's skin albedo (warrior.glb material "Skin", baseColorTexture), measured by scripts/arena-preview.mjs
// (stats.json skinLuminance) on 2026-09-17 at 9d08824. The floor must sit below it: fighters stay the brightest thing on screen.
const SKIN_SAMPLE = 0.166, FLOOR_CAP = 0.35;
function built() {
  const scene = new THREE.Scene(), arena = buildArena(scene); scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = []; arena.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
  return { scene, arena, meshes };
}
// Real world-space vertices (a rotated box's axis-aligned bounds reach metres closer to the centre than the box does); every instance of an
// instanced mesh (the crowd, the banners) is walked, not the shared quad at the origin.
function* vertices(m: THREE.Mesh) {
  const p = m.geometry.attributes.position, v = new THREE.Vector3(), im = new THREE.Matrix4();
  const instances = m instanceof THREE.InstancedMesh ? m.count : 1;
  for (let k = 0; k < instances; k++) {
    if (m instanceof THREE.InstancedMesh) m.getMatrixAt(k, im); else im.identity();
    for (let i = 0; i < p.count; i++) yield v.fromBufferAttribute(p, i).applyMatrix4(im).applyMatrix4(m.matrixWorld);
  }
}
const worldBox = (m: THREE.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld); };
const rgbLuminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const shared = built();

test('the play radius the arena is built for is the simulation\'s', () => { assert.equal(PLAY_RADIUS, RADIUS); });

test('nothing solid stands inside the play circle above the floor, and nothing reaches inside the camera clamp at fighter height', () => {
  for (const m of shared.meshes) for (const v of vertices(m)) {
    const r = Math.hypot(v.x, v.z);
    if (r < PLAY_RADIUS) assert.ok(v.y <= 0.06, `${m.name || m.geometry.type} has a vertex at ${r.toFixed(2)} m, ${v.y.toFixed(2)} m high, inside the play circle`);
    if (r < CAMERA_CLAMP) assert.ok(v.y <= 0.5 || v.y > 6, `${m.name || m.geometry.type} has a vertex at ${r.toFixed(2)} m, ${v.y.toFixed(2)} m high, inside the camera clamp`);
  }
});

test('a visible boundary ring lies at the play radius', () => {
  const rings = shared.meshes.filter(m => m.geometry.type === 'RingGeometry').map(worldBox);
  assert.ok(rings.some(b => Math.abs(b.max.x - PLAY_RADIUS) < 0.1), 'no ring within 10 cm of the play radius');
});

test('the floor is sand, darker than the hero\'s skin, flat to the camera clamp, with planar decal UVs', () => {
  const { floor } = shared.arena, material = floor.material as THREE.MeshStandardMaterial, p = floor.geometry.attributes.position, uv = floor.geometry.attributes.uv, color = floor.geometry.attributes.color;
  assert.equal(floor.name, 'sand'); assert.equal(material.map!.image.width, 1024);
  let tint = 0; for (let i = 0; i < color.count; i++) tint += 0.2126 * color.getX(i) + 0.7152 * color.getY(i) + 0.0722 * color.getZ(i);
  const albedo = luminance(sandAlbedo()) * rgbLuminance(material.color) * (tint / color.count);   // texture × material colour × mean vertex tint: what the shader multiplies
  assert.ok(albedo < SKIN_SAMPLE, `sand albedo ${albedo.toFixed(3)} is not below the skin sample ${SKIN_SAMPLE}`); assert.ok(albedo < FLOOR_CAP);
  assert.ok(worldBox(floor).max.x >= CAMERA_CLAMP, 'the sand ends inside the camera clamp: a visible edge');
  for (let i = 0; i < p.count; i += 97) { assert.ok(Math.abs(uv.getX(i) - p.getX(i) / SAND_TILE) < 1e-4 && Math.abs(uv.getY(i) - p.getZ(i) / SAND_TILE) < 1e-4, 'floor UVs are not u = x / SAND_TILE, v = z / SAND_TILE'); assert.equal(p.getY(i), 0); }
});

test('the crowd stands on the tiers, outside the clamp, and never moves past the readable-brutality cap; a hit-stop holds it still', () => {
  const { scene, arena } = built(), crowd = [...arena.group.children].filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && o.name.startsWith('crowd'));
  const count = crowd.reduce((n, m) => n + m.count, 0); assert.ok(count >= 150 && count <= 600, `${count} spectators`);
  const rest = new Map<string, THREE.Matrix4[]>(); for (const m of crowd) rest.set(m.name, Array.from({ length: m.count }, (_, i) => { const x = new THREE.Matrix4(); m.getMatrixAt(i, x); return x; }));
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos0 = new THREE.Vector3(), q0 = new THREE.Quaternion();
  for (const m of crowd) for (let i = 0; i < m.count; i++) { rest.get(m.name)![i].decompose(pos, q, s); assert.ok(Math.hypot(pos.x, pos.z) > LAYOUT.wall.outer + 2 * LAYOUT.tierDepth, 'a spectator on the lowest tiers'); assert.ok(pos.y >= LAYOUT.tiers[1], 'a spectator below the tiers'); }
  let moved = 0, tilted = 0;
  const measure = () => { for (const m of crowd) for (let i = 0; i < m.count; i++) { const x = new THREE.Matrix4(); m.getMatrixAt(i, x); x.decompose(pos, q, s); rest.get(m.name)![i].decompose(pos0, q0, s); moved = Math.max(moved, pos.distanceTo(pos0)); tilted = Math.max(tilted, q.angleTo(q0)); } };
  arena.update(0, [{ tick: 1, type: 'Killed', actor: 0, target: 1 } as never]); measure(); assert.equal(moved, 0, 'a hit-stop (dt 0) moved the crowd');
  for (const type of ['Killed', 'Parried', 'Hit']) { arena.update(1 / 60, [{ tick: 1, type, actor: 0, target: 1 } as never]); for (let t = 0; t < 180; t++) { arena.update(1 / 60, []); measure(); } }
  assert.ok(moved > 0.02 && moved <= 0.1, `crowd moved ${moved.toFixed(3)} m (cap 0.1)`); assert.ok(tilted <= 8.5 * Math.PI / 180, `crowd tilted ${(tilted * 180 / Math.PI).toFixed(1)}° (cap 8)`);
  arena.dispose(); assert.equal(scene.getObjectByName('arena'), undefined);
});

test('the arena updates and disposes without touching the fighters', () => {
  const { scene, arena, meshes } = built();
  assert.ok(meshes.length > 0);
  arena.update(1 / 60, [{ tick: 1, type: 'Hit', actor: 0, target: 1 } as never]);
  arena.dispose();
  assert.equal(scene.getObjectByName('arena'), undefined, 'the arena group leaves the scene');
});

test('arena cost: ≤ 40 draw calls (meshes), ≤ 120k triangles, ≤ 12 MB of texture memory with mips', () => {
  const { meshes } = shared, textures = new Set<THREE.Texture>();
  const triangles = meshes.reduce((n, m) => n + (m instanceof THREE.InstancedMesh ? m.count : 1) * (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
  for (const m of meshes) for (const material of [m.material].flat() as THREE.MeshStandardMaterial[]) for (const t of [material.map, material.normalMap, material.alphaMap, material.emissiveMap, material.aoMap, material.roughnessMap]) if (t) textures.add(t);
  const bytes = [...textures].reduce((n, t) => n + t.image.width * t.image.height * 4 * (t.generateMipmaps ? 4 / 3 : 1), 0);
  console.log(`arena cost: ${meshes.length} meshes (draw calls before shadows), ${Math.round(triangles)} triangles, ${textures.size} textures ${(bytes / 1e6).toFixed(1)} MB`);
  assert.ok(meshes.length <= 40, `${meshes.length} meshes`); assert.ok(triangles <= 120_000, `${triangles} triangles`); assert.ok(bytes <= 12e6, `${bytes} bytes of textures`);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildArena, PLAY_RADIUS, CAMERA_CLAMP } from '../src/arena.ts';
import { RADIUS } from '../src/sim.ts';

// The arena's contract with the simulation and the camera. The world lane may replace every mesh; these stay true.
function built() {
  const scene = new THREE.Scene(), arena = buildArena(scene); scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = []; arena.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
  return { scene, arena, meshes };
}
// Real world-space vertices (a rotated box's axis-aligned bounds reach metres closer to the centre than the box does).
function* vertices(m: THREE.Mesh) { const p = m.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) yield v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); }
const worldBox = (m: THREE.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld); };

test('the play radius the arena is built for is the simulation\'s', () => { assert.equal(PLAY_RADIUS, RADIUS); });

test('nothing solid stands inside the play circle above the floor, and nothing reaches inside the camera clamp at fighter height', () => {
  const { meshes } = built();
  for (const m of meshes) for (const v of vertices(m)) {
    const r = Math.hypot(v.x, v.z);
    if (r < PLAY_RADIUS) assert.ok(v.y <= 0.06, `${m.geometry.type} has a vertex at ${r.toFixed(2)} m, ${v.y.toFixed(2)} m high, inside the play circle`);
    if (r < CAMERA_CLAMP) assert.ok(v.y <= 0.5 || v.y > 6, `${m.geometry.type} has a vertex at ${r.toFixed(2)} m, ${v.y.toFixed(2)} m high, inside the camera clamp`);
  }
});

test('a visible boundary ring lies at the play radius', () => {
  const { meshes } = built();
  const rings = meshes.filter(m => m.geometry.type === 'RingGeometry').map(worldBox);
  assert.ok(rings.some(b => Math.abs(b.max.x - PLAY_RADIUS) < 0.1), 'no ring within 10 cm of the play radius');
});

test('the arena updates and disposes without touching the fighters', () => {
  const { scene, arena, meshes } = built();
  assert.ok(meshes.length > 0);
  arena.update(1 / 60, [{ tick: 1, type: 'Hit', actor: 0, target: 1 } as never]);
  arena.dispose();
  assert.equal(scene.getObjectByName('arena'), undefined, 'the arena group leaves the scene');
});

test('arena cost baseline (the world lane lowers these; a courtyard must not silently grow past them)', () => {
  const { meshes } = built();
  const triangles = meshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
  console.log(`arena baseline: ${meshes.length} meshes (draw calls before merging), ${Math.round(triangles)} triangles`);
  assert.ok(meshes.length <= 320, `${meshes.length} meshes`); assert.ok(triangles <= 120_000, `${triangles} triangles`);
});

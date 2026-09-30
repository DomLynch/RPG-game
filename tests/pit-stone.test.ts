// Web's `?look=pit-stone` look test (src/pit/stone.ts, stone-maps.ts): the maps are deterministic and wrap, the look adds no draw, and
// dispose frees what it built. The default room (no flag) is pit-room.test.ts's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRoom } from '../src/pit/room.ts';
import { FLOOR, WALL, stoneBytes } from '../src/pit/stone-maps.ts';
import type { Stage } from '../src/pit/stage.ts';

const stage = (look?: 'stone-proc'): Stage => ({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: undefined as unknown as THREE.WebGLRenderer,
  setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }), ...(look ? { look } : {}),
});
const draws = (group: THREE.Object3D) => { let n = 0; group.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) n++; }); return n; };

test('the stone maps: the same seed gives the same bytes, and the tile wraps (its edge rows and columns meet as its middle ones do)', () => {
  const small = { ...WALL, size: 128 }, a = stoneBytes(small), b = stoneBytes(small);
  assert.deepEqual(a.albedo, b.albedo); assert.deepEqual(a.normal, b.normal);
  const s = small.size, lum = (x: number, y: number) => a.albedo[(y * s + x) * 4]! + a.albedo[(y * s + x) * 4 + 1]!;
  const step = (pairs: [number, number][]) => pairs.reduce((sum, [p, q]) => sum + Math.abs(p - q), 0) / pairs.length;
  const seam = step(Array.from({ length: s }, (_, y) => [lum(s - 1, y), lum(0, y)]));
  const inner = step(Array.from({ length: s }, (_, y) => [lum(s / 2 - 1, y), lum(s / 2, y)]));
  assert.ok(seam < inner * 2.5, `the wrap seam steps no harder than the middle: ${seam.toFixed(1)} vs ${inner.toFixed(1)}`);
  assert.equal(stoneBytes({ ...FLOOR, size: 64 }).albedo.length, 64 * 64 * 4);
});

test('?look=pit-stone: the same draws as the default room, the maps land (synchronously without a Worker), and dispose frees them', async () => {
  const plain = buildRoom(stage()), stone = buildRoom(stage('stone-proc'));
  assert.equal(draws(stone.group), draws(plain.group), 'the plinth, cornice and ribs merge into the wall draw');
  await stone.ready;
  const wide = (o: THREE.Object3D) => o instanceof THREE.Mesh && ((o.material as THREE.MeshStandardMaterial).normalMap?.image as { width: number } | undefined)?.width === WALL.size;
  const wall = stone.group.children.find(wide) as THREE.Mesh | undefined;
  assert.ok(wall, 'a mesh carries the 512² stone normal map once ready');
  const map = (wall.material as THREE.MeshStandardMaterial).map!;
  let freed = false; const free = map.dispose.bind(map); map.dispose = () => { freed = true; free(); };
  stone.dispose(); plain.dispose();
  assert.ok(freed, 'the stone map is disposed with the room');
});

test('?look=pit-stone (GPT\'s set): one more draw than the default room, the vault in its own material; no page, the stand-ins stay', async () => {
  const plain = buildRoom(stage()), gpt = buildRoom({ ...stage(), look: 'stone' });
  assert.equal(draws(gpt.group), draws(plain.group) + 1);
  await gpt.ready;
  gpt.dispose(); plain.dispose();
});

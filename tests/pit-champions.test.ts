// The wall of champions' data (src/pit/skulls.ts): the daily_board_summary() mapping, name hygiene, the fetch that never throws, the demo set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PORTRAIT_KEYS } from '../src/legends.ts';
import { CHAMPIONS, buildChampions, championsTexture } from '../src/pit/champions-board.ts';
import { POSES, ROOM, buildRoom } from '../src/pit/room.ts';
import { createPicker } from '../src/pit/picker.ts';
import { pitLookFrom } from '../src/look-flag.ts';
import type { Stage } from '../src/pit/stage.ts';
import { NO_CHAMPIONS, boardName, championLine, championsFromSummary, demoChampions, fetchChampions, type SkullDb } from '../src/pit/skulls.ts';

const full = {
  day: '2026-10-04',
  fastest_kill: { display_name: 'Wanderer', ticks: 852, verified: true, outcome: 'killed' },
  cleanest_kill: { display_name: 'Ivy', taken: 1, verified: true },
  longest_survived: { display_name: 'Marcus', ticks: 4310, verified: false },
  fastest_death: { display_name: 'Dunmore', ticks: 410, verified: true },
  where: { gate: 3, pit: 3, wall: 1 }, pending: 4,
};

test('five lines in the summary\'s order: feat, name, value; seconds to one decimal, hits, the deadliest spot', () => {
  const lines = championsFromSummary(full);
  assert.deepEqual(lines.map((c) => c.key), ['fastestKill', 'cleanestKill', 'longestSurvived', 'fastestDeath', 'where']);
  assert.deepEqual(lines.map(championLine), ['Fastest kill  Wanderer  14.2 s', 'Cleanest kill  Ivy  1 hit', 'Longest survived  Marcus*  71.8 s', 'Fastest death  Dunmore  6.8 s', 'Deadliest spot  gate  3 deaths']);
  assert.equal(lines[2]!.verified, false, 'an unverified row is starred');
});
test('no location split: the unverified count is the fifth line; neither: four lines at most', () => {
  const noWhere = championsFromSummary({ ...full, where: null });
  assert.equal(championLine(noWhere[4]!), 'Pending  4 unverified today');
  assert.equal(championsFromSummary({ ...full, where: {}, pending: 0 }).length, 4);
});
test('an empty or malformed day gives no lines, and never throws', () => {
  const empty = { day: '2026-10-04', fastest_kill: null, cleanest_kill: null, longest_survived: null, fastest_death: null, where: null, pending: 0 };
  for (const v of [empty, null, undefined, 7, 'x', [], {}, { fastest_kill: 'no' }, { fastest_kill: { ticks: 'fast' } }, { fastest_kill: { ticks: -5 } }, { where: { a: 'x' } }, { where: [1] }, { pending: 'many' }]) assert.deepEqual(championsFromSummary(v), []);
  assert.equal(NO_CHAMPIONS, 'No champions yet today.');
});
test('the rpc may hand the object bare, in an array of one, or as JSON text', () => {
  const want = championsFromSummary(full);
  assert.deepEqual(championsFromSummary([full]), want);
  assert.deepEqual(championsFromSummary(JSON.stringify(full)), want);
  assert.deepEqual(championsFromSummary('{not json'), []);
});
test('names: control characters out, 16 characters, a fallback when nothing is left', () => {
  assert.equal(boardName('A\u0000B\u202e\nC'), 'A B C', 'a bidi override cannot flip the board');
  assert.equal(boardName('A\u0007B\tC'), 'A B C');
  assert.equal(boardName('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnop');
  assert.equal(boardName('   '), 'Fighter');
  assert.equal(boardName(42), 'Fighter');
  assert.equal(championsFromSummary({ fastest_kill: { ticks: 60, verified: true } })[0]!.name, 'Fighter');
  assert.equal(championsFromSummary({ fastest_kill: { display_name: 'abcdefghijklmnopqrstuvwxyz', ticks: 60, verified: false } })[0]!.name, 'abcdefghijklmnop*');
});
test('fetchChampions: a guest, an rpc error and a throw all leave an empty board; the right rpc is called', async () => {
  assert.deepEqual(await fetchChampions(undefined), []);
  assert.deepEqual(await fetchChampions(null), []);
  const calls: string[] = [];
  const ok: SkullDb = { rpc: (name) => { calls.push(name); return Promise.resolve({ data: full, error: null }); } };
  assert.equal((await fetchChampions(ok)).length, 5);
  assert.deepEqual(calls, ['daily_board_summary']);
  assert.deepEqual(await fetchChampions({ rpc: () => Promise.resolve({ data: full, error: { message: 'no' } }) }), []);
  assert.deepEqual(await fetchChampions({ rpc: () => { throw new Error('offline'); } }), []);
  assert.deepEqual(await fetchChampions({ rpc: () => Promise.reject(new Error('offline')) }), []);
});
test('the demo day: five lines, one starred', () => {
  const lines = demoChampions();
  assert.equal(lines.length, 5);
  assert.equal(lines.filter((c) => c.name.endsWith('*')).length, 1);
  assert.deepEqual(demoChampions(), demoChampions());
});

const stage = (extra: object = {}): Stage => Object.assign({
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: undefined as unknown as THREE.WebGLRenderer,
  setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], legendKeys: () => PORTRAIT_KEYS, loot: () => ({ owned: [], equipped: {} }),
}, extra) as Stage;

test('the board is one timber box on the back fence, 3.0 x 1.5 m, turned to face the gate (-z), one draw, picks "champions"; with no canvas the texture is a stand-in', () => {
  const group = new THREE.Group(), z = ROOM.depth / 2, b = buildChampions(group, z);
  assert.equal(group.children.length, 1);
  const mesh = group.children[0] as THREE.Mesh, mat = mesh.material as THREE.MeshStandardMaterial;
  assert.ok(mat instanceof THREE.MeshStandardMaterial && mat.roughness === 1 && mat.emissive.getHex() === 0, 'plain rough timber, never emissive');
  const box = new THREE.Box3().setFromObject(mesh), size = box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - CHAMPIONS.w) < 1e-6 && Math.abs(size.y - CHAMPIONS.h) < 1e-6);
  assert.ok(box.max.z <= z && box.min.z > z - 0.2, 'hung on the fence\'s inside');
  assert.ok(box.min.y >= 1 && box.max.y <= 2.6, 'a readable height on the fence');
  const front = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
  assert.ok(front.z < -0.99, 'the painted +z face looks toward the gate');
  assert.deepEqual(b.targets.map((t) => t.id), ['champions']);
  b.restock([]); b.restock(undefined); b.restock(demoChampions());
  assert.doesNotThrow(() => championsTexture([]));
  b.dispose(); b.dispose();
  assert.equal(group.children.length, 0);
});

test('the room carries the board: one more draw within the budget, a pick volume, and a tap from the champions pose picks it', async () => {
  const room = buildRoom(stage());
  try {
    await room.ready;
    assert.ok(room.group.getObjectByName('champions-board'));
    assert.ok(room.targets.some((t) => t.id === 'champions'));
    const c = new THREE.PerspectiveCamera(72, 390 / 694, 0.1, 50); c.position.set(...POSES.champions.camera); c.lookAt(...POSES.champions.target); c.updateMatrixWorld();
    const pick = createPicker(c, () => room.targets), v = new THREE.Vector3(0, 1.75, ROOM.depth / 2 - 0.1).project(c);
    assert.equal(pick({ x: v.x, y: v.y }), 'champions');
    const near = new THREE.Vector3(CHAMPIONS.w / 2 - 0.05, CHAMPIONS.y0 + CHAMPIONS.h - 0.05, ROOM.depth / 2 - 0.1).project(c);
    assert.ok(Math.abs(near.x) < 0.95 && Math.abs(near.y) < 0.95, 'the whole board is inside the glow Pit\'s phone frame (fov 72 at 390 x 694)');
  } finally { room.dispose(); }
});

test('the room hangs the stage\'s champions now, then the fetched ones once they land', async () => {
  let land!: (data: ReturnType<typeof demoChampions>) => void, asked = 0;
  const s = stage({ championsNow: () => [], champions: () => { asked++; return new Promise((done) => { land = done as typeof land; }); } });
  const room = buildRoom(s);
  try { await room.ready; assert.equal(asked, 1); land(demoChampions()); await Promise.resolve(); } finally { room.dispose(); }
});

test('the champions pose is a look-flag pose', () => {
  assert.equal(pitLookFrom('?look=pit&pose=champions'), 'champions');
  assert.equal(pitLookFrom('?look=pit&pose=nonsense'), 'rack');
});

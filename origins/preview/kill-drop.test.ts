// The sandbox kill drop (kill-drop.ts): the Found list counts and survives a reload; a marker is picked up by walking onto it, once.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createFound, createKillDrops } from './kill-drop.ts';

const memory = (): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }; };

test('the Found list counts per piece and a second list over the same storage sees it (a reload)', () => {
  const s = memory(), a = createFound(s); a.add('goblin.Body', 'Goblin breastplate', 'Pit goblin'); a.add('goblin.Body', 'Goblin breastplate', 'Pit goblin'); a.add('goblin.Boots', 'Goblin boots', 'Pit goblin');
  assert.equal(a.count(), 3); assert.deepEqual(a.list().map((i) => [i.piece, i.n]), [['goblin.Body', 2], ['goblin.Boots', 1]]);
  const b = createFound(s); assert.equal(b.count(), 3, 'survives a reload'); b.clear(); assert.equal(createFound(s).count(), 0);
});

test('a broken or missing store is an empty list, never an error', () => {
  const bad = { getItem: () => '{not json', setItem: () => { throw Error('private mode'); } }; const f = createFound(bad); assert.equal(f.count(), 0); f.add('x', 'X', 'y'); assert.equal(f.count(), 1, 'lives for the page when it cannot save');
  assert.equal(createFound(null).count(), 0);
});

test('a drop waits on the ground and is taken once, by walking within reach', () => {
  const scene = new THREE.Scene(), found = createFound(memory()), picked: string[] = []; let changes = 0;
  const drops = createKillDrops({ scene, groundAt: () => 0, found, reach: 1.4, onPick: (d) => void picked.push(d.piece), onChange: () => void changes++ });
  drops.drop('goblin.Helmet', 'Goblin helmet', 'Pit goblin', 5, 5); assert.equal(drops.waiting(), 1); assert.equal(scene.children.length, 1);
  drops.update(0.5, { x: 0, z: 0 }); assert.equal(drops.waiting(), 1, 'far away: it stays'); assert.equal(found.count(), 0);
  drops.update(0.5, { x: 4.2, z: 5 }); assert.deepEqual(picked, ['goblin.Helmet']); assert.equal(found.count(), 1); assert.equal(scene.children.length, 0, 'the marker is gone'); assert.equal(changes, 1);
  drops.update(0.5, { x: 4.2, z: 5 }); assert.equal(found.count(), 1, 'taken once');
});

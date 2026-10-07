import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { newParticle, type Feel } from '../src/armfeel.ts';
import { createBurstPool } from '../src/armfeel-fx.ts';
import { BLOOD, bloodCount, bloodGrow, foeBurstPull, makeRng, spawnBlood } from '../src/blood-style.ts';

// The one blood: Dom's b4 (thin spray + a few drops, stretched into strands, darker red). These pin its numbers.
const batch = (kill: boolean, feel: Feel, seed = 2) => { const rnd = makeRng(seed); return Array.from({ length: bloodCount(feel, kill) }, (_, i) => { const p = newParticle(); spawnBlood(p, i, 0, 1, 0, 0, 1, kill, feel, rnd); return p; }); };

test('counts: 15 on a hit, 25 on a kill, a third (at least 2) on Low, none Off', () => {
  assert.deepEqual([bloodCount('high', false), bloodCount('high', true), bloodCount('low', false), bloodCount('low', true), bloodCount('off', true)], [15, 25, 5, 9, 0]);
});

test('width, length and colour: 0.4095x the first spray in width, strands 2.46x its stretch, darker red', () => {
  const hit = batch(false, 'high'), drops = hit.filter((p) => p.life >= 0.5), specks = hit.filter((p) => p.life < 0.5);
  assert.equal(drops.length, 2); assert.equal(specks.length, 13);
  assert.ok(specks.every((p) => p.size >= 0.018 * 0.4095 - 1e-9 && p.size <= 0.05 * 0.4095 + 1e-9), 'mist is narrow');
  assert.ok(specks.every((p) => p.stretch >= 1.3 * 2.4615 - 1e-3 && p.stretch <= 2.4 * 2.4615 + 1e-3), 'mist reads as strands');
  assert.ok(drops.every((p) => p.size <= 0.12 * 0.4095 + 1e-9 && p.stretch >= 1.1 * 2.4615 - 1e-3));
  assert.equal(batch(true, 'high').filter((p) => p.life >= 0.5).length, 3, 'a kill has three heavy drops');
  assert.deepEqual([BLOOD.start, BLOOD.end], ['#690f0d', '#200504']);
});

test('life windows and seeding: the same seed draws the same blood, Low is smaller', () => {
  assert.ok(batch(false, 'high').every((p) => p.life >= 0.14 && p.life <= 0.72));
  assert.deepEqual(batch(true, 'high', 7).map((p) => [p.vx, p.vy, p.vz, p.size, p.life]), batch(true, 'high', 7).map((p) => [p.vx, p.vy, p.vz, p.size, p.life]));
  assert.ok(batch(false, 'low').every((p) => p.size <= 0.12 * 0.4095 * 0.7 + 1e-9));
});

test('the pool is one mesh and a thousand hits never grow it', () => {
  const scene = new THREE.Scene(), pool = createBurstPool(scene);
  assert.equal(pool.capacity, BLOOD.slots); assert.equal(scene.children.filter((c) => c.name === 'armfeel burst').length, 1);
  const before = scene.children.length;
  for (let i = 0; i < 1000; i++) { pool.burst('high', 0, 1, 0, 0, 1, i % 5 === 0); pool.update(0.016); }
  assert.equal(scene.children.length, before); assert.ok(pool.alive <= pool.capacity);
});

test('the far fighter\'s blood grows to the near one\'s screen size (1x to 3x), and a grown burst changes only size', () => {
  assert.deepEqual([bloodGrow(9, 3), bloodGrow(2, 3), bloodGrow(30, 3), bloodGrow(5, 0)], [3, 1, 3, 3]);
  const a = newParticle(), b = newParticle(); spawnBlood(a, 0, 0, 1, 0, 0, 1, false, 'high', makeRng(4)); spawnBlood(b, 0, 0, 1, 0, 0, 1, false, 'high', makeRng(4), 2.5);
  assert.ok(Math.abs(b.size - a.size * 2.5) < 1e-9); assert.deepEqual([b.vx, b.vy, b.vz, b.life, b.stretch], [a.vx, a.vy, a.vz, a.life, a.stretch]);
  assert.equal(bloodCount('high', false), 15, 'counts are the same on both bodies');
});

test('the foe burst is pulled toward the camera: in front of the hero, never at the lens, a small step when already in front', () => {
  assert.equal(foeBurstPull(5, 5), 0.35);   // as near as the hero: just in front of his centre depth
  assert.ok(Math.abs(foeBurstPull(8, 5) - 3.35) < 1e-9);   // a foe 3 m behind him: pulled to 0.35 m in front of his depth
  assert.equal(foeBurstPull(4, 5), 0.35);   // a foe nearer than the hero: the same small step, never a push away from the camera
  assert.ok(Math.abs(foeBurstPull(1.6, 1.5) - 0.1) < 1e-9);   // never within 1.5 m of the lens
  assert.equal(foeBurstPull(1.2, 5), 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { newParticle, type Feel } from '../src/armfeel.ts';
import { createBurstPool } from '../src/armfeel-fx.ts';
import { BLOOD, bloodCount, makeRng, spawnBlood } from '../src/blood-style.ts';

// The one blood: Dom's b4 (thin spray + a few drops, stretched into strands, darker red). These pin its numbers.
const batch = (kill: boolean, feel: Feel, seed = 2) => { const rnd = makeRng(seed); return Array.from({ length: bloodCount(feel, kill) }, (_, i) => { const p = newParticle(); spawnBlood(p, i, 0, 1, 0, 0, 1, kill, feel, rnd); return p; }); };

test('counts: 17 on a hit, 28 on a kill, a third (at least 2) on Low, none Off', () => {
  assert.deepEqual([bloodCount('high', false), bloodCount('high', true), bloodCount('low', false), bloodCount('low', true), bloodCount('off', true)], [17, 28, 6, 10, 0]);
});

test('width, length and colour: 0.455x the old spray in width, strands 2.4x the old stretch, 15% darker red', () => {
  const hit = batch(false, 'high'), drops = hit.filter((p) => p.life >= 0.5), specks = hit.filter((p) => p.life < 0.5);
  assert.equal(drops.length, 2); assert.equal(specks.length, 15);
  assert.ok(specks.every((p) => p.size >= 0.018 * 0.455 - 1e-9 && p.size <= 0.05 * 0.455 + 1e-9), 'mist is narrow');
  assert.ok(specks.every((p) => p.stretch >= 1.3 * 2.4 - 1e-9 && p.stretch <= 2.4 * 2.4 + 1e-9), 'mist reads as strands');
  assert.ok(drops.every((p) => p.size <= 0.12 * 0.455 + 1e-9 && p.stretch >= 1.1 * 2.4 - 1e-9));
  assert.equal(batch(true, 'high').filter((p) => p.life >= 0.5).length, 3, 'a kill has three heavy drops');
  assert.deepEqual([BLOOD.start, BLOOD.end], ['#75110e', '#240605']);
});

test('life windows and seeding: the same seed draws the same blood, Low is smaller', () => {
  assert.ok(batch(false, 'high').every((p) => p.life >= 0.14 && p.life <= 0.72));
  assert.deepEqual(batch(true, 'high', 7).map((p) => [p.vx, p.vy, p.vz, p.size, p.life]), batch(true, 'high', 7).map((p) => [p.vx, p.vy, p.vz, p.size, p.life]));
  assert.ok(batch(false, 'low').every((p) => p.size <= 0.12 * 0.455 * 0.7 + 1e-9));
});

test('the pool is one mesh and a thousand hits never grow it', () => {
  const scene = new THREE.Scene(), pool = createBurstPool(scene);
  assert.equal(pool.capacity, BLOOD.slots); assert.equal(scene.children.filter((c) => c.name === 'armfeel burst').length, 1);
  const before = scene.children.length;
  for (let i = 0; i < 1000; i++) { pool.burst('high', 0, 1, 0, 0, 1, i % 5 === 0); pool.update(0.016); }
  assert.equal(scene.children.length, before); assert.ok(pool.alive <= pool.capacity);
});

// ?blood=a|b (blood-style.ts): two preview styles for the combat-feel burst. Off by default; presentation only; one pooled mesh, nothing allocated per hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BURST, newParticle, spawn } from '../src/armfeel.ts';
import { createBurstPool } from '../src/armfeel-fx.ts';
import { BLOOD, bloodCount, bloodFrom, makeRng, spawnBlood } from '../src/blood-style.ts';

test('the flag: only a and b select a style; anything else is today\'s burst', () => {
  assert.deepEqual(['?blood=a', '?blood=b', '?blood=b2', '?blood=c', '', '?blood='].map(bloodFrom), ['a', 'b', 'b2', undefined, undefined, undefined]);
});

test('no style: the default burst is untouched (same slots, same spawn numbers, stretch 1.8)', () => {
  const pool = createBurstPool(new THREE.Scene());
  assert.equal(pool.capacity, BURST.slots);
  const p = newParticle(); spawn(p, 0, 8, 1, 1.25, 2, 0, 1, false, 'high');
  assert.deepEqual([p.life, p.size, p.vx, p.vy, p.vz, p.stretch], [0.3, 0.12, BURST.spread + 0, BURST.lift, 1, BURST.stretch]);
});

test('a: streaks are thin and 3-5x longer than wide, 0.4-1.2x of today\'s size or less, fewer than today, darker; never evenly spaced', () => {
  assert.ok(bloodCount('a', 'high', false) < BURST.hit && bloodCount('a', 'high', true) < BURST.kill);
  const rnd = makeRng(1), ps = Array.from({ length: 200 }, () => newParticle());
  ps.forEach((p, i) => spawnBlood('a', p, i, 0, 1, 0, 0, 1, false, 'high', rnd));
  for (const p of ps) { assert.ok(p.stretch >= 3 && p.stretch <= 5); assert.ok(p.size > 0 && p.size <= BURST.size.hit * 1.2 * 0.5); assert.ok(p.life >= 0.2 && p.life <= 0.46); }
  assert.ok(new Set(ps.map((p) => p.size.toFixed(4))).size > 100, 'sizes spread');
  assert.ok(BLOOD.a.end < BLOOD.a.start && BLOOD.a.end === '#120303', 'fades toward near-black');
});

test('b: a fine mist of tiny specks plus 3 heavier drops (4 on a kill) that arc, random per particle', () => {
  const rnd = makeRng(2), hit = Array.from({ length: bloodCount('b', 'high', false) }, () => newParticle());
  hit.forEach((p, i) => spawnBlood('b', p, i, 0, 1, 0, 0, 1, false, 'high', rnd));
  const drops = hit.filter((p) => p.size >= 0.07), specks = hit.filter((p) => p.size < 0.07);
  assert.equal(drops.length, 3); assert.ok(specks.length >= 15 && specks.every((p) => p.size <= 0.05));
  assert.ok(Math.min(...drops.map((p) => p.life)) > Math.max(...specks.map((p) => p.life)), 'drops outlive the mist');
  assert.equal(Array.from({ length: bloodCount('b', 'high', true) }, (_, i) => i).filter((i) => i < 4).length, 4);
  assert.ok(new Set(hit.map((p) => p.life.toFixed(4))).size > hit.length / 2, 'lives are randomised');
});

test('b2: b made 30% less thick: 0.7x the particles, 0.7x the size, same colour and timing', () => {
  assert.equal(BLOOD.b2.start, BLOOD.b.start); assert.equal(BLOOD.b2.end, BLOOD.b.end);
  for (const kill of [false, true]) assert.equal(bloodCount('b2', 'high', kill), Math.round(bloodCount('b', 'high', kill) * 0.7));
  const rnd = makeRng(2), hit = Array.from({ length: bloodCount('b2', 'high', false) }, () => newParticle());
  hit.forEach((p, i) => spawnBlood('b2', p, i, 0, 1, 0, 0, 1, false, 'high', rnd));
  const drops = hit.filter((p) => p.size >= 0.049), specks = hit.filter((p) => p.size < 0.049);
  assert.equal(drops.length, 2); assert.ok(specks.every((p) => p.size <= 0.05 * 0.7 + 1e-9));
  assert.ok(hit.every((p) => p.life >= 0.14 && p.life <= 0.72), 'life windows unchanged');
});

test('the same seed draws the same blood; the pool is one mesh and a thousand hits never grow it; Off draws nothing', () => {
  const run = () => { const rnd = makeRng(7), p = newParticle(); spawnBlood('b', p, 5, 0, 1, 0, 0, 1, true, 'high', rnd); return [p.vx, p.vy, p.vz, p.size, p.life]; };
  assert.deepEqual(run(), run());
  for (const style of ['a', 'b', 'b2'] as const) {
    const scene = new THREE.Scene(), pool = createBurstPool(scene, style);
    assert.equal(pool.capacity, BLOOD[style].slots); assert.equal(scene.children.filter((c) => c.name === 'armfeel burst').length, 1);
    const before = scene.children.length;
    for (let i = 0; i < 1000; i++) { pool.burst('high', 0, 1, 0, 0, 1, i % 5 === 0); pool.update(0.016); }
    assert.equal(scene.children.length, before); assert.ok(pool.alive <= pool.capacity);
    pool.clear(); pool.burst('off', 0, 1, 0, 0, 1, false); pool.update(0.016); assert.equal(pool.alive, 0);
  }
});

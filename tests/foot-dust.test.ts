import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFootDust } from '../src/foot-dust.ts';

test('foot dust needs a moving foot plant, holds on hit-stop, stays low and expires after stopping', () => {
  const scene = new THREE.Scene(), dust = createFootDust(scene), points = scene.getObjectByName('foot dust') as THREE.Points;
  const step = (y: number, moving = true, dt = 1 / 60, x = 0) => dust.update(dt, [new THREE.Vector3(x, y, 0)], [moving]);
  step(0.25); step(0.1, false); assert.equal(points.visible, false, 'idle foot motion emitted dust');
  step(0.25); step(0.1, true, 1 / 60, 4); assert.equal(points.visible, false, 'teleport emitted dust');
  step(0.25); step(0.1); assert.equal(points.visible, true, 'descending plant did not scuff sand');
  const before = Array.from(points.geometry.getAttribute('position').array), alpha = Array.from(points.geometry.getAttribute('dustFade').array);
  step(0.08, true, 0); assert.deepEqual(Array.from(points.geometry.getAttribute('position').array), before); assert.deepEqual(Array.from(points.geometry.getAttribute('dustFade').array), alpha);
  for (let i = 0; i < 60; i++) {
    step(0.1, false);
    const p = points.geometry.getAttribute('position'), sizes = points.geometry.getAttribute('dustSize');
    for (let j = 0; j < p.count; j++) assert.ok(p.getY(j) + 0.52 * sizes.getX(j) / 2 < 0.5, 'dust reaches above the lower legs');
    if (i === 40) assert.equal(points.visible, true, 'dust disappeared before its one-second tail');
  }
  assert.equal(points.visible, false); assert.ok(Array.from(points.geometry.getAttribute('dustFade').array).every(v => v === 0));
  let disposed = 0; points.geometry.addEventListener('dispose', () => disposed++); dust.dispose(); assert.equal(disposed, 1); assert.equal(scene.getObjectByName('foot dust'), undefined);
});

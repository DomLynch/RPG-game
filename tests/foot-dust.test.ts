import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFootDust, dustOnStone } from '../src/foot-dust.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';

// The sand puff a heavy landing kicks off a planted foot (presentation): a handful of grains from the pool at that foot, rising and drifting
// outward, gone within the pool's one-second lifetime; a pause (dt 0) holds them like everything else in the pool.
test('a puff throws 5–9 grains at the foot that rise, spread and die within a second', () => {
  const scene = new THREE.Scene(), dust = createFootDust(scene), points = scene.getObjectByName('foot dust') as THREE.Points;
  const position = points.geometry.attributes.position as THREE.BufferAttribute, fade = points.geometry.attributes.dustFade as THREE.BufferAttribute;   // a dead grain keeps a size and a zero fade
  const foot = new THREE.Vector3(0.3, 0.02, -1.4), live = () => { let n = 0; for (let i = 0; i < position.count; i++) if (fade.getX(i) > 0 && Math.hypot(position.getX(i) - foot.x, position.getZ(i) - foot.z) < 1) n++; return n; };
  dust.puff(foot, 1); dust.update(0, [], []); assert.ok(!points.visible, 'dt 0 drew the puff before time passed');
  dust.update(1 / 60, [], []); const grains = live(); assert.ok(points.visible && grains >= 5 && grains <= 9, `${grains} grains`);
  const near = new Set<number>(); for (let i = 0; i < position.count; i++) if (fade.getX(i) > 0) near.add(i);
  const start = [...near].map(i => position.getY(i));
  for (let f = 0; f < 12; f++) dust.update(1 / 60, [], []);
  const risen = [...near].every((i, k) => position.getY(i) > start[k]), spread = [...near].every(i => Math.hypot(position.getX(i) - foot.x, position.getZ(i) - foot.z) > 0.1);
  assert.ok(risen && spread, 'grains rise and drift outward');
  for (let f = 0; f < 60; f++) dust.update(1 / 60, [], []);
  assert.ok(!points.visible, 'the puff outlived the pool lifetime');
  dust.puff(foot, 0.6); dust.update(1 / 60, [], []); assert.ok(live() >= 5 && live() < grains, 'a blocked heavy puffs less than a landed one');
  dust.dispose(); assert.equal(scene.getObjectByName('foot dust'), undefined);
});

// Presentation: dust on a wet or paved floor is darker and thinner than the sand's warm tan, so it does not read as a pale ring on grey stone.
test('stone floors get a darker, thinner dust than sand', () => {
  const tone = (stone: boolean) => {
    const scene = new THREE.Scene(); createFootDust(scene, stone);
    const m = (scene.getObjectByName('foot dust') as THREE.Points).material as THREE.PointsMaterial;
    return { luma: m.color.r + m.color.g + m.color.b, opacity: m.opacity };
  };
  const sand = tone(false), stone = tone(true);
  assert.ok(stone.luma < sand.luma && stone.opacity < sand.opacity, 'stone dust is not darker and thinner');
  assert.equal(sand.opacity, 0.6, 'sand dust changed');
});

test('the dark dust goes to the paved, clay and wet arenas; the Ash Pit and Blood Sand keep the tan', () => {
  assert.deepEqual(Object.values(ARENA_THEMES).filter(dustOnStone).map(t => t.id).sort(), ['a', 'b', 'd']);
});

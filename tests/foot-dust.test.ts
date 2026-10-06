import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFootDust, dustToneFor } from '../src/foot-dust.ts';
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

// Presentation: dust on a paved/wet floor is darker and thinner than the sand's warm tan, and the Night Pit's clay darker still, so none reads as a pale ring.
test('stone and clay floors get a darker dust than sand', () => {
  const tone = (kind: 'sand' | 'stone' | 'clay') => {
    const scene = new THREE.Scene(); createFootDust(scene, kind);
    const m = (scene.getObjectByName('foot dust') as THREE.Points).material as THREE.PointsMaterial;
    return { luma: m.color.r + m.color.g + m.color.b, opacity: m.opacity };
  };
  const sand = tone('sand'), stone = tone('stone'), clay = tone('clay');
  assert.ok(stone.luma < sand.luma && stone.opacity < sand.opacity, 'stone dust is not darker and thinner');
  assert.ok(clay.luma < stone.luma, 'clay dust is not darker than stone dust');
  assert.equal(sand.opacity, 0.6, 'sand dust changed');
});

test('each arena gets its floor\'s dust: Night Pit clay, Rain Yard and Cistern stone, Ash Pit and Blood Sand sand', () => {
  assert.deepEqual(Object.values(ARENA_THEMES).map(t => `${t.id}:${dustToneFor(t)}`), ['1:sand', '2:sand', '3:sand', 'a:clay', 'b:stone', 'c:sand', 'd:stone']);
});

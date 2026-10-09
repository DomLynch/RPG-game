// The gear seam's hide (src/stage-hide.ts, scene.ts gearStage setArenaVisible): hide → show puts every scene child back exactly as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hideChildren } from '../src/stage-hide.ts';

test('hide then restore gives each child exactly its prior visibility; kept children and later children are untouched', () => {
  const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(), player = new THREE.Group(), arena = new THREE.Group();
  const sparks = new THREE.Group(), blood = new THREE.Group(), capsule = new THREE.Group();
  sparks.visible = false; capsule.visible = false;   // an effect idle at the kill, and the opponent's stand-in before the rigs
  scene.add(sun, player, arena, sparks, blood, capsule);
  const before = scene.children.map((c) => c.visible);
  const restore = hideChildren(scene, (c) => c === player || c instanceof THREE.Light);
  assert.deepEqual([sun, player, arena, sparks, blood, capsule].map((c) => c.visible), [true, true, false, false, false, false]);
  const room = new THREE.Group();   // the Pit's own room, added while the arena is hidden
  scene.add(room);
  restore();
  assert.deepEqual(scene.children.slice(0, 6).map((c) => c.visible), before, 'every child as it was, the hidden ones still hidden');
  assert.equal(room.visible, true, 'a child added while hidden is the caller\'s to manage');
});

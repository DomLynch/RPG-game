import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { nightBronzeApplies, toneNightBronze, NIGHT_BRONZE } from '../src/night-armour.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';

test('night bronze applies to Brynhildr L9 in the Night Pit only', () => {
  assert.equal(nightBronzeApplies(ARENA_THEMES.a.id, 'shieldmaiden', 9), true);
  assert.equal(nightBronzeApplies('1', 'shieldmaiden', 9), false);
  assert.equal(nightBronzeApplies('a', 'shieldmaiden', 8), false);
  assert.equal(nightBronzeApplies('a', 'knight', 9), false);
});

test('the tone pulls the sheen down and keeps the mesh and material', () => {
  const material = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 1 }), draw = new THREE.SkinnedMesh(new THREE.BufferGeometry(), material);
  toneNightBronze({ draws: [draw], keep: [] });
  assert.equal(material.metalness, NIGHT_BRONZE.metalness);
  assert.equal(material.roughness, 1);
  assert.equal(draw.material, material);
});

// The Pit's look mocks get CLONES of the arena's surfaces (Lead's condition, 2026-09-30): tweaking one never touches the arena's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, Texture, Vector2 } from 'three';
import { clonesOf } from '../src/arena-materials.ts';

test('a mutated clone leaves the arena material untouched, shares its maps, and drops the vertex-colour flag', () => {
  const map = new Texture(), normalMap = new Texture();
  const stone = new MeshStandardMaterial({ name: 'stone', map, normalMap, normalScale: new Vector2(1.1, 1.1), color: '#b9b4ab', roughness: 0.93, vertexColors: true });
  const sand = new MeshStandardMaterial({ name: 'sand', map: new Texture(), roughness: 0.8 });
  const clones = clonesOf({ stone, sand });
  clones.stone.roughness = 0.2; clones.stone.color.set('#ff0000'); clones.stone.normalScale.set(3, 3); clones.stone.map = null;
  assert.equal(stone.roughness, 0.93); assert.equal(stone.color.getHexString(), 'b9b4ab'); assert.equal(stone.normalScale.x, 1.1); assert.equal(stone.map, map);
  assert.equal(stone.vertexColors, true, 'the arena keeps its grime in vertex colours');
  assert.equal(clones.stone.vertexColors, false, 'the room has no colour attribute');
  assert.equal(clones.sand.map, sand.map, 'the maps are shared, not copied');
  assert.notEqual(clones.sand, sand);
});

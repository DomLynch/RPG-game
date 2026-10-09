// The shared triangle counter (scripts/lib/glb-stats.mjs): an indexed mesh counts its indices, a NON-indexed mesh counts its positions (it used to read as zero), and the shipped bodies still read what the pins say.
import test from 'node:test';
import assert from 'node:assert/strict';
import { glbStats, trianglesOf } from '../scripts/lib/glb-stats.mjs';

test('a non-indexed mesh is counted by its positions, an indexed one by its indices', () => {
  const accessors = [{ count: 300 }, { count: 90 }, { count: 12 }, { count: 7 }];
  assert.equal(trianglesOf({ accessors, meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }] }), 100, 'indexed: 300 indices = 100 triangles');
  assert.equal(trianglesOf({ accessors, meshes: [{ primitives: [{ attributes: { POSITION: 1 } }] }] }), 30, 'non-indexed: 90 positions = 30 triangles, not 0');
  assert.equal(trianglesOf({ accessors, meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }, { attributes: { POSITION: 1 } }] }, { primitives: [{ attributes: { POSITION: 2 } }] }] }), 134, 'a mix, across meshes');
  assert.equal(trianglesOf({ accessors, meshes: [{ primitives: [{ attributes: { POSITION: 3 }, mode: 5 }, { attributes: { POSITION: 3 }, mode: 1 }] }] }), 5, 'a strip is n-2 triangles, lines are none');
  assert.equal(trianglesOf({ accessors, meshes: [] }), 0);
});

test('the shipped world goblin reads its known count through the helper', () => {
  assert.equal(glbStats('public/world/goblin.glb').tris, 7999);
  assert.equal(glbStats('src/assets/goblin.glb').tris, 62361);
});

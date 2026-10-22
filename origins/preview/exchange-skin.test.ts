import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_ROWS, planFor, type Piece } from '../zones/plan.ts';
import { shapeBaseY, skinnedPieces, skinPlacements, skinsOfFile } from './exchange-skin.ts';

const box = (over: Partial<Piece>): Piece => ({ layer: 'stone', shape: ['box', 1, 4, 1], x: 3, y: 2, z: -40, tint: [1, 1, 1], rotY: 0.5, foot: 0, ...over });

// The town kit: a plan piece row may name a building-skins model id. The model stands on the piece's base; the shape is the fallback.
test('a model stands on the base of its piece, whatever the shape', () => {
  assert.equal(shapeBaseY(box({})), 0);
  assert.equal(shapeBaseY({ shape: ['cylinder', 0.3, 0.3, 4.4, 12], y: 2.2 }), 0);
  assert.equal(shapeBaseY({ shape: ['cone', 1, 3, 8], y: 1.5 }), 0);
  assert.equal(shapeBaseY({ shape: ['sphere', 0.5, 8, 6], y: 0.5 }), 0);
  assert.equal(shapeBaseY({ shape: ['pediment', 4, 2, 1], y: 6 }), 6);
});

test('placements come from the pieces that name a model row, with the row\'s own scale; an unknown id keeps its shape', () => {
  const pieces = [box({ skin: 'goblin-hut', scale: 1.5 }), box({ skin: 'goblin-hut', x: 9 }), box({ skin: 'no-such-model' }), box({})];
  assert.deepEqual([...skinnedPieces(pieces)].map(([id, l]) => [id, l.length]), [['goblin-hut', 2], ['no-such-model', 1]]);
  assert.deepEqual(skinPlacements(pieces), [
    { node: 'goblin_hut', x: 3, z: -40, rotY: 0.5, scale: 1.5, y: 0 },
    { node: 'goblin_hut', x: 9, z: -40, rotY: 0.5, scale: 1, y: 0 },
  ]);
  assert.deepEqual(skinPlacements([box({})]), []);
});

test('a file holds the skin ids that its hide-the-greybox step names', () => {
  assert.deepEqual(skinsOfFile('world/kit/goblin_hut.glb'), ['goblin-hut']);
  assert.deepEqual(skinsOfFile('world/kit/nothing.glb'), []);
});

test('planFor carries a piece row\'s skin and scale; a row without them is exactly today\'s piece', () => {
  const base: Record<string, number> = {}; for (const a of PLAN_ROWS.anchors) base[a.source] = a.base;
  const resolve = (s: string): number => base[s]!;
  const today = planFor('exchange', resolve)!;
  assert.ok(today.pieces.every((p) => !('skin' in p) && !('scale' in p)));
  const rows = { ...PLAN_ROWS, pieces: PLAN_ROWS.pieces.map((r, i) => (i === 0 ? { ...r, skin: 'goblin-hut', scale: 2 } : r)) };
  const skinned = planFor('exchange', resolve, rows)!;
  assert.equal(skinned.pieces[0]!.skin, 'goblin-hut'); assert.equal(skinned.pieces[0]!.scale, 2);
  assert.deepEqual(skinned.pieces.slice(1), today.pieces.slice(1));
});

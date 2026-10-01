import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BufferGeometry, Float32BufferAttribute, Matrix4, Skeleton } from 'three';
import { gripFit } from '../src/characters.ts';
import { shieldFor, SHIPPING_SHIELDS } from '../src/shields.ts';

test('shieldFor: the band file per rank, the Centurion stem, no rank-1 Centurion shield, nothing without the flag or for another opponent', () => {
  assert.equal(shieldFor('shieldmaiden', 1, true), '/shields/shieldmaiden-plain.glb');
  assert.equal(shieldFor('shieldmaiden', 4, true), '/shields/shieldmaiden-crafted.glb');
  assert.equal(shieldFor('shieldmaiden', 10, true), '/shields/shieldmaiden-ornate.glb');
  assert.equal(shieldFor('veteran', 2, true), '/shields/centurion-plain.glb');
  assert.equal(shieldFor('veteran', 1, true), undefined, 'the Centurion fights his trident at Recruit with no shield');
  assert.equal(shieldFor('shieldmaiden', 5, false), undefined);
  assert.equal(shieldFor('goblin', 5, true), undefined);
  assert.equal(SHIPPING_SHIELDS.size, 0, 'nothing ships until the files land');
});

test('gripFit: the grip origin lands on the bone\'s bind joint and every vertex is skinned 100 % to it', () => {
  const hand = new Bone(); hand.name = 'hand_l';
  const other = new Bone(); other.name = 'spine';
  const skeleton = new Skeleton([other, hand], [new Matrix4(), new Matrix4().makeTranslation(-.706, -1.455, .065)]);   // hand_l's bind joint at (0.706, 1.455, −0.065)
  const board = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, .1, 0, .1, 0, .2, .1], 3));
  const fitted = gripFit(board, skeleton, 'hand_l'), p = fitted.getAttribute('position');
  assert.deepEqual([p.getX(0), p.getY(0), p.getZ(0)].map(v => +v.toFixed(3)), [.706, 1.455, -.065]);
  assert.ok(Math.abs(p.getX(1) - .806) < 1e-6 && Math.abs(p.getZ(1) - .035) < 1e-6, 'the board keeps its own shape about the grip');
  for (let i = 0; i < 3; i++) { assert.equal(fitted.getAttribute('skinIndex').getX(i), 1); assert.equal(fitted.getAttribute('skinWeight').getX(i), 1); }
  assert.equal(board.getAttribute('position').getX(0), 0, 'the source piece is not touched (it is worn on every re-dress)');
  assert.throws(() => gripFit(board, skeleton, 'hand_x'), /no hand_x/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { BANDS, bandOf, shapeFor, shapesFlag, shapesOn, SHIPPING_SHAPES } from '../src/weapon-shapes.ts';

test('bands follow the brief: PLAIN at rank levels 1–3, CRAFTED 4–7, ORNATE 8–10', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(bandOf), ['plain', 'plain', 'plain', 'crafted', 'crafted', 'crafted', 'crafted', 'ornate', 'ornate', 'ornate']);
  assert.deepEqual(BANDS, ['plain', 'crafted', 'ornate']);
});

test('a band file resolves by the rank level; an absent band falls back to the weapon as shipped', () => {
  const table = { maul: ['plain', 'ornate'] as const };
  assert.equal(shapeFor('maul', 2, table), '/weapons/shapes/maul-plain.glb');
  assert.equal(shapeFor('maul', 5, table), undefined, 'no crafted maul yet: today\'s part');
  assert.equal(shapeFor('maul', 9, table), '/weapons/shapes/maul-ornate.glb');
  assert.equal(shapeFor('longsword', 9, table), undefined, 'a weapon with no files keeps its own shape');
});

test('nothing ships until a trio passes: the shipping table is empty, so every weapon keeps today\'s part', () => {
  assert.deepEqual(SHIPPING_SHAPES, {});
  assert.equal(shapesOn(SHIPPING_SHAPES), false, 'scene.ts reshape() returns before resolving anything');
  assert.equal(shapesOn({ maul: [] }), false);
  assert.equal(shapesOn({ maul: ['plain'] }), true);
  for (const level of [1, 5, 10]) assert.equal(shapeFor('maul', level), undefined);
});

test('the dev flag names the band files present; junk entries are dropped', () => {
  assert.equal(shapesFlag(''), undefined);
  assert.deepEqual(shapesFlag('?shapes=maul-plain,maul-ornate,../x-plain,maul-gold,trident-crafted'), { maul: ['plain', 'ornate'], trident: ['crafted'] });
});

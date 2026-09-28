import assert from 'node:assert/strict';
import test from 'node:test';
import { BANDS, bandOf, SHAPE_OVERRIDES, shapeFor, shapesFlag, shapesFor, shapesOn, SHIPPING_SHAPES } from '../src/weapon-shapes.ts';

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

test('the Plague Doctor\'s estoc is a cane sword (estoc-cane-<band>), falling back to the stock estoc, then to today\'s part', () => {
  assert.equal(SHAPE_OVERRIDES.plaguedoctor?.estoc, 'estoc-cane');
  const both = { 'estoc-cane': ['ornate'], estoc: ['plain', 'ornate'] } as const;
  assert.equal(shapeFor('estoc', 9, both, 'plaguedoctor'), '/weapons/shapes/estoc-cane-ornate.glb');
  assert.equal(shapeFor('estoc', 2, both, 'plaguedoctor'), '/weapons/shapes/estoc-plain.glb', 'no plain cane yet: the stock estoc\'s band');
  assert.equal(shapeFor('estoc', 5, both, 'plaguedoctor'), undefined, 'neither has crafted: today\'s estoc');
  assert.equal(shapeFor('estoc', 9, both, 'nightborn'), '/weapons/shapes/estoc-ornate.glb', 'another opponent\'s estoc stays the stock shape');
  assert.equal(shapeFor('estoc', 9, both), '/weapons/shapes/estoc-ornate.glb', 'the player\'s estoc stays the stock shape');
  assert.equal(shapeFor('maul', 9, both, 'plaguedoctor'), undefined, 'the override is per weapon');
  assert.deepEqual(shapesFlag('?shapes=estoc-cane-ornate'), { 'estoc-cane': ['ornate'] });
});

test('the player\'s own weapon takes the band of HIS rung; the opponent\'s takes the rung he is met at (Lead 2026-09-28: the bug the stills found)', () => {
  const table = { maul: ['plain', 'crafted', 'ornate'], 'estoc-cane': ['ornate'] } as const;
  // A Recruit player (level 1) facing an opponent pinned or met at Origin (rung level 10 → band ornate): his maul stays plain.
  assert.deepEqual(shapesFor({ player: 'maul', opponent: 'maul', opponentId: 'knight', playerLevel: 1, opponentLevel: 10 }, table),
    { player: '/weapons/shapes/maul-plain.glb', opponent: '/weapons/shapes/maul-ornate.glb' });
  // An Origin player facing a Recruit-rung opponent: his is ornate, the opponent's plain.
  assert.deepEqual(shapesFor({ player: 'maul', opponent: 'maul', opponentId: 'knight', playerLevel: 10, opponentLevel: 1 }, table),
    { player: '/weapons/shapes/maul-ornate.glb', opponent: '/weapons/shapes/maul-plain.glb' });
  // The per-opponent override is his alone: the player's estoc never becomes the Plague Doctor's cane.
  assert.deepEqual(shapesFor({ player: 'estoc', opponent: 'estoc', opponentId: 'plaguedoctor', playerLevel: 10, opponentLevel: 10 }, table),
    { player: undefined, opponent: '/weapons/shapes/estoc-cane-ornate.glb' });
  assert.deepEqual(shapesFor({ opponentId: 'goblin', playerLevel: 1, opponentLevel: 1 }), { player: undefined, opponent: undefined }, 'no weapons yet (rigs loading): nothing');
});

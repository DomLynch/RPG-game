import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookFrom } from '../src/look-flag.ts';

test('no look flag means today\'s render: nothing is built', () => {
  for (const search of ['', '?opponent=knight', '?look=', '?look=gloss', '?hero=/herolook/legionary.glb', '?bloom=1']) assert.equal(lookFrom(search, false), undefined, search);
});

test('souls, shade and the pair combine, with a hero preview beside them', () => {
  assert.deepEqual(lookFrom('?look=souls', false), { souls: true, shade: false, silhouette: false, bloom: true });
  assert.deepEqual(lookFrom('?look=shade', false), { souls: false, shade: true, silhouette: false, bloom: true });
  assert.deepEqual(lookFrom('?opponent=knight&look=souls,shade&hero=/herolook/legionary.glb', false), { souls: true, shade: true, silhouette: false, bloom: true });
  assert.deepEqual(lookFrom('?look=shade,souls', false), { souls: true, shade: true, silhouette: false, bloom: true });
});

test('silhouette is its own token and combines like the others', () => {
  assert.deepEqual(lookFrom('?opponent=pitborn&look=silhouette', true), { souls: false, shade: false, silhouette: true, bloom: false });
  assert.deepEqual(lookFrom('?look=souls,silhouette&hero=/herolook/legionary.glb', false), { souls: true, shade: false, silhouette: true, bloom: true });
});

test('the phone tier drops bloom unless a flag forces it', () => {
  assert.equal(lookFrom('?look=souls', true)!.bloom, false);
  assert.equal(lookFrom('?look=souls&bloom=1', true)!.bloom, true);
  assert.equal(lookFrom('?look=souls&bloom=0', false)!.bloom, false);
});

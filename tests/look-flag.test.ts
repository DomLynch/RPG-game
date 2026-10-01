import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookFrom } from '../src/look-flag.ts';

test('no look flag means today\'s render: nothing is built', () => {
  for (const search of ['', '?opponent=knight', '?look=', '?look=gloss', '?hero=/herolook/legionary.glb', '?bloom=1']) assert.equal(lookFrom(search, false), undefined, search);
});

test('souls, shade and the pair combine, with a hero preview beside them', () => {
  assert.deepEqual(lookFrom('?look=souls', false), { souls: true, shade: false, bloom: true });
  assert.deepEqual(lookFrom('?look=shade', false), { souls: false, shade: true, bloom: true });
  assert.deepEqual(lookFrom('?opponent=knight&look=souls,shade&hero=/herolook/legionary.glb', false), { souls: true, shade: true, bloom: true });
  assert.deepEqual(lookFrom('?look=shade,souls', false), { souls: true, shade: true, bloom: true });
});

test('the phone tier drops bloom unless a flag forces it', () => {
  assert.equal(lookFrom('?look=souls', true)!.bloom, false);
  assert.equal(lookFrom('?look=souls&bloom=1', true)!.bloom, true);
  assert.equal(lookFrom('?look=souls&bloom=0', false)!.bloom, false);
});

test('?look=nightrim is its own flag and does not switch on the souls post chain', async () => {
  const { nightRimFrom } = await import('../src/look-flag.ts');
  assert.equal(nightRimFrom('?look=nightrim'), true); assert.equal(nightRimFrom('?look=souls,nightrim'), true);
  for (const search of ['', '?look=', '?look=souls', '?look=nightrimx']) assert.equal(nightRimFrom(search), false);
  assert.equal(lookFrom('?look=nightrim', false), undefined);
});

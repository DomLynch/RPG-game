import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraVariantFrom, lookFrom } from '../src/look-flag.ts';

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

test('&camera=a|b|c: no flag (or any other value) is b, today\'s lock camera, byte-identical to the pre-flag formula', async () => {
  for (const search of ['', '?opponent=knight', '?camera=', '?camera=x', '?camera=B']) assert.equal(cameraVariantFrom(search), 'b', search);
  assert.equal(cameraVariantFrom('?camera=a'), 'a'); assert.equal(cameraVariantFrom('?camera=c'), 'c');
  const { lockBack, lockHeight } = await import('../src/camera.ts');
  for (const d of [0.8, 1.5, 2.4, 4, 6.5, 9]) {
    assert.equal(lockBack(d), Math.max(4.6, d * 0.75 + 3.0), `back at ${d}`);
    assert.equal(lockHeight(d), Math.max(3.1, d * 1.05, d * 1.3 - 3), `height at ${d}`);
    assert.equal(lockBack(d, 'a'), Math.max(4.2, d * 0.62 + 2.8)); assert.equal(lockHeight(d, 'a'), Math.max(3.2, d * 1.3));
    assert.equal(lockBack(d, 'c'), Math.max(4.4, d * 0.685 + 2.9));
  }
});

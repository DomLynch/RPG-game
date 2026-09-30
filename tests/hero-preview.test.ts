import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroPreview } from '../src/hero-preview.ts';

test('hero preview accepts a file directly under /herolook/', () => {
  assert.equal(heroPreview('?hero=/herolook/legionary.glb'), '/herolook/legionary.glb');
  assert.equal(heroPreview('?opponent=veteran&hero=/herolook/legionary-v2.glb&daily=1'), '/herolook/legionary-v2.glb');
});

test('hero preview refuses every other value, silently', () => {
  for (const search of [
    '', '?hero=', '?opponent=veteran',
    '?hero=https://evil.example/herolook/x.glb', '?hero=//evil.example/herolook/x.glb',
    '?hero=/assets/warrior.glb', '?hero=/herolook/x.gltf', '?hero=/herolook/x.glb.js', '?hero=herolook/x.glb',
    '?hero=/herolook/../assets/x.glb', '?hero=/herolook/sub/x.glb', '?hero=%2Fherolook%2F..%2Fx.glb', '?hero=/herolook/.glb',
    '?hero=/herolook/x.glb?y=1', '?hero=javascript:alert(1)',
  ]) assert.equal(heroPreview(search), undefined, search);
});

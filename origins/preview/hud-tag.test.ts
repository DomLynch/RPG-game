// The scene-space HUD pieces carry a tag so a full-screen look pass can leave them out (the ink look). Pure three.js objects, no renderer.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { hudPieces, markHud, withoutHud } from './hud-tag.ts';
import { labelSprite } from './label-sprite.ts';

test('a name tag is a tagged sprite; hudPieces finds tagged pieces only', () => {
  const root = new THREE.Group(), tag = labelSprite('Wolf · Lv 2', false), plain = new THREE.Mesh();
  root.add(tag, plain);
  assert.equal(tag.userData.hud, 'tag');
  assert.deepEqual(hudPieces(root), [tag]);
});

test('withoutHud hides every piece for the draw and restores what each had (a hidden "!" stays hidden)', () => {
  const root = new THREE.Group(), ring = markHud(new THREE.Mesh(), 'ring'), bang = markHud(new THREE.Sprite(), 'bang'), body = new THREE.Mesh();
  bang.visible = false; root.add(ring, bang, body);
  const seen = withoutHud(root, () => [ring.visible, bang.visible, body.visible]);
  assert.deepEqual(seen, [false, false, true], 'during the draw: HUD hidden, the body drawn');
  assert.deepEqual([ring.visible, bang.visible, body.visible], [true, false, true], 'after: restored, the calm "!" still hidden');
  assert.throws(() => withoutHud(root, () => { throw new Error('x'); }), /x/);
  assert.equal(ring.visible, true, 'restored even when the draw throws');
});

test('markHud tags a whole group', () => {
  const g = new THREE.Group(), a = new THREE.Mesh(); g.add(a);
  markHud(g, 'ground-ring');
  assert.deepEqual([g.userData.hud, a.userData.hud], ['ground-ring', 'ground-ring']);
});
